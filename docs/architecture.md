# Architecture — CUSTOM_OS OTA Platform

> Stage 1 draft. Refine as implementation proceeds.

## Design principle

The GrapheneOS Updater speaks **static HTTPS files**, not dashboard APIs. The platform therefore splits into:

1. **Public OTA origin** — serves `{device}-{channel}` metadata and OTA zips at paths the Updater already requests.
2. **Admin application** — Next.js dashboard + management API; never proxies multi-GB downloads.
3. **Validation worker** — streams quarantined objects, verifies signatures and metadata.
4. **Publication pipeline** — copies approved artifacts to the public origin and atomically updates channel pointer files.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Trust zones                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  Internet / devices                                                     │
│       │ GET metadata + OTA zips                                         │
│       ▼                                                                 │
│  ┌──────────────┐    ┌─────────────┐    ┌──────────────────────────┐   │
│  │ Nginx/Caddy  │───▶│ MinIO public│    │ release.mod-syria.org    │   │
│  │ (TLS, limits)│    │ S3 prefix   │    │ static OTA layout        │   │
│  └──────────────┘    └─────────────┘    └──────────────────────────┘   │
│                                                                         │
│  Administrators ──▶ ┌──────────────┐    ┌────────────┐    ┌─────────┐  │
│                     │  Dashboard   │───▶│ PostgreSQL │    │  Redis  │  │
│                     │  (Next.js)   │    └────────────┘    └────┬────┘  │
│                     └──────┬───────┘                           │       │
│                            │ presigned multipart               │       │
│                            ▼                                   ▼       │
│                     ┌──────────────┐                    ┌───────────┐  │
│                     │ Quarantine   │◀── validation ────│  Worker   │  │
│                     │ S3 prefix    │     jobs          └───────────┘  │
│                     └──────────────┘                                   │
│                                                                         │
│  Offline signing (out of repo) ──▶ signed OTA zips uploaded via admin  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Monorepo layout (target)

```
apps/
  dashboard/     # Next.js App Router — admin UI + management API
  worker/        # BullMQ consumer — validation, publish jobs, retention
  ota-static/    # Optional thin Node service OR nginx-only public origin

packages/
  database/      # Prisma schema + migrations
  auth/          # Auth.js, sessions, MFA
  authorization/ # RBAC enforcement
  configuration/ # Zod env validation
  ota-protocol/  # Metadata format, path builders, fake Updater client
  ota-validation/# ZIP + signature pipeline
  object-storage/# S3 abstraction (MinIO / R2 / AWS)
  observability/ # logging, metrics, tracing
  rate-limiting/
  shared/
  ui/

infra/
  docker/        # Compose, Dockerfiles
  nginx/
  scripts/
  monitoring/

docs/
tests/
  protocol/
```

## Public OTA path mapping

Database records drive **publication** into static layout:

| DB entity | Published artifact |
|-----------|-------------------|
| `Release` (approved, active) | Channel pointer file(s) e.g. `panther-stable` |
| `OtaPackage` (full) | `panther-ota_update-2026072900.zip` |
| `OtaPackage` (incremental) | `panther-incremental-2026072800-2026072900.zip` |

Publication must be **atomic per channel**: write zip first, then swap metadata pointer (or use versioned pointer + rename).

## Dashboard vs OTA separation

| Concern | Dashboard | Public OTA |
|---------|-----------|------------|
| Auth | Session + MFA | None |
| Data | PostgreSQL | Static files |
| Dynamic logic | Rollout policy, approvals | None at request time* |
| File serving | No OTA binaries | CDN / object storage |

\*Per-device rollout percentages cannot run at request time without client identity (see open questions). Initial rollout uses **channel promotion** (testing/beta/stable) matching GrapheneOS operations.

## Optional extensions (non-breaking)

- `POST /api/v1/installations/report` — opt-in telemetry with random installation ID
- Device groups with internal channels — see [device-groups-and-rollouts.md](./device-groups-and-rollouts.md)
- Structured logs + IP + monitoring — [observability-and-logging.md](./observability-and-logging.md)
- Pause/resume update offers — [update-pause-controls.md](./update-pause-controls.md)
- Metrics scrape on private network
- Admin-only health endpoints

These are **not** required for Updater compatibility.

## Technology choices

| Layer | Choice |
|-------|--------|
| Runtime | Node 22 LTS |
| Monorepo | pnpm + Turborepo |
| Admin UI | Next.js (App Router), RSC default |
| ORM | Prisma + PostgreSQL |
| Queue | BullMQ + Redis |
| Storage | S3-compatible — **MinIO self-hosted in Compose** (portable to R2/AWS later) |
| Auth | Auth.js + Argon2id + WebAuthn + TOTP |
| Tests | Vitest + Playwright |
| Observability | OpenTelemetry + Prometheus |

## Deployment topology

**Confirmed:** production must handle high load; **Kubernetes optional** (Compose/VM path is first-class).

| Mode | Path | When |
|------|------|------|
| Without K8s | `infra/docker/docker-compose.yml` | Dev, single VM, air-gapped |
| With K8s | `infra/k8s/` (optional) | Large fleets, HPA, rolling deploys |

Production routing:

- `release.mod-syria.org` → nginx → MinIO `ota-published` + `/admin` → dashboard
- Future split: `admin.mod-syria.org`, `cdn.mod-syria.org` via env config

### Load design

- OTA metadata: stateless, rate-limited, cacheable (~80 bytes)
- OTA zips: CDN/S3 direct; HTTP Range; **never** through Next.js
- Dashboard/worker: horizontal replicas; shared Redis + PostgreSQL
- K8s: HPA on dashboard/worker (`infra/k8s/hpa.yaml`)

### Compression policy

- OTA `.zip` and incremental packages: **gzip/brotli OFF** (exact bytes for Updater)
- Admin UI/API: compression ON

See [deployment.md](./deployment.md) and [ADR 0003](./adr/0003-deployment-and-load.md).

## Signing boundary

Android release signing and AVB keys live **only** in offline/HSM pipeline. This platform stores **public** OTA verification certificates for pre-publish validation.
