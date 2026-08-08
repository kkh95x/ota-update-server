# ADR 0004: Device groups, owner notes, and group-targeted gradual rollout

## Status

Accepted (2026-08-04)

## Context

Human requirement:

- Create **device groups** (full named sets of devices).
- Add **notes per device** (e.g. owner / responsible person).
- When rolling out an release, choose **selected group(s)** or **all**.
- Roll out **gradually as needed** (not necessarily everyone at once).

The stock GrapheneOS Updater still does not send a device identifier on OTA checks. Group targeting must therefore use a **protocol-compatible channel mapping**, plus optional opt-in installation registry for admin visibility.

## Decision

### 1. Two layers

| Layer | Purpose |
|-------|---------|
| **Admin registry** | Groups, installations, owner notes — organizational |
| **OTA delivery** | Internal release channel per group (or shared channel) — technical |

### 2. Device groups

- Administrators create `DeviceGroup` records (name, description, optional admin note).
- A device (installation) may belong to **zero or more** groups.
- Groups are independent of Pixel codename — a group may contain installations on different models.

### 3. Device installations and notes

- Each tracked device has a random `installationId` (UUID v4) — **not** hardware IDs.
- Fields: `ownerLabel`, `adminNote` (free text — e.g. «جهاز أحمد — مختبر دمشق»), `deviceModel`, current build snapshot (from opt-in reports).
- Registration paths:
  - **Manual:** admin pre-registers before handing device to user.
  - **Opt-in report:** device sends installation ID via optional telemetry (disabled globally if not wanted).

Notes are **admin-only**; never exposed on public OTA endpoints.

### 4. Group ↔ internal channel (OTA bridge)

Each group may have an **`internalChannelSlug`** (e.g. `grp-lab-damascus`, lowercase, URL-safe).

Devices in that group are configured to check updates on that channel:

```bash
adb shell setprop sys.update.channel grp-lab-damascus
```

(or equivalent documented provisioning in CUSTOM_OS)

Publication for group `grp-lab-damascus` on model `panther` writes:

```
panther-grp-lab-damascus   → metadata line pointing to release build
panther-ota_update-….zip    → same artifact as other channels when promoted
```

This uses the **existing** Updater behavior for arbitrary internal channels (same as official `testing` channel).

### 5. Rollout targeting (dashboard)

When publishing a release, administrator chooses:

| Target mode | Meaning |
|-------------|---------|
| **Selected groups** | One or more groups — rollout stages per group (see below) |
| **All groups** | Every defined group, in configured order, then optional promotion to beta/stable |
| **All devices (production)** | Final promotion to `beta` / `stable` metadata — all users on those channels |

**Gradual rollout** = ordered **rollout stages**:

1. Stage 1 → publish metadata to group A internal channel only  
2. Stage 2 → group B (after admin confirms or automatic timer)  
3. …  
4. Final stage → `beta` and/or `stable` (all devices on that channel)

Each stage supports an optional **stage note** (reason, incident link, operator name).

Pause / resume / skip stage supported without deleting the OTA artifact.

### 6. What this is NOT (without Updater patch)

- Cannot target «group A only» while those devices stay on **`stable`** channel — they must use the group internal channel (or a dedicated beta sub-channel) during staged rollout.
- Cannot do «27% of stable channel» per device on stock Updater — use sequential groups instead.

### 7. Default channels unchanged

`stable`, `beta`, `alpha`, `testing` remain as today. Groups add **additional** internal channel names; they do not replace the standard channel model.

## Consequences

- Prisma: `DeviceGroup`, `DeviceGroupMember`, extended `DeviceInstallation`, `RolloutStage` linked to groups.
- Dashboard routes: `/admin/device-groups`, group picker on rollout wizard, notes on `/admin/devices/[id]`.
- Docs: `device-groups-and-rollouts.md`, provisioning section in `updater-integration.md` (Stage 4).
- Protocol tests: metadata file for `{codename}-grp-*` paths.

## Human confirmation

**Confirmed:** groups + notes + select groups or all + gradual stages as needed.
