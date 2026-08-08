# Update pause and resume controls

> Stop **offering** new updates globally or for specific groups/channels.  
> See [ADR 0006](./adr/0006-logging-monitoring-pause.md).

## What pause does

| Effect | Yes / No |
|--------|----------|
| Devices stop **seeing** a newer build on next check | **Yes** |
| Already-downloaded zip removed from device | No |
| Download in progress aborted | No (default)* |
| Audit log + IP recorded | **Yes** |

\*Optional **download freeze** (break-glass): nginx blocks new connections to `*.zip` paths. Use only in incident response.

---

## Pause scopes

```
┌─────────────────────────────────────────────────────────┐
│  GLOBAL          → all channels + all group channels    │
│  GROUP           → e.g. panther-grp-lab-damascus only   │
│  CHANNEL         → e.g. all panther-beta devices        │
│  RELEASE         → one specific release unpublished     │
└─────────────────────────────────────────────────────────┘
```

---

## Admin UI controls

### Global — `/admin/settings`

| Button | Action |
|--------|--------|
| **إيقاف التحديثات للجميع** | Sets `otaOffersPaused=true`; restores metadata snapshots for every active channel |
| **استئناف التحديثات** | Sets `otaOffersPaused=false`; re-publishes approved release metadata |
| Reason field | Required (stored in audit) |

Requires: **step-up authentication** (MFA reconfirm) + role `SECURITY_ADMIN` or `SUPER_ADMIN`.

### Group — `/admin/device-groups/[id]`

| Button | Action |
|--------|--------|
| **إيقاف التحديثات للمجموعة** | `updatesPaused=true` for this group only |
| **استئناف** | Re-publish current approved metadata for group channel |

Shows: paused since, paused by, reason, affected codenames.

### Release — `/admin/releases/[id]`

| Button | Action |
|--------|--------|
| **إيقاف هذا الإصدار** | `Release.status=PAUSED`; remove its metadata pointers |
| **استئناف** | Re-publish if validation + approval still valid |

### Channels — `/admin/channels`

Pause/resume per standard channel (`stable`, `beta`, `alpha`) across selected device models.

---

## Technical mechanism (Updater-safe)

The Updater **must not** receive `404` on metadata fetch (causes error notification).  
On pause, the server **restores the previous snapshot** of the metadata file:

```
# Before publish of build 2026080100, snapshot stored:
panther-stable → "2026072900 1785291770 panther stable"

# After pause — same file restored:
panther-stable → "2026072900 1785291770 panther stable"
```

Device with build `2026072900` → «already updated».  
Device still on older build → offered previous chain (not the paused release).

On **resume**, publication worker writes the approved new metadata line again.

### Snapshot storage

`ChannelSnapshot` table:

| Column | Description |
|--------|-------------|
| `deviceModelId` | e.g. panther |
| `channelKey` | `stable`, `grp-lab-damascus`, … |
| `metadataBody` | Exact single line bytes |
| `objectKey` | MinIO key if stored as object |
| `createdAt` | When snapshot taken |

Snapshot taken **automatically before every publish**.

---

## Logging on pause / resume

Each action writes:

1. **AuditLog** — actor, action, target, reason, `clientIp`, `forwardedFor`, correlationId  
2. **SecurityEvent** — `severity=high` for global pause  
3. **Structured stdout log** — `release.paused` / `release.resumed`  
4. Optional **Grafana annotation**

Example audit metadata (sanitized):

```json
{
  "action": "ota.pause.global",
  "reason": "تحقيق في فشل التثبيت",
  "clientIp": "203.0.113.45",
  "forwardedFor": "203.0.113.45",
  "previousState": "offers_active",
  "channelsAffected": 12
}
```

---

## Automatic pause (existing plan)

Rollout auto-halt on excessive failures (from `project.md`):

- Sets release or rollout stage to `PAUSED`
- **Does not** delete OTA zip
- Alerts administrators
- Distinct from manual global pause (can coexist)

---

## API (management — admin auth required)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/ota/pause/global` | Body: `{ "reason": "..." }` |
| `POST` | `/api/admin/ota/resume/global` | Body: `{ "reason": "..." }` |
| `POST` | `/api/admin/ota/pause/groups/{id}` | Group pause |
| `POST` | `/api/admin/ota/resume/groups/{id}` | Group resume |
| `GET` | `/api/admin/ota/pause/status` | Current pause state all scopes |

All endpoints: CSRF token, RBAC, rate limit, audit.

---

## Database fields summary

| Entity | Fields |
|--------|--------|
| `SystemSetting` | `otaOffersPaused`, `otaDownloadsFrozen`, `globalPauseReason`, `pausedAt`, `pausedById` |
| `DeviceGroup` | `updatesPaused`, `pauseReason`, `pausedAt`, `pausedById` |
| `Release` | `status` includes `PAUSED` |
| `ReleaseChannel` | `paused` per model+channel |
| `ChannelSnapshot` | historical metadata for rollback |

---

## Related

- [device-groups-and-rollouts.md](./device-groups-and-rollouts.md)
- [observability-and-logging.md](./observability-and-logging.md)
