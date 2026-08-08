# Compatibility matrix

> Initial matrix — expand as releases are tested on hardware.

## Platform baseline

| Component | Version / ref |
|-----------|---------------|
| CUSTOM_OS base | GrapheneOS branch `17` (Android 17) |
| Updater app | `platform_packages_apps_Updater` @ `d7e29f110890de68b63bb8c256b4d249a2d29cf9` |
| Metadata generator | `GrapheneOS/script` `generate-metadata` @ `16-qpr2` |
| OTA server URL | `https://release.mod-syria.org/` |
| Object storage | **Self-hosted MinIO** in Docker Compose ([ADR 0005](./adr/0005-storage-self-hosted-minio.md)) |
| Target hardware | **Google Pixel** — registered on demand ([device-models.md](./device-models.md)) |
| Deployment | Docker Compose **or** optional Kubernetes ([deployment.md](./deployment.md)) |
| Load / compression | High load via CDN + horizontal scale; OTA zips **uncompressed** on wire |

## Confirmed human decisions

| Decision | Status |
|----------|--------|
| Target devices = Google Pixel editions | **Confirmed** (2026-08-04) |
| Device registration = on demand (1+ codenames) | **Confirmed** (2026-08-04) |
| Updater change = base URL only (default) | Pending build integration test |
| Per-device % rollout on stock Updater | **Not supported** — see [ADR 0002](./adr/0002-rollout-model.md) |
| Rollout via channel promotion | **Confirmed** — extended with device groups ([ADR 0004](./adr/0004-device-groups-rollout.md)) |
| Device groups + owner notes + gradual stages | **Confirmed** (2026-08-04) |
| Domain `release.mod-syria.org` | **Confirmed** (2026-08-04) |
| Self-hosted MinIO (same Compose) | **Confirmed** (2026-08-04) |
| Large OTA transfers (multi-GB, Range) | **Confirmed** (2026-08-04) |
| Logs with IP + admin monitoring + pause/resume | **Confirmed** (2026-08-04) ([ADR 0006](./adr/0006-logging-monitoring-pause.md)) |

## Protocol features vs server

| Feature | Updater requires | CUSTOM_OS server |
|---------|------------------|------------------|
| Static `{device}-{channel}` metadata | Yes | Publish on approval |
| Full OTA zip | Yes | S3/CDN immutable object |
| Incremental OTA zip | Yes | Optional per source→target pair |
| HTTP Range | Strongly recommended | CDN / nginx |
| Channels stable / beta / alpha | Yes | Dashboard-managed |
| Internal channel (e.g. testing) | Yes | ADB `sys.update.channel` |
| Security preview channel | Yes | `{device}-stable-security-preview` |
| Device codename in URL | Yes | Must match Pixel codename |
| Factory images | No (Updater) | Optional co-host |

## Device coverage (testing status)

Register codenames in the dashboard as CUSTOM_OS builds become available. Example:

| Codename | Pixel model | Protocol tests | Hardware OTA test |
|----------|-------------|----------------|-------------------|
| *(add per device)* | — | Planned Stage 4 | Pending when hardware available |

## Signing compatibility

| Scenario | Expected result |
|----------|-----------------|
| OTA signed with CUSTOM_OS release key | Install succeeds |
| OTA signed with official GrapheneOS key | **Rejected** by device (`verifyPackage` failure) |
| OTA from official GrapheneOS server on CUSTOM_OS build | DoS loop — **must not** point builds at official URL |
