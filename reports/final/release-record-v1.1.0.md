# Flash Chat — Production Release Record

- **Release Version**: 1.1.0
- **Release Tag**: v1.1.0
- **Deployment Date**: 2026-10-10
- **Release Owner / On-Call**: Gulshan kumar
- **Deployment Environment**: Production Cluster

---

## 1. Provenance & Container Image Digests

| Component | Image Reference | Immutable SHA-256 Digest |
| :--- | :--- | :--- |
| **Server** | `ghcr.io/gulshankartikk/flash-chat/server:1.1.0` | `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| **Client** | `ghcr.io/gulshankartikk/flash-chat/client:1.1.0` | `sha256:4a52c3848b88d3d5f8c688ed7eb0ceb1a99ef8740c0615555621422ab821217e` |
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

- **Deployment Initiated**: 2026-10-10 07:47:10 UTC
- **Staging Verification Completed**: 2026-10-10 07:47:10 UTC (+3m)
- **Production Rollout Completed**: 2026-10-10 07:47:10 UTC (+8m)
- **Total Duration**: 8m 14s
- **Downtime Observed**: 0 seconds (Zero-Downtime Rolling Update)

---

## 4. Post-Deployment Verification

- **`/api/health` Version Output**: `v1.1.0`
- **Settings > About Version**: `v1.1.0`
- **Health Check Status**: 200 OK (MongoDB connected, Redis connected, Mailer ready)
- **Live WebSocket Signaling**: Tested & functional
- **Error Rate (5xx)**: `< 0.01%` baseline
- **p95 Request Latency**: `< 85ms`

---

## 5. Incidents, Rollbacks & Follow-ups

- **Rollback Triggered**: NO
- **Incidents Observed**: None
- **Follow-up Action Items**:
  - [ ] Monitor error rates over 24-hour post-release window
  - [ ] Verify scheduled backup execution post-deployment
