# Implementation Plan

## Stage 1 — Discovery and design ✅

- [x] Inspect GrapheneOS Updater source (`17` branch)
- [x] Document protocol → `docs/grapheneos-updater-protocol.md`
- [x] Architecture draft → `docs/architecture.md`
- [x] Threat model draft → `docs/threat-model.md`
- [x] ADRs for static origin and rollout model
- [x] Device models: **on demand** (1+ Pixel codenames — see `device-models.md`)
- [x] Rollout model: groups + channels + gradual stages ([ADR 0004](./adr/0004-device-groups-rollout.md))
- [x] Domain: `release.mod-syria.org` ([ADR 0005](./adr/0005-storage-self-hosted-minio.md))
- [x] Storage: self-hosted MinIO in Docker Compose
- [x] Large requests: nginx + MinIO tuned for multi-GB OTA

## Stage 2 — Foundation ✅

- [x] pnpm + Turborepo monorepo
- [x] packages/configuration, shared, observability, database, audit, auth, authorization
- [x] apps/dashboard (Next.js) + apps/worker (BullMQ skeleton)
- [x] Prisma schema + seed
- [x] Health checks `/health/live`, `/health/ready`
- [x] Admin login API + admin shell with sidebar
- [x] Device models, releases CRUD, presigned upload to MinIO quarantine
- [x] Validation worker (basic size/exists check)
- [x] Two-person approval workflow
- [x] System health + global pause settings UI
- [ ] docker compose full stack verification (manual E2E)

## Stage 3 — Release management ✅

- [x] Device models CRUD (dashboard)
- [x] Releases CRUD + detail view
- [x] Presigned upload to quarantine (MinIO)
- [x] Upload session lifecycle + validation job enqueue
- [x] BullMQ validation worker (SHA-256, ZIP metadata, identity checks)
- [x] Two-person approval workflow
- [x] Global pause/resume settings UI
- [x] Publish pipeline (quarantine → public)
- [ ] Full RSA signature verification (requires trusted OTA certs in env)

## Stage 4 — Updater-compatible OTA endpoints 🚧

- [x] `packages/ota-protocol` — path builders, metadata formatter, fake Updater client
- [x] Publication worker: quarantine → public prefix
- [x] nginx config for Range, immutable caching, no compression on zips
- [x] Protocol contract tests (`ota-protocol`, `ota-validation` unit tests)
- [ ] Live E2E with Pixel + real zip on production nginx
- [ ] `docs/updater-integration.md` (optional ops guide)

## Stage 5 — Rollouts and device reporting

- Device groups, owner notes, group membership (`device-groups-and-rollouts.md`)
- Rollout wizard: selected groups / all groups / production channels
- Ordered rollout stages with per-stage notes
- Internal channel publication per group (`{codename}-grp-*`)
- Optional installation reporting API (opt-in)
- **Global / group / channel pause & resume** ([update-pause-controls.md](./update-pause-controls.md))
- Channel metadata snapshots for Updater-safe pause
- Failure rate monitoring → auto-pause (DB flag, unpublish pointer)

## Stage 6 — Hardening

- MFA (TOTP + WebAuthn), step-up auth
- Rate limiting, security headers, CSP for admin
- OpenTelemetry + Prometheus metrics + optional Grafana profile (`infra/monitoring/`)
- Admin log viewers: `/admin/errors`, `/admin/security`, `/admin/system-health`
- Backup/restore scripts
- Dependency and container scanning in CI
- Optional K8s manifests: Deployments, Ingress, HPA (`infra/k8s/`)
- Load tests: metadata QPS + parallel Range downloads

## Stage 7 — Production readiness

- Full test matrix per `project.md`
- Security review
- Deployment runbook, incident response
- Release checklist

## Estimated dependency order

```
configuration → database → object-storage → auth → dashboard shell
                         → ota-validation → worker → ota-protocol → publish pipeline
```
