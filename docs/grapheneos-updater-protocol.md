# GrapheneOS Updater Protocol (Verified)

> **Compatibility baseline:** GrapheneOS Android 17 (`17` branch)  
> **Inspected:** 2026-08-04  
> **Status:** Verified from upstream source; do not serve production traffic until contract tests pass against your signing keys and device matrix.

This document describes the **exact** update protocol implemented by the official GrapheneOS Updater application. The server is **not** a REST API. It is a **static HTTPS file origin** with a small set of path conventions.

Changing only the base URL in `packages/apps/Updater/res/values/config.xml` is sufficient for client compatibility, provided the server exposes the expected paths and bytes.

---

## Inspected sources

| Repository | Branch / ref | Commit (tip at inspection) | Purpose |
|------------|--------------|----------------------------|---------|
| [GrapheneOS/platform_packages_apps_Updater](https://github.com/GrapheneOS/platform_packages_apps_Updater) | `17` | `d7e29f110890de68b63bb8c256b4d249a2d29cf9` | Client HTTP behavior, config, channels |
| [GrapheneOS/script](https://github.com/GrapheneOS/script) | `16-qpr2` | `9e3e4ae7c44fc79456851840b7ec52f4061243ae` | `generate-metadata` output format |
| [GrapheneOS/grapheneos.org](https://github.com/GrapheneOS/grapheneos.org) | `main` (process-static) | not pinned | Confirms live channel file naming |
| [GrapheneOS build documentation](https://grapheneos.org/build) | — | — | Update server file layout, channel workflow |
| [GrapheneOS FAQ](https://grapheneos.org/faq) | — | — | Confirms no query/body data sent to server |

### Key client files

- `res/values/config.xml` — base URL and defaults
- `src/app/seamlessupdate/client/Service.java` — all update HTTP requests
- `src/app/seamlessupdate/client/Settings.java` — channel selection
- `src/app/seamlessupdate/client/PeriodicJob.java` — periodic check interval

---

## Configuration (custom OS build)

In `packages/apps/Updater/res/values/config.xml`:

```xml
<string name="url" translatable="false">https://release.mod-syria.org/</string>
<string name="channel_default" translatable="false">stable</string>
```

Requirements:

- Base URL **must** end with `/` (client concatenates `url + path`).
- Build must set `OFFICIAL_BUILD=true` to include the Updater.
- OTA packages must be signed with **your** release keys, not GrapheneOS keys.

---

## Protocol summary

| Property | Value |
|----------|-------|
| Transport | HTTPS only (`HttpsURLConnection` + `ModernTLSSocketFactory`) |
| Methods | `GET` only |
| Request body | None |
| Query parameters | None |
| Custom request headers | None (except `Range` on download resume) |
| Authentication | None |
| Client identity sent to server | **None** (device codename and versions appear only in URL paths) |
| Check interval | ~6 hours (`PeriodicJob`, 6 × 60 × 60 × 1000 ms) |
| Connect / read timeout | 30 seconds each |

---

## HTTP requests (in order)

All paths are relative to the configured base URL.

### 1. Channel metadata fetch

```
GET {DEVICE}-{channel}
```

Examples:

- `GET panther-stable`
- `GET panther-beta`
- `GET panther-alpha`
- `GET panther-testing` (internal; via `adb shell setprop sys.update.channel testing`)
- `GET panther-stable-security-preview` (when security preview toggle enabled in Updater settings)

**Success response**

- Status: `200`
- Body: **exactly one line**, space-separated, trailing newline optional:

```
{post-build-incremental} {post-timestamp} {pre-device} {channel-name}
```

Live example from `https://releases.grapheneos.org/panther-stable`:

```
2026072900 1785291770 panther stable
```

Security preview example (`panther-stable-security-preview`):

```
2026072901 1785291771 panther stable-security-preview
```

Field semantics (from `Service.java` + `generate-metadata`):

| Field | Index | Source in OTA zip | Client use |
|-------|-------|-------------------|------------|
| Target incremental | `[0]` | `post-build-incremental` (from `post-build` segment) | Download file naming; post-download verification |
| Target build date (UTC seconds) | `[1]` | `post-timestamp` | Compared to `ro.build.date.utc`; must be **greater** to offer update |
| Device codename | `[2]` | `pre-device` | Must equal `Build.DEVICE` |
| Channel label | `[3]` | channel name passed to generator | Must equal active channel string |

If `targetBuildDate <= ro.build.date.utc`, the client shows "already updated" and stops.

**Error handling (client)**

- Non-200 / IO failure → update check fails; retry scheduled (unless user-initiated)
- Metadata parse / mismatch → `GeneralSecurityException`, failure notification

---

### 2. Incremental OTA download (attempted first)

```
GET {DEVICE}[-streaming]-incremental-{CURRENT_INCREMENTAL}-{TARGET_INCREMENTAL}.zip
```

- `{CURRENT_INCREMENTAL}` = `Build.VERSION.INCREMENTAL` on device
- `{TARGET_INCREMENTAL}` = metadata field `[0]`
- `-streaming` segment appears only when system property `sys.update.streaming_test=true` (development streaming test mode)

Example:

```
GET panther-incremental-2026072800-2026072900.zip
```

**Client behavior**

- If response is `404`, client closes error stream and falls back to full OTA (commit `715e7bcd`, 2024-11-13).
- If a previous incremental failed during `update_engine` initialization (`errorCode == 20`), client skips incremental and requests full OTA on next run.
- Other non-404 errors do **not** automatically fall back to full OTA.

---

### 3. Full OTA download (fallback)

```
GET {DEVICE}[-streaming]-ota_update-{TARGET_INCREMENTAL}.zip
```

Example:

```
GET panther-ota_update-2026072900.zip
```

---

### 4. Download resume (HTTP Range)

When a partial file exists at `/data/ota_package/update.zip`:

```
GET {same-path-as-above}
Range: bytes={downloaded}-
```

**Client behavior**

- `206 Partial Content` → append to existing file
- `416 Range Not Satisfiable` → treat download as complete; proceed to verify/install
- `404` on resumed **incremental** path → delete partial file; switch to full OTA URL

**Server requirements**

- Correct `Content-Length` for full responses
- Range support strongly recommended for large packages (multi-GB)
- Bytes must be exact; proxy must not transform or recompress bodies

---

## Post-download client verification (not server-side)

The server does not participate in signature verification. The client:

1. Calls `RecoverySystem.verifyPackage()` on the downloaded zip
2. Parses `META-INF/com/android/metadata` and validates:
   - `post-timestamp` matches metadata fetch
   - `post-build-incremental` matches metadata fetch
   - `pre-device` matches `Build.DEVICE`
   - `serialno` must be **absent**
   - `ota-type` must be `AB`
   - For incremental: `pre-build-incremental` and/or `pre-build` match current device
3. Extracts `payload_properties.txt` and applies via `update_engine`
4. Optional streaming mode passes HTTPS URL of **non-streaming** filename to `applyPayload`

**Implication for server:** publish only correctly signed OTA zips produced by your offline signing pipeline. The dashboard validates signatures before publication but does not sign.

---

## Channel model

| Channel | Configurable in UI | Metadata file |
|---------|-------------------|---------------|
| `stable` | Yes (default) | `{device}-stable` |
| `beta` | Yes | `{device}-beta` |
| `alpha` | Yes | `{device}-alpha` |
| `testing` | No (ADB `sys.update.channel`) | `{device}-testing` |
| Arbitrary internal | ADB property | `{device}-{name}` |
| Security preview overlay | Toggle in settings | `{device}-{base}-security-preview` |

Official release workflow (from build docs):

1. Upload OTA zip + `testing` metadata
2. After validation, publish `beta` metadata (same build)
3. After beta soak, publish `stable` metadata

`generate-metadata` writes **four** files (`beta`, `stable`, `alpha`, `testing`) with identical fields except the channel token in field `[3]`.

---

## Static files on the update origin

Minimum set per release (from build docs):

```
{DEVICE}-ota_update-{BUILD_NUMBER}.zip
{DEVICE}-factory-{BUILD_NUMBER}.zip          # initial install / fastboot flash
{DEVICE}-factory-{BUILD_NUMBER}.zip.sig
{DEVICE}-testing                             # metadata text file, not a directory
{DEVICE}-beta                                # metadata (when promoted)
{DEVICE}-stable                              # metadata (when promoted)
```

Incremental packages (no extra metadata):

```
{DEVICE}-incremental-{SOURCE_BUILD_NUMBER}-{TARGET_BUILD_NUMBER}.zip
```

Factory images are not fetched by the Updater app but are commonly co-hosted.

---

## Metadata generation (reference)

From `GrapheneOS/script` `generate-metadata`:

```python
incremental = data["post-build"].split("/")[4].split(":")[0]
print(incremental, data["post-timestamp"], data["pre-device"], channel, file=output)
```

The platform SHOULD reproduce this format byte-for-byte when publishing channel pointers.

---

## Caching semantics

The Updater client does not document explicit cache headers. For production:

- **Metadata files** (`{device}-{channel}`): short TTL or no cache; revalidation on each check (~6h)
- **OTA zips**: immutable URLs → `Cache-Control: public, max-age=31536000, immutable`
- **Range responses**: must remain coherent with full object ETag/Length

Exact header requirements are **version-dependent / uncertain** — contract tests should assert client behavior with and without cache headers.

---

## What the protocol does **not** include

Verified absent from current Updater source:

- JSON/XML APIs
- POST/PUT upload from device
- Device installation IDs or telemetry on update check
- Per-device staged rollout percentage
- Rollback-index negotiation with server
- Server-driven mandatory update flags
- Presigned URLs or auth tokens in download paths

Optional custom telemetry and admin features are **out-of-band** extensions and must not break static compatibility.

---

## Compatibility matrix (initial)

| Feature | Required for Updater | CUSTOM_OS server plan |
|---------|---------------------|------------------------|
| Static metadata files | Yes | Publish from DB on release approval |
| Full OTA zips | Yes | S3/CDN immutable objects |
| Delta/incremental zips | Yes | Co-hosted; exact source incremental match |
| HTTP Range | Strongly recommended | CDN / object storage native support |
| Channel promotion | Yes (official model) | Map to `testing → beta → stable` workflow |
| Per-device % rollout | **No in protocol** | See ADR / open questions |
| Factory images | No (Updater) | Host for ops; optional in same bucket |

---

## Open / uncertain behaviors

| Topic | Status |
|-------|--------|
| Required `Content-Type` for metadata and zips | Not enforced in client Java code; use `text/plain` and `application/zip` as safe defaults |
| ETag / If-None-Match support | Not used by client |
| Maximum redirect count | Default JVM behavior; avoid redirects to third-party origins |
| Alpha channel on all devices | Present in client UI; confirm device coverage for CUSTOM_OS |
| `sys.update.streaming_test` | Dev-only; production server may ignore `-streaming` filenames |
| TLS cipher / cert requirements | `ModernTLSSocketFactory` — test against your CA / public chain |

---

## Contract test checklist

Tests in `tests/protocol/` must cover:

1. Metadata line parsing and field order
2. No update when `post-timestamp <= device timestamp`
3. Device / channel mismatch rejection (client-side; server must not publish wrong metadata)
4. Incremental URL construction from `INCREMENTAL` + metadata
5. 404 incremental → full fallback
6. Range resume append and 416 handling
7. Filename conventions for all supported channels including `stable-security-preview`
8. Published object byte identity (SHA-256)

---

## References

- Updater Service.java: https://github.com/GrapheneOS/platform_packages_apps_Updater/blob/17/src/app/seamlessupdate/client/Service.java
- Updater config.xml: https://github.com/GrapheneOS/platform_packages_apps_Updater/blob/17/res/values/config.xml
- generate-metadata: https://github.com/GrapheneOS/script/blob/16-qpr2/generate-metadata
- Build / update server: https://grapheneos.org/build#update-server
