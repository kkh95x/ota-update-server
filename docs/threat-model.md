# Threat Model — CUSTOM_OS OTA Platform

> Stage 1 summary. Expand with STRIDE per component during Stage 6.

## Security goal

Compromise of the OTA web platform alone must **not** allow minting a device-trusted OS update without access to **offline Android signing private keys**.

## Assets

| Asset | Sensitivity |
|-------|-------------|
| Signed OTA zips (published) | High — device integrity |
| Quarantined uploads | High — could be malicious |
| Channel metadata files | High — controls update pointer |
| Admin sessions / MFA seeds | Critical |
| PostgreSQL (releases, audit) | High |
| S3 credentials | High |
| Rollout secrets | Medium |
| Optional installation telemetry | Low–medium (privacy) |
| **Android signing private keys** | **Out of scope — not stored here** |

## Trust boundaries

```
[Device] ──HTTPS──▶ [Public OTA origin]     (unauthenticated reads)
[Admin browser] ──▶ [Dashboard] ──▶ [DB / Redis / Quarantine S3]
[Worker] ──▶ [Quarantine S3] ──verify──▶ [Public S3] (publish job)
[Offline signer] ──▶ signed zip ──upload──▶ [Dashboard]
```

## Threat scenarios

### Compromised dashboard account (RELEASE_UPLOADER)

| Impact | Mitigation |
|--------|------------|
| Upload malicious zip to quarantine | Validation pipeline; quarantine bucket; no auto-publish |
| DoS via large uploads | Size limits, rate limits, presigned constraints |
| Cannot publish without REVIEWER/PUBLISHER + validation pass | Two-person rule, RBAC |

### Compromised super-admin

| Impact | Mitigation |
|--------|------------|
| Publish bad release if valid signature | Requires attacker-supplied signed zip from signer compromise OR stolen keys |
| Change trusted public certs | Step-up auth + audit + two-person for cert changes |
| Disable MFA / exfil data | Security admin alerts, session revocation, export audit |

### Compromised web server / worker

| Impact | Mitigation |
|--------|------------|
| Serve attacker-controlled files from public bucket | S3 IAM least privilege; publish only via worker; immutable published keys |
| Read DB secrets | Container hardening, no signing keys present |
| RCE via malicious zip | No execution of archive contents; sandboxed external tools; array args only |

### Compromised S3 credentials

| Impact | Mitigation |
|--------|------------|
| Overwrite published OTAs | Bucket versioning, IAM separation (quarantine vs publish role), monitoring on object change |
| Exfil quarantined packages | Private quarantine prefix, no public ACL |

### Malicious OTA upload

| Impact | Mitigation |
|--------|------------|
| ZIP bomb, path traversal | Streaming ZIP guards |
| Wrong device / downgrade | Metadata extraction + signature + rollback checks |
| Unsigned / wrong key | Signature verification against configured public certs |

### Network / CDN attacks

| Threat | Mitigation |
|--------|------------|
| CDN corruption | Immutable URLs, checksum in validation report, client-side verifyPackage |
| DNS compromise | HSTS, cert pinning not in stock Updater — **operational monitoring required** |
| TLS termination compromise | HSM/KMS for infra certs; separate from OTA signing |

### Protocol-specific

| Threat | Mitigation |
|--------|------------|
| Wrong-source delta offered | Server only hosts deltas with matching source incremental in filename |
| Rollback attack | Client + package rollback metadata; server never publishes lower `post-timestamp` for channel |
| Downgrade via metadata edit | Approval workflow; audit; monotonic build policy per channel |

### Privacy

| Threat | Mitigation |
|--------|------------|
| Device tracking via update checks | Official protocol already exposes codename + versions in URLs — document in privacy policy |
| Telemetry over-collection | Opt-in; installation UUID only; retention jobs |
| IP in admin/OTA access logs | Full IP per ADR 0006; retention job; RBAC masking for lower roles; never in device telemetry |

## Fail-closed rules

- Validation failure → package stays quarantined
- Signature failure → never publish
- Missing metadata fields → reject upload
- Uncertain protocol behavior → diagnostic error in tests, not silent guess

## Out of scope (separate runbooks)

- Loss/compromise of Android **private** signing keys
- Physical device attack
- Verified Boot / bootloader unlock policy on devices
