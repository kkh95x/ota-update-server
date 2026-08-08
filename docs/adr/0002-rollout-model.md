# ADR 0002: Rollout model — channel promotion first



## Status



Accepted (2026-08-04) — extended by [ADR 0004](./0004-device-groups-rollout.md)



## Context



The project requires deterministic staged rollouts using installation ID + keyed hash. The verified GrapheneOS Updater sends **no device identifier** on update checks. The server cannot assign per-device buckets from protocol data alone.



Official GrapheneOS uses **channel promotion**: `testing` → `beta` → `stable` metadata updates.



## Decision



**Baseline (protocol-compatible):**



- Rollout = publishing metadata to progressively wider **channels**.

- Same OTA zip; different `{device}-{channel}` pointer files.

- Emergency pause = revert or remove channel pointer / revoke release in DB + unpublish pointer.



**Extended (human confirmed — ADR 0004):**



- **Device groups** map to **internal channels** (`grp-*`).

- Gradual rollout = ordered stages: selected group(s) → optional `beta` → `stable`.

- Target **selected groups**, **all groups**, or **production channels (all on stable/beta)**.

- Per-device **owner/admin notes** in dashboard only.



**Optional telemetry (Phase 2):**



- Custom endpoint with random `installationId` for inventory and stage monitoring.

- Does **not** gate OTA unless paired with group channel provisioning.



**Do not** pretend per-device `%` on the **`stable`** channel works without Updater changes.



## Alternatives considered



| Option | Rejected because |

|--------|------------------|

| Modify Updater to send installation ID | Not required if group internal channels are used |

| Time-based partial metadata on stable | All stable devices see update simultaneously |

| CDN edge logic without client ID | Cannot target subsets on same channel |



## References



- [device-groups-and-rollouts.md](../device-groups-and-rollouts.md)


