# Observability, logging, and admin monitoring

> See [ADR 0006](./adr/0006-logging-monitoring-pause.md).

## Goals

- Log **every important event** — success and failure.
- Include **client IP** (and `X-Forwarded-For` when behind nginx).
- Give administrators **searchable dashboards**, metrics, and alerts.
- Never leak secrets into logs.

---

## Log pipeline

```
┌────────────┐   JSON stdout    ┌──────────────┐
│ dashboard  │ ───────────────▶ │ Docker logs  │
│ worker     │                  └──────┬───────┘
└────────────┘                         │
┌────────────┐   access log           │ optional: Promtail → Loki
│ nginx      │ ───────────────────────┤
└────────────┘                         ▼
                               ┌──────────────┐
                               │  PostgreSQL  │  AccessLog, AuditLog,
                               │  (indexed)   │  SecurityEvent
                               └──────┬───────┘
                                      ▼
                               /admin/errors
                               /admin/audit
                               /admin/security
```

---

## Log levels and events

| Level | When |
|-------|------|
| `info` | Normal operations (publish, login success, metadata served) |
| `warn` | Retry, slow query, validation warning, rate limit approached |
| `error` | Failed validation, 5xx, upstream MinIO error, auth failure |
| `fatal` | Process crash, migration failure |

### Event catalog (examples)

| `event` | Service | Notes |
|---------|---------|-------|
| `admin.login.success` | dashboard | actorId, clientIp |
| `admin.login.failure` | dashboard | clientIp, generic reason |
| `admin.mfa.required` | dashboard | |
| `rbac.denied` | dashboard | actorId, permission, clientIp |
| `upload.session.created` | dashboard | sessionId, size |
| `upload.session.completed` | dashboard | |
| `validation.job.failed` | worker | jobId, errorCode |
| `release.published` | worker | releaseId, channels |
| `release.paused` | dashboard | scope, reason |
| `release.resumed` | dashboard | |
| `ota.metadata.served` | nginx/app | codename, channel, clientIp |
| `ota.download.started` | nginx/app | codename, bytes, clientIp |
| `ota.download.completed` | nginx/app | status, bytes |
| `security.rate_limited` | dashboard/nginx | clientIp, zone |
| `system.health.degraded` | dashboard | component |

---

## IP address handling

| Source | Field | Example |
|--------|-------|---------|
| Direct connection | `clientIp` | `203.0.113.45` |
| Behind nginx | `clientIp` = first trusted hop | from `X-Real-IP` |
| Proxy chain | `forwardedFor` | `203.0.113.45, 10.0.0.1` |

**RBAC display:**

| Role | Sees |
|------|------|
| `SECURITY_ADMIN`, `SUPER_ADMIN` | Full IP |
| `SUPPORT`, `VIEWER` | Optional `/24` mask (configurable) |

**Retention:** default 90 days for `AccessLog`; audit logs 1 year. Worker job `retention.purge` deletes expired rows.

**Not stored in device telemetry tables** — only in server access/audit logs per admin requirement.

---

## Admin monitoring pages

### `/admin/system-health`

| Widget | Source |
|--------|--------|
| PostgreSQL | `SELECT 1`, connection pool, migration version |
| Redis | PING, memory, queue keys |
| MinIO | health endpoint, bucket size |
| BullMQ | waiting / active / failed counts |
| Disk | MinIO volume usage |
| Services | dashboard/worker last heartbeat |
| **Pause status** | Global / group pause banner |

### `/admin/errors`

- Filter: time range, level, service, event, IP, correlationId
- Server-side pagination
- Expand row → stack trace (sanitized) + linked audit entries
- Export CSV (SECURITY_ADMIN, rate limited, audited)

### `/admin/audit`

- Immutable append-only records
- All pause/resume, publish, role changes, exports

### `/admin/security`

- Failed login heatmap by IP
- Rate limit triggers
- Step-up auth events

### Dashboard home (overview)

- Active devices (if telemetry enabled)
- Update success / failure rate
- Recent errors count
- **Global pause indicator** (red banner when active)

---

## Metrics (Prometheus)

Expose `/metrics` on private network or authenticated scrape.

| Metric | Type | Labels (low cardinality) |
|--------|------|--------------------------|
| `ota_metadata_requests_total` | counter | `status`, `channel` |
| `ota_download_bytes_total` | counter | `codename` |
| `ota_download_errors_total` | counter | `code` |
| `validation_duration_seconds` | histogram | |
| `validation_failures_total` | counter | `reason` |
| `queue_jobs_waiting` | gauge | `queue` |
| `admin_login_failures_total` | counter | |
| `ota_offers_paused` | gauge | `scope` (`global` / `group`) |

**No device IDs in metric labels.**

---

## Optional Docker Compose monitoring profile

```bash
docker compose --profile monitoring up -d
```

Adds (Stage 6):

- **Prometheus** — scrape dashboard/worker/nginx exporter
- **Grafana** — prebuilt dashboards + alert rules
- **Loki + Promtail** — log aggregation (optional)

Config under `infra/monitoring/`.

---

## Alert recommendations

| Alert | Condition |
|-------|-----------|
| High 5xx rate | > 1% for 5m |
| Validation failures | spike vs baseline |
| Queue backlog | waiting > 100 for 15m |
| MinIO disk | > 85% |
| Global pause active | informational |
| Repeated login failures | same IP > 10 in 10m |

---

## Related

- [update-pause-controls.md](./update-pause-controls.md)
- [threat-model.md](./threat-model.md)
