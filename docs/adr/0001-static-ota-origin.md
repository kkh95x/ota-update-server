# ADR 0001: Static OTA origin compatible with GrapheneOS Updater

## Status

Accepted (Stage 1)

## Context

The project specification describes PostgreSQL models, rollouts, and a management API. Discovery of the current GrapheneOS Updater (`platform_packages_apps_Updater`, branch `17`) shows the client performs only **GET** requests for static paths. There is no JSON update-check API.

## Decision

Implement the **required** Updater-facing surface as a static HTTPS file layout on a public object-storage origin (via nginx/CDN), not as dynamic API routes on Next.js.

The dashboard and worker **publish** files into that layout after validation and approval:

- `{device}-{channel}` metadata pointer files
- `{device}-ota_update-{build}.zip`
- `{device}-incremental-{source}-{target}.zip`

Next.js must not proxy OTA binary traffic.

## Consequences

- Protocol compatibility is proven by static file contract tests and a fake Updater client mirroring `Service.java`.
- Release state lives in PostgreSQL; public channel pointers are **derived artifacts**.
- Per-device percentage rollouts are **not** part of the official protocol (see ADR 0002).

## References

- `docs/grapheneos-updater-protocol.md`
- `Service.java` commit `d7e29f110890de68b63bb8c256b4d249a2d29cf9`
