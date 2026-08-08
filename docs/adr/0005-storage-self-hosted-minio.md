# ADR 0005: Self-hosted MinIO in Docker Compose + large transfer support

## Status

Accepted (2026-08-04)

## Context

Human confirmation:

- Public domain: **`release.mod-syria.org`** (not `realease`).
- Object storage: **self-hosted MinIO** in the **same** `docker-compose.yml` stack.
- Platform must support **large requests** (multi-GB OTA uploads and downloads, HTTP Range resume).

## Decision

### Domain

- `OTA_PUBLIC_BASE_URL=https://release.mod-syria.org/`
- Admin v1: `https://release.mod-syria.org/admin`

### Storage

| Bucket | Purpose | Access |
|--------|---------|--------|
| `ota-quarantine` | Uploaded packages pending validation | Private; app + worker only |
| `ota-published` | Approved immutable OTA artifacts + metadata objects | Public read via nginx proxy |

MinIO runs as Compose service `minio` with persistent volume `minio_data`.  
**MinIO console (`9001`) is not published** to the public internet.

Application services use `S3_ENDPOINT=http://minio:9000` on the Docker network.  
Browsers use **presigned multipart URLs** targeting MinIO (same host via nginx `/s3/` path or configured `S3_PUBLIC_ENDPOINT`).

### Large request handling

| Path | Strategy |
|------|----------|
| OTA download (devices) | nginx → MinIO; `proxy_buffering off`; timeouts **24h**; HTTP Range preserved; **no gzip** |
| OTA upload (admins) | Presigned multipart **direct to MinIO** — not through Next.js body |
| nginx `client_max_body_size` | 10m on admin routes only (API JSON) |
| MinIO | Default object size limits sufficient for multi-GB zips; document max in settings |
| Compose / nginx | `worker_connections 4096`, `worker_rlimit_nofile 65535` |

Optional future: external CDN in front of `ota-published` — same immutable keys.

## Consequences

- Single `docker compose up` brings PostgreSQL, Redis, MinIO, dashboard, worker, nginx.
- Kubernetes remains optional; same MinIO bucket layout portable to external S3 later.
- `project.md` domain references should use `release` when edited.

## Human confirmation

**Confirmed:** `release.mod-syria.org`, self-hosted MinIO in Compose, large OTA transfers supported.
