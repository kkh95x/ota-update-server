# ADR 0006: Structured logging, IP capture, admin monitoring, and update pause controls

## Status

Accepted (2026-08-04)

## Context

Human requirement:

- **Logs for all cases**, including errors, with **client IP** visibility for administrators.
- **Full monitoring toolkit** in the admin dashboard.
- **Pause / resume** offering new updates — globally or for specific groups — with ability to resume.

Constraints from `project.md`:

- Do not log authorization headers, session tokens, presigned URLs, or hardware device identifiers.
- Device privacy on optional telemetry remains separate from **server access logs**.
- Fail closed on security events; audit append-only.

## Decision

### 1. Structured logging (all services)

Every service (`dashboard`, `worker`, `nginx` access) emits **JSON logs** to stdout for Docker/Loki collection.

Standard fields:

| Field | Description |
|-------|-------------|
| `timestamp` | ISO-8601 UTC |
| `level` | debug / info / warn / error / fatal |
| `service` | dashboard / worker / nginx |
| `event` | Stable enum e.g. `ota.metadata.request` |
| `correlationId` | Request trace ID |
| `clientIp` | Client IP (see §2) |
| `forwardedFor` | Raw `X-Forwarded-For` chain when behind nginx |
| `actorId` | Admin user ID when authenticated |
| `targetType` / `targetId` | Resource affected |
| `result` | success / failure |
| `errorCode` | Machine code on failure |
| `message` | Human-readable (sanitized) |
| `metadata` | Extra JSON — never secrets |

**Logged cases (minimum):**

- Admin auth (login, logout, MFA, failure)
- RBAC denial
- Upload session create/complete/fail
- Validation job start/complete/fail
- Release approve / publish / pause / resume / revoke
- Rollout stage advance / skip
- Global or group OTA pause / resume
- OTA metadata GET (per request summary)
- OTA package GET/Range (summary — not per-chunk spam)
- nginx/upstream 5xx
- Worker crashes, queue failures
- Security events (rate limit, suspicious path)

**Never log:** `Authorization`, cookies, presigned query strings, full OTA URLs with tokens, passwords, TOTP seeds.

### 2. IP address policy

| Log type | IP storage | Admin visibility |
|----------|------------|------------------|
| Admin dashboard/API | Full `clientIp` + `forwardedFor` | SECURITY_ADMIN / SUPER_ADMIN full; SUPPORT masked `/24` optional |
| OTA metadata/download | Full `clientIp` in `AccessLog` row | `/admin/errors`, `/admin/audit` with RBAC |
| Optional device telemetry | Pseudonymous hash default; full IP **not** stored persistently | N/A |

Retention: configurable `RetentionPolicy` (default 90 days access logs, 365 days audit). Purge job in worker.

nginx `log_format` includes `$remote_addr` and `$http_x_forwarded_for` — shipped to app aggregator or parsed to DB for dashboard search.

### 3. Admin monitoring surfaces

| Route | Content |
|-------|---------|
| `/admin/system-health` | DB, Redis, MinIO, queue depth, disk, service up/down |
| `/admin/errors` | Error log stream with filters (level, service, IP, time) |
| `/admin/audit` | Immutable audit trail |
| `/admin/security` | Security events, failed logins, rate limits |
| Dashboard home | KPI cards: check rate, error rate, rollout status, **pause banner** |

**Metrics (Prometheus):** optional Compose profile `monitoring` — Prometheus + Grafana dashboards.

**Traces (OpenTelemetry):** correlation ID links dashboard → worker → DB.

Alerts (Grafana or webhook): 5xx spike, validation failures, queue backlog, pause activated.

### 4. Pause / resume update offers

**Semantics:** Pause stops **offering new updates** (metadata points away from new build). In-progress downloads may complete unless emergency **download freeze** enabled (nginx `limit_conn 0` on zip paths — optional break-glass).

| Scope | Control | Mechanism |
|-------|---------|-----------|
| **Global** | `/admin/settings` — «إيقاف التحديثات للجميع» | `SystemSetting.otaOffersPaused=true`; restore **channel snapshots** taken before last publish |
| **Group** | `/admin/device-groups/[id]` | `DeviceGroup.updatesPaused=true`; revert `{codename}-{groupSlug}` metadata only |
| **Release** | `/admin/releases/[id]` | `Release.status=PAUSED`; unpublish its metadata pointers |
| **Channel** | `/admin/channels` | Pause `beta` / `stable` / `alpha` independently |

**Resume:** reverses flag + re-publishes current approved metadata from DB (or explicit snapshot ID). Requires step-up auth for global pause/resume.

Each action creates `AuditLog` + `SecurityEvent` with actor, reason, IP, timestamp.

**Updater compatibility:** Paused channel serves **previous snapshot** metadata (same line format) so clients see «already updated» instead of 404 errors.

### 5. Database additions

- `AccessLog` — structured OTA/admin HTTP summary + `clientIp`
- `SystemSetting` — `otaOffersPaused`, `otaDownloadsFrozen` (optional)
- `DeviceGroup.updatesPaused`, `pauseReason`, `pausedAt`, `pausedById`
- `ChannelSnapshot` — content hash + metadata body per `{device}-{channel}` before each publish
- Extend `AuditLog` with `clientIp`, `forwardedFor`

## Consequences

- Implement `packages/observability` early (Stage 2).
- Dashboard error/log viewers with pagination — no loading all rows in browser.
- Pause/resume in Stage 5 alongside rollouts; snapshot logic in publication worker.
- Privacy policy documents IP retention for server logs vs device telemetry.

## Human confirmation

**Confirmed:** comprehensive logs with IP, admin monitoring tools, global/group pause and resume.
