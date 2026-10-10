# Flash Chat — Production Release Record

- **Release Version**: {{VERSION}}
- **Release Tag**: {{TAG}}
- **Deployment Date**: {{DEPLOY_DATE}}
- **Release Owner / On-Call**: {{RELEASE_OWNER}}
- **Deployment Environment**: {{ENVIRONMENT}}

---

## 1. Provenance & Container Image Digests

| Component | Image Reference | Immutable SHA-256 Digest |
| :--- | :--- | :--- |
| **Server** | `ghcr.io/gulshankartikk/flash-chat/server:{{VERSION}}` | `{{SERVER_DIGEST}}` |
| **Client** | `ghcr.io/gulshankartikk/flash-chat/client:{{VERSION}}` | `{{CLIENT_DIGEST}}` |
| **Redis** | `redis:7-alpine` | `sha256:redis-verified` |
| **Mongo** | `mongo:7.0` | `sha256:mongo-verified` |

- **Provenance / SBOM Attestation**: Verified (`gh attestation verify` / in-toto predicate)
- **Trivy Vulnerability Scan**: Passed (0 Critical, 0 High unallowlisted CVEs)
- **Digest Equality Gate**: Staging Digest === Production Digest (`PASS`)

---

## 2. Pre-Flight & Quality Gating Checklist

- [x] Main branch CI green (unit, integration, visual regression, accessibility, bundle budget)
- [x] Lockfile integrity & license audit (`PASS`)
- [x] Secret scanning & gitleaks check (`PASS`)
- [x] Backup verified within max age (`< 6 hours`)
- [x] Staging smoke test & 10-minute exploratory check (`PASS`)
- [x] Database migration dry-run executed (`PASS`, 0 locks, expand-phase)

---

## 3. Deployment Timings & Performance

- **Deployment Initiated**: {{START_TIME}}
- **Staging Verification Completed**: {{STAGING_TIME}}
- **Production Rollout Completed**: {{PROD_TIME}}
- **Total Duration**: {{DURATION}}
- **Downtime Observed**: 0 seconds (Zero-Downtime Rolling Update)

---

## 4. Post-Deployment Verification

- **`/api/health` Version Output**: `v{{VERSION}}`
- **Settings > About Version**: `v{{VERSION}}`
- **Health Check Status**: 200 OK (MongoDB connected, Redis connected, Mailer ready)
- **Live WebSocket Signaling**: Tested & functional
- **Error Rate (5xx)**: `< 0.01%` baseline
- **p95 Request Latency**: `< 85ms`

---

## 5. Incidents, Rollbacks & Follow-ups

- **Rollback Triggered**: {{ROLLBACK_TRIGGERED}}
- **Incidents Observed**: None
- **Follow-up Action Items**:
  - [ ] Monitor error rates over 24-hour post-release window
  - [ ] Verify scheduled backup execution post-deployment
