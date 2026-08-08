# Device groups, notes, and gradual rollout

> **Confirmed (2026-08-04):** Administrators can create device groups, add owner/responsible notes per device, target **selected group(s) or all**, and roll out **gradually** in stages.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard (admin)                                          │
│  • Device groups: «مختبر دمشق», «فريق الحقل», …            │
│  • Per-device note: «جهاز أحمد — Pixel 7»                   │
│  • Rollout: اختر مجموعة / مجموعات / الكل → مراحل تدريجية   │
└──────────────────────────┬──────────────────────────────────┘
                           │ publish metadata per stage
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Public OTA origin                                          │
│  panther-grp-lab-damascus  → build 2026080100               │
│  panther-grp-field-team    → (next stage)                   │
│  panther-beta / panther-stable → (final promotion)          │
└──────────────────────────┬──────────────────────────────────┘
                           │ GET (Updater)
                           ▼
                     Pixel devices
```

## Device groups

### Create a group

| Field | Example |
|-------|---------|
| Name | `مختبر دمشق` |
| Slug (internal channel) | `grp-lab-damascus` |
| Description | أجهزة الاختبار الداخلية |
| Admin note | جهات الاتصال، ساعات العمل، … |

The **slug** becomes the Updater channel name via `sys.update.channel`.

### Add devices to a group

A device entry (`DeviceInstallation`) can belong to **multiple groups**.

Ways to add:

1. **Manual** — admin creates installation record and assigns groups.
2. **From opt-in report** — device sends `installationId`; admin assigns groups later.
3. **Bulk import** — CSV with `installationId`, `ownerLabel`, `groupNames` (authorized roles only, audited).

## Per-device notes

| Field | Visible to | Example |
|-------|------------|---------|
| `ownerLabel` | Admins | `أحمد محمد — قسم IT` |
| `adminNote` | Admins | `SN مخفي — لا تُخزَّن`; `تم التسليم 2026-07-01` |
| `deviceModel` | Admins | `panther` (Pixel 7) |
| `currentBuild` | Admins | From last opt-in report |

**Privacy:** no IMEI, serial, MAC, or phone number. Owner identity is **admin-entered text**, not harvested from hardware.

## Rollout wizard

### Step 1 — Choose target

| Option | Behavior |
|--------|----------|
| **Selected groups** | Pick one or more groups from list |
| **All groups** | All active groups in sort order |
| **All (production)** | Skip group stages; target `beta` / `stable` only |

### Step 2 — Gradual stages

Example: release `2026080100` for `panther`

| Stage | Target | Action |
|-------|--------|--------|
| 1 | Group `grp-lab-damascus` | Publish `panther-grp-lab-damascus` metadata |
| 2 | Group `grp-field-team` | Publish `panther-grp-field-team` metadata |
| 3 | Note | «مراقبة 48 ساعة — لا مشاكل» |
| 4 | Channel `beta` | Publish `panther-beta` |
| 5 | Channel `stable` | Publish `panther-stable` |

Each stage supports:

- **Optional note** (why, who approved, observations)
- **Manual advance** — operator clicks «Next stage»
- **Scheduled advance** — optional auto-start after N hours
- **Pause / rollback stage** — remove metadata pointer; OTA zip stays immutable

### Step 3 — Confirm

Two-person approval still applies before first stage goes live.

## Device-side setup (group channel)

Devices in a group must use that group's internal channel during staged rollout:

```bash
adb shell setprop sys.update.channel grp-lab-damascus
```

Document in CUSTOM_OS provisioning guide. When rollout completes to `stable`, user switches Updater channel back to **Stable** in settings (or provisioning sets `stable`).

Official Updater already supports arbitrary channel names via system property — same mechanism as GrapheneOS `testing` channel.

## Database entities (summary)

| Model | Role |
|-------|------|
| `DeviceGroup` | Named set + `internalChannelSlug` + notes |
| `DeviceGroupMember` | Many-to-many: installation ↔ group |
| `DeviceInstallation` | UUID, ownerLabel, adminNote, model, last seen |
| `Rollout` | Release + target mode (SELECTED_GROUPS / ALL_GROUPS / CHANNELS_ONLY) |
| `RolloutStage` | Ordered stage: group or channel, status, note, timestamps |

## Dashboard routes (planned)

| Route | Function |
|-------|----------|
| `/admin/device-groups` | List / create / edit groups |
| `/admin/device-groups/[id]` | Members, channel slug, rollout history |
| `/admin/devices/[id]` | Owner note, group membership |
| `/admin/rollouts/new` | Target picker: groups / all / channels |
| `/admin/rollouts/[id]` | Stage timeline, notes, advance / pause |

## Pause / resume (group scope)

| Control | Location |
|---------|----------|
| **إيقاف التحديثات للمجموعة** | `/admin/device-groups/[id]` |
| **استئناف** | Same page — re-publishes group channel metadata |

Global pause for all devices: `/admin/settings` — see [update-pause-controls.md](./update-pause-controls.md).

## Limits (stock Updater)

| Need | Supported? | How |
|------|------------|-----|
| Rollout to group A only | Yes | Internal channel per group |
| Rollout to group A then B gradually | Yes | Rollout stages |
| Owner note in dashboard | Yes | Admin fields |
| Rollout to «27% of stable» without channel change | No | Requires Updater patch |
| Target device by hardware serial | No | Privacy policy |

## Related documents

- [ADR 0004](./adr/0004-device-groups-rollout.md)
- [ADR 0002](./adr/0002-rollout-model.md) — channel promotion baseline
- [device-models.md](./device-models.md) — Pixel codenames on demand
