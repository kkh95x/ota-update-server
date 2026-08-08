# Device models — Google Pixel (CUSTOM_OS)

> **Human confirmation (2026-08-04):** Target devices are **Google Pixel** editions supported by the GrapheneOS-based CUSTOM_OS build (branch `17` / Android 17).

> **Human confirmation (2026-08-04):** Device models are added **on demand** — one or more codenames as needed. There is **no** requirement to enable all Pixel models at launch.

Each row uses the **device codename** (`Build.DEVICE`) that appears in OTA paths and metadata (`pre-device`).

## Registration model

| Aspect | Policy |
|--------|--------|
| Initial seed | **Empty** or minimal — no bulk import of all codenames |
| Adding devices | Administrator registers codename via dashboard (`/admin/device-models`) |
| Minimum at launch | **1+ Pixel codenames** — whatever CUSTOM_OS currently builds |
| Eligible codenames | Any Pixel codename from the GrapheneOS 17 list below |
| OTA publish | Only for **registered and active** `DeviceModel` rows |

The platform must reject uploads/releases for unknown or inactive codenames even if the codename exists in the reference table.

## Reference: eligible Pixel codenames (GrapheneOS 17)

Use this table when registering a device — not as an automatic seed list.

| Codename | Product |
|----------|---------|
| `stallion` | Pixel 10a |
| `rango` | Pixel 10 Pro Fold |
| `mustang` | Pixel 10 Pro XL |
| `blazer` | Pixel 10 Pro |
| `frankel` | Pixel 10 |
| `tegu` | Pixel 9a |
| `comet` | Pixel 9 Pro Fold |
| `komodo` | Pixel 9 Pro XL |
| `caiman` | Pixel 9 Pro |
| `tokay` | Pixel 9 |
| `akita` | Pixel 8a |
| `husky` | Pixel 8 Pro |
| `shiba` | Pixel 8 |
| `felix` | Pixel Fold |
| `tangorpro` | Pixel Tablet |
| `lynx` | Pixel 7a |
| `cheetah` | Pixel 7 Pro |
| `panther` | Pixel 7 |
| `bluejay` | Pixel 6a |
| `raven` | Pixel 6 Pro |
| `oriole` | Pixel 6 |

Source: [GrapheneOS build targets](https://grapheneos.org/build) (development branch `17`).

## Server implications (per registered codename)

For each **active** codename the platform must support:

- `DeviceModel` record in PostgreSQL
- Per-device channel metadata files: `{codename}-stable`, `{codename}-beta`, etc.
- Per-device OTA artifacts:
  - `{codename}-ota_update-{BUILD_NUMBER}.zip`
  - `{codename}-incremental-{SOURCE}-{TARGET}.zip` (when published)
- Validation rule: `pre-device` in OTA metadata must match the registered codename

Unregistered codenames have **no** channel metadata on the public origin.

## Out of scope

- Non-Pixel devices
- SDK emulator target `sdk_phone64_x86_64` (development only; not production OTA)
