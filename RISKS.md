# Flash Chat — Production Risk Register & Mitigations

This document outlines the top operational, technical, privacy, and infrastructure risks for Flash Chat v1.1.0, along with their evaluated likelihood, impact, assigned owners, and active mitigations.

---

## Risk Matrix Summary

| ID | Risk Domain | Likelihood | Impact | Severity | Suggested Owner | Mitigation Strategy |
|---|---|---|---|---|---|---|
| **R-01** | **Support Staffing & SLA Breaches** | High | Medium | **HIGH** | Support Lead | Automated Flash AI first response handles FAQ queries; 5 ticket/day rate limit suppresses ticket flooding. |
| **R-02** | **Contact Privacy Expectations (GDPR / DPDP)** | Medium | High | **HIGH** | Privacy & Legal | Explicit user consent requirement prior to address book upload; discoverability opt-out toggles (`discoverableByPhone`, `discoverableByEmail`); owner-isolated contact graph. |
| **R-03** | **AI Provider Disclosure Compliance** | Low | High | **MEDIUM** | Compliance Lead | Explicit `AiProviderDisclosure` component informing users of Google Gemini model usage and data handling boundaries. |
| **R-04** | **Invite Spam & Abuse** | Medium | Medium | **MEDIUM** | Backend Eng | 7-day cooldown deduplication per target phone/email; 10 invites/day per user; rate limiting on `/api/contacts/:id/invite`. |
| **R-05** | **Visual Baseline Drift in CI** | Medium | Low | **LOW** | Frontend Lead | Pin visual regression test runs to deterministic Docker container environment; strict 0.01 pixel threshold. |
| **R-06** | **iOS Safari PWA Push Limitations** | High | Medium | **HIGH** | Mobile Lead | Display clear "Add to Home Screen" prompt for iOS 16.4+ users; fallback to in-app polling notifications and email alerts when offline. |
| **R-07** | **Mesh WebRTC Call Scalability (>4 Participants)** | Medium | High | **HIGH** | WebRTC Lead | Mesh WebRTC topology is limited to 1:1 and small group calls (<=4); selective forwarding unit (SFU) architecture planned for larger rooms in Step 10-4. |
| **R-08** | **Third-Party API Cost Spikes (Gemini / Twilio)** | Medium | Medium | **MEDIUM** | DevOps Lead | Strict per-minute/per-day rate limiters on AI generation and SMS dispatch; in-memory fallback mocks for development/staging. |
| **R-09** | **Redis / MongoDB Single Point of Failure** | Low | Critical | **HIGH** | SRE / DevOps | Replicaset configuration for MongoDB; in-memory socket adapter fallback if Redis cluster connectivity drops. |
