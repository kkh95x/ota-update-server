# Deployment

> Supports **Docker Compose (without Kubernetes)** and **optional Kubernetes**. Same container images for both.

## Requirements summary

| Requirement | Implementation |
|-------------|----------------|
| High load / stress | CDN or S3 for OTA bytes; horizontal dashboard/worker replicas; rate limits; HPA on K8s |
| Without K8s | `infra/docker/docker-compose.yml` — single server or VM |
| With K8s | `infra/k8s/` — Deployments, Services, HPA (optional) |
| OTA compression | **Disabled** on zip paths — exact bytes for Updater |
| Dashboard compression | gzip/brotli enabled for admin UI |

See [ADR 0003](./adr/0003-deployment-and-load.md).

---

## Architecture at scale

```
                    ┌─────────────┐
  Pixel devices ───▶│ CDN / nginx │───▶ public S3 prefix (OTA zips + metadata)
                    └─────────────┘
                           │
                    (no Next.js on this path)

  Admins ──────────▶ LB ──▶ dashboard × N ──▶ PostgreSQL
                              worker × M  ──▶ Redis / quarantine S3
```

**Rule:** Multi-GB downloads never hit the dashboard container.

---

### Large OTA transfers (multi-GB)

| Setting | Value |
|---------|-------|
| Upload path | Presigned **multipart** → `https://release.mod-syria.org/s3/...` (direct to MinIO via nginx) |
| Download path | nginx → MinIO; HTTP **Range** enabled |
| nginx timeouts | 24 hours (`proxy_read_timeout 86400s`) |
| nginx buffering | **Off** for OTA and `/s3/` |
| Max package size | Configurable (`OTA_MAX_PACKAGE_BYTES`, default 8 GiB) |
| OTA zip compression on wire | **Forbidden** (gzip off) |

Ensure host disk for `minio_data` volume is sized for all published + quarantined packages.

See [ADR 0005](./adr/0005-storage-self-hosted-minio.md).

---

## Mode A — Docker Compose (no Kubernetes)

### Suitable for

- Development
- Small/medium production (single host or few hosts)
- Air-gapped or minimal ops environments

### Quick start (after Stage 2 implementation)

```bash
cd infra/docker
cp .env.example .env   # edit secrets
docker compose up -d
```

### Services

| Service | Purpose | Scale |
|---------|---------|-------|
| `nginx` | TLS, routing, rate limits, compression policy | 1 (or external LB) |
| `dashboard` | Admin UI + API | 1+ (Compose scale profile) |
| `worker` | Validation / publish jobs | 1+ |
| `postgres` | Primary DB | 1 (+ external backup) |
| `redis` | Sessions, queues | 1 |
| `minio` | S3-compatible object storage (self-hosted) | 1 (+ volume `minio_data`) |
| `minio-init` | Creates `ota-quarantine` + `ota-published` buckets | once per start |

### Horizontal scale without K8s

- Run multiple dashboard/worker containers on separate hosts
- Shared PostgreSQL, Redis, S3 endpoint
- External nginx/HAProxy with health checks
- Session store in Redis (not in-memory)

---

## Mode B — Kubernetes (optional)

### Suitable for

- Large device fleets
- Automatic pod scaling (HPA)
- Rolling zero-downtime deploys

### Layout (`infra/k8s/`)

| Resource | Workloads |
|----------|-----------|
| `Deployment` + `Service` | `dashboard`, `worker` |
| `Deployment` or Helm chart | `postgres`, `redis` (or use managed cloud services) |
| `Ingress` | TLS termination, path `/admin` → dashboard |
| `Ingress` or separate bucket | OTA static origin (prefer object storage + CDN over Ingress for zips) |
| `HorizontalPodAutoscaler` | CPU/memory or custom metrics for dashboard/worker |
| `PodDisruptionBudget` | Min available during node drains |
| `Secret` / `ExternalSecrets` | DB, Redis, S3, session secrets |

### OTA on K8s

**Recommended:** Public OTA files on S3/R2/MinIO + CDN DNS (`cdn.mod-syria.org` or same host static path). Do not stream gigabyte zips through Ingress controllers.

**If nginx runs in-cluster:** use `infra/nginx/nginx.conf` ConfigMap; mount as volume; `gzip off` for zip locations.

### Environment parity

All config via env vars documented in `.env.example`. K8s `ConfigMap` + `Secret` mirror the same keys — no code changes between modes.

---

## Compression configuration

### OTA paths (must NOT compress)

```
*.zip
{device}-ota_update-*
{device}-incremental-*
```

nginx example (see `infra/nginx/nginx.conf`):

- `gzip off;` in OTA location
- `proxy_request_buffering off;` for large upstream if proxying to MinIO
- `Accept-Ranges` preserved from origin

### Admin paths (MAY compress)

```
/admin/*
/_next/static/*
```

Enable `gzip on;` and `gzip_types text/css application/javascript application/json;`

---

## Load and rate limits

Default nginx zones (tune per fleet size):

| Zone | Limit | Rationale |
|------|-------|-----------|
| OTA metadata | 30 req/s per IP | Lightweight; prevent scan abuse |
| OTA download | 10 concurrent per IP | Large files; allow resume |
| Admin login | 5 req/min per IP | Brute-force protection |
| Admin API | 60 req/min per session | Normal dashboard use |

Under heavy load, scale **CDN/object storage** first, then worker replicas for validation backlog, then dashboard replicas.

---

## Health checks

| Endpoint | Use |
|----------|-----|
| `GET /health/live` | Process up |
| `GET /health/ready` | DB + Redis reachable |

Docker Compose: `healthcheck` in compose file.  
Kubernetes: `livenessProbe` / `readinessProbe` on same paths.

---

## Graceful shutdown

1. Receive `SIGTERM`
2. Stop accepting new HTTP (readiness → fail)
3. Wait for active admin requests (timeout 30s)
4. Worker: stop dequeuing; complete current validation job (timeout configurable)
5. Exit

---

## TLS and domains

| Host | Role |
|------|------|
| `release.mod-syria.org` | OTA origin + `/admin` (v1) |
| `admin.mod-syria.org` | Optional admin split |
| `cdn.mod-syria.org` | Optional immutable download CDN |

Configure via `OTA_PUBLIC_BASE_URL`, `ADMIN_PUBLIC_BASE_URL`, `CDN_PUBLIC_BASE_URL`.

---

## What not to expose publicly

- PostgreSQL (5432)
- Redis (6379)
- MinIO console
- Worker metrics (use private network or auth)

---

## Disaster recovery pointer

Backups: PostgreSQL encrypted dumps, S3 versioning/replication, config secrets export.  
Details: `docs/backup-and-restore.md` (Stage 6).
