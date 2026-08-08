# ADR 0003: Deployment flexibility (K8s optional) and load/compression policy

## Status

Accepted (2026-08-04)

## Context

Human requirement:

1. The platform must **withstand production load** (many concurrent devices checking and downloading multi-GB OTAs).
2. Deployment must work **with Kubernetes or without** (Docker Compose, single VM, systemd).
3. HTTP compression behavior must remain **Updater-compatible**.

## Decision

### Deployment modes (all first-class)

| Mode | Use case |
|------|----------|
| **Docker Compose** | Local dev, small single-server production |
| **Bare VM + Docker** | Simple production without orchestrator |
| **Kubernetes** | Optional; horizontal scale, HPA, rolling updates |

All application services read configuration from **environment variables** only. No K8s-specific logic in application code. K8s manifests live under `infra/k8s/` and are optional.

Same container images for Compose and K8s.

### Load and stress design

| Layer | Strategy |
|-------|----------|
| OTA metadata (`GET {device}-{channel}`) | Tiny responses; nginx rate limit; short cache TTL; stateless |
| OTA binaries | **Never** through Next.js; CDN or S3-compatible direct origin; HTTP Range |
| Dashboard | Horizontally scalable stateless replicas; sticky sessions via Redis store |
| Worker | Scale replicas; BullMQ concurrency per pod via env |
| PostgreSQL / Redis | Managed or clustered in production; not in app hot path for downloads |
| Abuse | Per-IP rate limits, connection limits, timeouts |

Kubernetes: Deployments + HPA for `dashboard` and `worker`; PodDisruptionBudgets; resource requests/limits.

Non-K8s: Compose `deploy.replicas` or multiple hosts behind external load balancer; same env contract.

### Compression policy (critical for OTA)

| Content | Compression |
|---------|-------------|
| OTA zip / incremental zip | **Forbidden** on reverse proxy (gzip/brotli off). Bytes must be exact for `verifyPackage` and Range resume. |
| Channel metadata (text) | Optional gzip at CDN; body is one line (~80 bytes); low impact |
| Dashboard (HTML/JS/CSS) | gzip/brotli **enabled** on nginx/Caddy |
| API JSON (admin) | gzip optional |

nginx: separate `location` blocks — `/` admin vs OTA static paths with `gzip off` for `*.zip` and OTA prefix.

### Health and graceful shutdown

- Liveness/readiness probes (K8s) or Docker healthchecks (Compose)
- `SIGTERM` → drain HTTP connections, finish in-flight validation jobs (bounded timeout)
- Readiness fails when DB/Redis unreachable

## Consequences

- `infra/docker/` is the **required** path to production.
- `infra/k8s/` is **optional** copy of same images with K8s wiring.
- Load tests target metadata QPS and parallel Range downloads, not Next.js file proxy.
- Documentation in `docs/deployment.md` covers both paths.

## Human confirmation

**Confirmed:** K8s optional; must support high load; OTA binaries uncompressed.
