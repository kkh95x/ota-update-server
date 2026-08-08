# Implementation Plan

## Stage 1 — Discovery and design ✅ (in progress)

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

## Stage 1 — Discovery and design ✅

## Stage 2 — Foundation 🚧 (in progress)

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
- [ ] docker compose full stack verification

## Stage 3 — Release management 🚧 (in progress)

- [x] Device models CRUD (dashboard)
- [x] Releases CRUD + detail view
- [x] Presigned upload to quarantine (MinIO)
- [x] Upload session lifecycle + validation job enqueue
- [x] BullMQ validation worker (basic checks)
- [x] Two-person approval workflow
- [x] Global pause/resume settings UI
- [ ] Full OTA signature/metadata validation
- [ ] Publish pipeline (quarantine → public)

## Stage 4 — Updater-compatible OTA endpoints

- `packages/ota-protocol` — path builders, metadata formatter (match `generate-metadata`)
- Publication worker: quarantine → public prefix
- nginx config for Range, immutable caching, no compression on zips
- Fake Updater client + protocol contract tests
- `docs/updater-integration.md`, `docs/compatibility-matrix.md`

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
                         → worker → ota-validation → ota-protocol → publish pipeline
```
