You are a principal software architect, senior Next.js engineer, Android OTA engineer, DevSecOps engineer, and application-security reviewer.

Build a production-ready, self-hosted OTA update management platform for a custom Android operating system based on the open-source GrapheneOS project.

The system must distribute OTA packages to supported Google Pixel devices through the official GrapheneOS Updater application included in our custom OS builds.

Our OTA server domain is:

https://release.mod-syria.org

The administrative dashboard should initially be available at:

https://release.mod-syria.org/admin

Before writing implementation code, inspect the current GrapheneOS source and official documentation. Do not invent an OTA protocol.

The GrapheneOS build will use:

OFFICIAL_BUILD=true

The Updater application server URL will be changed in:

packages/apps/Updater/res/values/config.xml

Replace the official GrapheneOS update server URL with:

https://release.mod-syria.org

Important project identity rule:

This is a distinct custom operating system based on GrapheneOS. Do not present it as an official GrapheneOS release. Use neutral placeholders such as `CUSTOM_OS_NAME` throughout the code and documentation.

# Primary objective

Create a secure monorepo containing:

1. A server implementing the exact API and file layout expected by the current official GrapheneOS Updater app.
2. A professional Next.js administrative dashboard.
3. PostgreSQL database models.
4. S3-compatible OTA package storage.
5. Background workers for validating uploaded OTA packages.
6. Device update reporting with privacy-preserving device identifiers.
7. Staged rollout management.
8. Secure authentication, authorization, auditing, monitoring, backups, and deployment configuration.
9. Complete documentation for integrating the server URL into a custom GrapheneOS build.
10. Automated tests that prove protocol compatibility and prevent unsafe releases.

# Mandatory discovery phase

Do not start by guessing endpoints or response schemas.

First:

1. Inspect the current GrapheneOS Updater source code.
2. Locate the configuration containing the update server URL.
3. Identify every HTTP request performed by the Updater.
4. Document:

   * HTTP methods.
   * Endpoint paths.
   * Query parameters.
   * Request headers.
   * Expected response formats.
   * Release-channel behavior.
   * Device codename handling.
   * Build-number handling.
   * Full OTA handling.
   * Delta OTA handling.
   * Hash and signature expectations.
   * Retry and caching behavior.
   * Error handling.
5. Inspect the current GrapheneOS server-side implementation or website configuration used to serve OS updates when publicly available.
6. Produce `docs/grapheneos-updater-protocol.md`.
7. Add source links and the inspected Git commit hashes.
8. Clearly mark every uncertain or version-dependent behavior.
9. Implement only behavior verified from current source code.
10. Stop with a clear diagnostic error when compatibility cannot be safely established.

The server must preserve compatibility with the official Updater app after only changing its configured base URL. Do not require arbitrary modifications to the Updater protocol merely to fit the dashboard backend.

# Safety constraints

Never:

* Store Android release-signing private keys on the web server.
* Store AVB private keys in the dashboard.
* Generate production OTA signing keys in a web request.
* Sign Android releases inside Next.js.
* expose secrets to the browser.
* trust uploaded filenames or MIME types.
* trust metadata supplied by an administrator without extracting and verifying it.
* serve an OTA before all validation checks pass.
* allow an incremental OTA to target an incompatible source build.
* allow release downgrades or rollback-index regressions.
* collect IMEI, hardware serial number, phone number, MAC address, account data, installed-app lists, contacts, location, or advertising identifiers.
* log authorization headers, session tokens, presigned URLs, complete IP addresses, or sensitive device identifiers.
* silently bypass a failed signature check.
* use test keys for a production release.
* proxy multi-gigabyte files through Next.js.
* execute scripts or binaries extracted from uploaded archives.
* automatically publish a package immediately after upload.
* assume TLS alone proves OTA authenticity.

All Android OS and OTA signing must happen in a separate offline signing environment or approved HSM-backed release pipeline.

The server receives only already-signed release artifacts and validates them before publication.

# Architecture

Use a TypeScript monorepo with pnpm workspaces and Turborepo.

Preferred structure:

apps/
dashboard/
worker/

packages/
database/
auth/
authorization/
configuration/
ota-protocol/
ota-validation/
object-storage/
observability/
rate-limiting/
shared/
ui/

infra/
docker/
nginx/
scripts/
monitoring/

docs/

Use:

* Current stable Next.js with App Router.
* TypeScript strict mode.
* React Server Components by default.
* Client components only where necessary.
* PostgreSQL.
* Prisma ORM.
* Redis.
* BullMQ or an equivalent maintained Redis-backed queue.
* S3-compatible storage.
* MinIO for local development.
* An abstraction compatible with Amazon S3, Cloudflare R2, and MinIO.
* Auth.js or an equally secure maintained authentication framework.
* Zod for runtime validation.
* Structured JSON logging.
* OpenTelemetry.
* Prometheus-compatible metrics.
* Docker Compose for local development.
* Production-ready container images.
* Nginx or Caddy as reverse proxy.
* Vitest for unit and integration tests.
* Playwright for dashboard end-to-end tests.

Pin dependency versions and include an automated dependency-update strategy.

# Network separation

Design separate logical trust zones:

1. Public OTA API and download endpoints.
2. Administrative dashboard and management API.
3. Background validation worker.
4. PostgreSQL.
5. Redis.
6. Private S3-compatible storage management endpoint.
7. Public or CDN-backed immutable download origin.
8. External offline signing environment.

The dashboard must not have access to Android signing private keys.

Database, Redis, and MinIO administrative interfaces must not be exposed publicly.

Support future separation into:

* `release.mod-syria.org` for OTA endpoints.
* `admin.mod-syria.org` for administration.
* `cdn.mod-syria.org` for immutable package delivery.

Keep origins configurable through environment variables.

# Database design

Create normalized Prisma models for at least:

* AdminUser
* AdminSession
* Role
* Permission
* AdminRole
* DeviceModel
* DeviceInstallation
* Release
* OtaPackage
* ReleaseChannel
* Rollout
* RolloutRule
* UpdateCheck
* InstallationEvent
* UploadSession
* ValidationJob
* ValidationResult
* ReleaseApproval
* ReleaseRevocation
* AuditLog
* SecurityEvent
* SystemSetting
* ApiCredential, only when necessary
* RetentionPolicy

Use explicit enums for statuses.

A release should include:

* Internal immutable ID.
* Human-readable version.
* Build ID.
* Incremental build number.
* Build fingerprint.
* Android version.
* Security patch level.
* Device codename.
* Channel.
* Status.
* Changelog.
* Minimum source build where applicable.
* Rollback index or verified equivalent metadata.
* Creation time.
* Validation time.
* Approval time.
* Publication time.
* Paused time.
* Revocation time.
* Package references.
* Rollout configuration.

An OTA package should include:

* Package type: full or incremental.
* Source build identity for incremental packages.
* Target build identity.
* Object-storage key.
* Original sanitized filename.
* Byte size.
* SHA-256.
* Extracted OTA metadata.
* Payload metadata where applicable.
* Signature-validation status.
* Validation report.
* Upload administrator.
* Immutable creation timestamp.

Use database constraints and transactions to prevent:

* Duplicate target builds for a device and channel.
* Multiple active packages with conflicting source and target builds.
* Publication before successful validation.
* Publication without required approval.
* Invalid rollout percentages.
* Changes to immutable published package fields.

# Device privacy

Device inventory must be privacy-preserving and opt-in where reporting goes beyond ordinary update checks.

Use a randomly generated installation identifier, not a hardware identifier.

Document which data is required by the official Updater protocol and which data belongs to optional custom telemetry.

Optional device data may include only:

* Random installation ID.
* Device codename.
* Current build ID.
* Current incremental version.
* Update channel.
* Security patch level.
* Updater client version.
* Last update status.
* Coarse battery state when necessary.
* Coarse free-storage range when necessary.
* First-seen and last-seen timestamps.

Do not collect exact IP addresses persistently. Use short-lived security processing and store only a keyed, rotating pseudonymous hash when abuse prevention requires it.

Provide retention jobs that delete old update checks, events, IP-derived hashes, and unnecessary telemetry.

Document user consent and provide a global server-side switch to disable optional telemetry.

The official Updater compatibility endpoints must continue functioning when optional telemetry is disabled.

# OTA package upload flow

Implement direct multipart upload to object storage:

1. Administrator creates an upload session.
2. Server authorizes the operation.
3. Server creates a restricted, short-lived presigned multipart upload.
4. Browser uploads directly to S3-compatible storage.
5. Browser notifies the application that upload is complete.
6. Server verifies object existence and expected size.
7. Server enqueues a validation job.
8. Worker streams the object without loading it fully into memory.
9. Worker validates the package.
10. Package remains quarantined until validation succeeds.
11. Another authorized administrator approves publication.
12. Publication activates metadata and immutable package URLs.

Apply:

* Upload-size limits.
* Upload expiration.
* Restricted bucket and object prefix.
* Random server-generated object keys.
* Multipart cleanup.
* Checksums where supported.
* Quarantine and published buckets or prefixes.
* No executable permission.
* No direct public access to quarantined objects.

# OTA validation pipeline

Implement a defensive validation pipeline.

At minimum:

1. Verify maximum file size.
2. Verify file type from content, not extension.
3. Validate ZIP structure.
4. Reject path traversal entries.
5. Reject absolute paths.
6. Reject duplicate dangerous entries.
7. Reject unsupported compression behavior.
8. Protect against ZIP bombs using:

   * Entry-count limits.
   * Per-entry uncompressed-size limits.
   * Total uncompressed-size limits.
   * Compression-ratio limits.
9. Parse Android OTA metadata safely.
10. Verify the target device codename.
11. Verify source and target build identities.
12. Verify package type.
13. Verify Android version and security patch metadata.
14. Verify rollback-related metadata when available.
15. Verify cryptographic package signatures using configured trusted public certificates.
16. Verify payload properties expected by Android update_engine.
17. Compute SHA-256 while streaming.
18. Compare administrator-provided information against extracted information.
19. Produce a machine-readable and human-readable validation report.
20. Fail closed for unknown critical metadata.

Use maintained Android release tools or safely invoke trusted platform tools in a sandboxed worker when required. Do not create a fake custom signature verifier.

If external Android tools are needed:

* Pin their source/version.
* Run them in a locked-down container.
* Disable outbound network access.
* Use a read-only filesystem where practical.
* Set CPU, memory, process, and execution-time limits.
* Never interpolate untrusted strings into shell commands.
* Pass arguments as an array.
* Save complete tool-version information in the validation report.

# GrapheneOS Updater compatibility

Implement the exact current server behavior expected by the official GrapheneOS Updater app.

Requirements:

* The only Updater change should be the configured base server URL unless current source proves other branding changes are necessary.
* Preserve expected release-channel semantics.
* Preserve expected device codename behavior.
* Preserve current build and incremental build matching.
* Return exact content types and schema.
* Support full OTA packages.
* Support delta OTA packages exactly when compatible.
* Prefer the most appropriate delta package for an exact source build.
* Fall back to a full package when no compatible delta exists.
* Never offer a delta for a nonmatching source build.
* Never offer a package for another device.
* Never offer an older build.
* Never offer draft, quarantined, failed, paused, or revoked releases.
* Respect staged rollout eligibility.
* Use deterministic rollout assignment.
* Preserve required caching semantics.
* Support HTTP Range requests if required by the client or delivery architecture.
* Use immutable file URLs.
* Keep old published package files available while devices may still reference them.
* Add protocol contract tests based on fixtures derived from the inspected Updater source.

Create:

* `docs/grapheneos-updater-protocol.md`
* `docs/updater-integration.md`
* `docs/compatibility-matrix.md`
* `tests/protocol/`

The documentation must identify the GrapheneOS source revision against which compatibility was tested.

# Rollout algorithm

Implement deterministic staged rollouts.

Use a cryptographic keyed hash over:

* Privacy-preserving device installation ID when available.
* Release ID.
* A server-side rollout secret.

Map the result into a stable bucket from 0 to 9,999.

Support percentages with two-decimal precision.

A device assigned to a release must remain consistently eligible while the rollout percentage grows.

Do not use Math.random().

Support:

* Internal channel.
* Beta channel.
* Stable channel.
* Per-device-model rollouts.
* Start and end times.
* Pausing.
* Resuming.
* Emergency revocation.
* Manual allowlist for laboratory devices.
* Exclusion rules.
* Minimum current build.
* Mandatory updates where justified.
* Automatic halt thresholds.

Automatic halt examples:

* Excessive download failures.
* Excessive package-verification failures.
* Excessive installation failures.
* Excessive rollback reports.
* Unexpected server-error rate.

Automatic halting must never automatically revoke or delete a package. It should pause offering the release and alert administrators.

# Administrative dashboard

Create a polished, accessible, responsive dashboard.

Required routes:

/admin/login
/admin
/admin/releases
/admin/releases/new
/admin/releases/[id]
/admin/uploads
/admin/devices
/admin/devices/[id]
/admin/device-models
/admin/channels
/admin/rollouts
/admin/installations
/admin/errors
/admin/security
/admin/audit
/admin/system-health
/admin/admins
/admin/settings

Dashboard overview:

* Active devices during configurable periods.
* Devices by model.
* Devices by installed build.
* Devices behind the latest security patch.
* Latest release status.
* Rollout progress.
* Update success rate.
* Update failure rate.
* Failure reasons.
* Download traffic.
* Storage consumption.
* Queue health.
* Database health.
* Redis health.
* Object-storage health.
* Recent security events.

Use server-side pagination, filtering, and sorting.

Do not retrieve all device or event records into browser memory.

Provide CSV export only to appropriately authorized roles, with rate limiting and audit logging.

Avoid exposing raw internal errors to normal administrators.

# Authentication and authorization

Use secure session-based authentication.

Required controls:

* Password hashing with Argon2id using appropriate parameters.
* Passkey/WebAuthn support where practical.
* TOTP as a supported second factor.
* Mandatory MFA for privileged roles.
* Secure, HttpOnly, SameSite cookies.
* CSRF protection for state-changing operations.
* Session rotation after authentication and privilege changes.
* Short idle timeout for privileged users.
* Absolute session expiration.
* Session revocation.
* Recovery-code hashing.
* Login rate limiting.
* Progressive delays.
* Generic authentication failure messages.
* Security-event logging.
* Optional trusted reverse-proxy IP restrictions for the admin area.

Implement RBAC with least privilege.

Suggested roles:

* VIEWER
* SUPPORT
* RELEASE_UPLOADER
* RELEASE_REVIEWER
* RELEASE_PUBLISHER
* SECURITY_ADMIN
* SUPER_ADMIN

Enforce authorization on the server for every operation.

Hiding a button is not authorization.

Require step-up authentication for:

* Publishing a release.
* Pausing or revoking a release.
* Changing trusted OTA certificates.
* Modifying rollout thresholds.
* Changing administrator roles.
* Disabling MFA.
* Exporting sensitive reports.

# Two-person release approval

Implement separation of duties.

By default:

* The administrator who uploads a package cannot be the sole approver.
* The approver cannot modify the uploaded artifact.
* Publication requires successful validation.
* Publication requires an approval by a distinct authorized administrator.
* Critical configuration changes require two-person approval where configured.

Record immutable audit events for the entire workflow.

# Audit logging

Audit:

* Authentication events.
* MFA changes.
* Role and permission changes.
* Upload creation and completion.
* Validation results.
* Approval.
* Publication.
* Rollout changes.
* Pause and resume.
* Revocation.
* Deletion attempts.
* Configuration changes.
* Data exports.
* Security-policy changes.
* Trusted-public-key changes.

Each audit record should contain:

* Event ID.
* Timestamp.
* Actor ID.
* Action.
* Target type and ID.
* Sanitized metadata.
* Request correlation ID.
* Privacy-preserving network identifier.
* Result.
* Optional reason.

Make logs append-only at the application level.

Do not allow routine administrators to edit or delete audit entries.

Support export to external immutable logging infrastructure.

# Public API security

Apply:

* Strict request validation.
* Request body limits.
* Endpoint-specific rate limits.
* Abuse detection.
* Safe error messages.
* Correlation IDs.
* Timeouts.
* Structured logging.
* Proper caching.
* No CORS unless explicitly necessary.
* No wildcard CORS.
* Security headers.
* Protection against host-header attacks.
* Trusted proxy configuration.
* Protection against request smuggling through correct proxy configuration.
* Denial-of-service resistance.

The OTA check endpoint must be lightweight and heavily cacheable where protocol semantics permit.

Do not require a reusable global secret embedded in every OS build for ordinary update checks. Any secret embedded in a distributed client must be treated as public.

# Download security and reliability

OTA package downloads must:

* Use HTTPS.
* Support resumable downloads and HTTP Range where needed.
* Use immutable object keys.
* Have correct `Content-Length`.
* Have correct `Content-Type`.
* Use safe `Content-Disposition`.
* Use long-lived immutable caching.
* Avoid content transformation.
* Avoid compression by the reverse proxy.
* Preserve exact bytes.
* Support CDN delivery.
* Never redirect to an untrusted origin.
* Prevent access to quarantined packages.
* Keep published packages immutable.

Do not place authentication tokens in long-lived URLs used by Updater unless the official protocol requires them.

If signed download URLs are used, ensure their expiry and retry behavior are compatible with large OTA downloads. Prefer a stable public immutable URL for nonsecret release artifacts when appropriate.

# Security headers

Configure appropriate headers, including:

* Strict-Transport-Security.
* X-Content-Type-Options.
* Referrer-Policy.
* Permissions-Policy.
* Content-Security-Policy for the dashboard.
* Frame-ancestors restriction.
* Secure cache headers for authenticated pages.

Do not apply dashboard CSP assumptions blindly to OTA binary endpoints.

# Secrets management

Validate environment variables at startup.

Provide `.env.example` containing placeholders only.

Never commit secrets.

Support secrets supplied through:

* Docker secrets.
* Kubernetes secrets.
* Cloud secret managers.
* Mounted files.

Separate:

* Session secrets.
* CSRF secrets.
* Rollout hashing secrets.
* Database credentials.
* Redis credentials.
* S3 credentials.
* Trusted OTA public certificates.
* Monitoring credentials.

Public verification certificates may be stored as configuration, but their changes must be audited and protected by high-privilege approval.

# Deployment

Create:

* Secure multi-stage Dockerfiles.
* Non-root containers.
* Read-only root filesystems where practical.
* Health checks.
* Resource limits.
* Graceful shutdown.
* Database migration procedure.
* Redis persistence recommendations.
* PostgreSQL backup procedure.
* Object-storage versioning recommendations.
* Restore procedure.
* Disaster-recovery documentation.
* Nginx configuration.
* TLS configuration guidance.
* Firewall guidance.
* Systemd or Docker Compose production example.
* Optional Kubernetes manifests only after the base deployment works.

Use separate development and production configurations.

Do not expose:

* PostgreSQL.
* Redis.
* MinIO console.
* Worker administration ports.
* Next.js development server.

# Monitoring and alerting

Expose authenticated or private-network metrics for:

* OTA checks.
* Update availability responses.
* Package downloads.
* Downloaded bytes.
* HTTP errors.
* Latency.
* Validation duration.
* Validation failures.
* Queue depth.
* Queue failures.
* Database health.
* Redis health.
* Object-storage health.
* Release rollout metrics.
* Update installation outcomes.
* Authentication failures.
* Administrative security events.

Create alert recommendations for:

* Elevated 5xx responses.
* Increased Updater protocol errors.
* Package hash mismatch.
* Signature-validation failure.
* Validation worker failures.
* Queue backlog.
* Storage nearing capacity.
* Database backup failure.
* Sudden installation-failure increase.
* Rollback reports.
* Repeated privileged-login failures.
* Unauthorized access attempts.

Do not include high-cardinality device identifiers in metric labels.

# Backup and disaster recovery

Document and script:

* Encrypted PostgreSQL backups.
* Backup integrity checks.
* Object-storage replication or versioning.
* Configuration backup.
* Trusted-public-certificate backup.
* Audit-log export.
* Restore testing.
* Recovery-time objectives.
* Recovery-point objectives.

Android private signing keys are outside this platform and must have their own offline, encrypted, geographically separated backup process.

Never copy private signing keys into ordinary application backups.

# Testing requirements

Implement:

1. Unit tests.
2. Integration tests.
3. Protocol compatibility tests.
4. Authorization matrix tests.
5. Upload-security tests.
6. ZIP-bomb and path-traversal tests.
7. Package-signature failure tests.
8. Wrong-device rejection tests.
9. Wrong-source-build delta rejection tests.
10. Rollback-attempt rejection tests.
11. Duplicate-release tests.
12. Staged-rollout determinism tests.
13. Revoked-release tests.
14. Paused-release tests.
15. Race-condition tests for publishing.
16. CSRF tests.
17. Session-security tests.
18. Rate-limit tests.
19. Audit-log tests.
20. Playwright end-to-end tests.

Create realistic fixtures without committing proprietary or production OTA packages.

Add a local fake Updater protocol client for contract testing. It must model behavior verified from the official Updater source rather than an invented protocol.

# CI security

Create a CI workflow that runs:

* Formatting.
* Linting.
* Type checking.
* Unit tests.
* Integration tests.
* Protocol contract tests.
* End-to-end tests.
* Dependency vulnerability scanning.
* Secret scanning.
* Container scanning.
* Static application security testing.
* Prisma migration checks.
* Production build.

CI must not contain Android production signing keys.

Use minimal CI permissions and pin third-party actions to immutable commits.

# Documentation

Create at least:

README.md
SECURITY.md
CONTRIBUTING.md
docs/architecture.md
docs/threat-model.md
docs/grapheneos-updater-protocol.md
docs/updater-integration.md
docs/release-workflow.md
docs/ota-validation.md
docs/signing-boundary.md
docs/deployment.md
docs/operations.md
docs/backup-and-restore.md
docs/incident-response.md
docs/privacy.md
docs/api.md
docs/compatibility-matrix.md

`docs/updater-integration.md` must explain:

1. How to obtain the matching GrapheneOS source.
2. How to set `OFFICIAL_BUILD=true`.
3. How to replace the Updater server URL in:
   `packages/apps/Updater/res/values/config.xml`
4. How to build with project-owned release keys.
5. Why official GrapheneOS OTA packages cannot update builds signed with our keys.
6. Why packages signed with different keys will be rejected.
7. How to perform initial installation.
8. How to verify the custom AVB public-key fingerprint.
9. How to lock the Pixel bootloader safely.
10. How to test a full OTA.
11. How to test a delta OTA.
12. How to test recovery from a failed update.
13. How to test that the newly updated version can receive the following update.

Do not put actual private-key commands or secret values into the application repository. Link the signing procedure to a separately controlled operational process.

# Threat model

Explicitly model:

* Compromised dashboard account.
* Compromised super-admin account.
* Compromised web server.
* Compromised worker.
* Compromised database.
* Compromised Redis.
* Compromised S3 credentials.
* Malicious uploaded OTA.
* Supply-chain attack.
* Stolen session.
* CSRF.
* SSRF.
* SQL injection.
* XSS.
* ZIP bomb.
* Path traversal.
* Command injection.
* Rollback attack.
* Wrong-device package.
* Wrong-source delta.
* CDN corruption.
* DNS compromise.
* TLS termination compromise.
* Denial-of-service attack.
* Insider threat.
* Audit-log tampering.
* Accidental release publication.
* Loss of Android signing keys.
* Compromise of Android signing keys.

The architecture must ensure that compromise of the OTA web server alone cannot produce a newly trusted Android OS update without access to external private signing keys.

# Initial implementation stages

Work incrementally.

Stage 1: Discovery and design

* Inspect current GrapheneOS Updater source.
* Document the exact protocol.
* Create architecture and threat model.
* Create an implementation plan.
* Do not guess unknown behavior.

Stage 2: Foundation

* Create monorepo.
* Add configuration validation.
* Add PostgreSQL, Prisma, Redis, MinIO, and local Docker Compose.
* Add authentication and RBAC.
* Add audit logging.
* Add health checks.

Stage 3: Release management

* Add device models.
* Add release records.
* Add direct uploads.
* Add quarantine.
* Add validation jobs.
* Add review and approval workflow.

Stage 4: Updater-compatible OTA endpoints

* Implement exact verified protocol.
* Add full OTA selection.
* Add exact-source delta selection.
* Add immutable downloads.
* Add caching and Range behavior.
* Add contract tests.

Stage 5: Rollouts and device reporting

* Add deterministic staged rollout.
* Add optional privacy-preserving installation reporting.
* Add failure monitoring and automatic rollout pause.

Stage 6: Hardening

* Add MFA.
* Add step-up authentication.
* Add rate limiting.
* Add security headers.
* Add metrics and alerting.
* Add backup and restore scripts.
* Add dependency and container scanning.

Stage 7: Production readiness

* Complete tests.
* Run security review.
* Resolve critical and high-severity issues.
* Produce deployment runbook.
* Produce release checklist.
* Produce incident-response runbook.

# Cursor working rules

For every stage:

1. Explain the intended changes briefly.
2. Inspect existing files before changing them.
3. Make small, reviewable commits or logical change groups.
4. Run formatting, linting, type checks, and relevant tests.
5. Report test results truthfully.
6. Do not claim something is working without executing the tests.
7. Do not replace secure implementation with TODO placeholders.
8. Do not suppress TypeScript errors.
9. Do not use `any` without a documented exceptional reason.
10. Do not disable security checks just to make tests pass.
11. Do not add mock security in production paths.
12. Keep protocol compatibility code separate from dashboard business logic.
13. Keep optional telemetry separate from required Updater protocol behavior.
14. Record important architectural decisions in ADR files.
15. Ask for human review before any action involving real production data, DNS, credentials, publication, or trusted certificates.

# Required first response

Before creating files, provide:

1. A summary of the verified current GrapheneOS Updater protocol.
2. The exact GrapheneOS repositories and commit hashes inspected.
3. A proposed architecture.
4. A database model summary.
5. A threat-model summary.
6. A staged implementation plan.
7. Open compatibility questions that could not be verified.
8. Assumptions that require human confirmation.

After that, begin Stage 1 and generate the discovery documentation.

Do not begin with UI mockups. OTA protocol compatibility, signing boundaries, artifact validation, and threat modeling come first.
