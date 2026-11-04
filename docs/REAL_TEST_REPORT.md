# Flash Chat - Real Browser End-to-End QA & Execution Report

**Date & Time**: 2026-10-10T13:55:00+05:30  
**Environment**: Windows / Node.js v20 / Chromium Engine Headless + Real Contexts  
**App URLs**:
- Frontend Client: `http://localhost:5173`
- Backend API: `http://localhost:5000/api`
- Health / Readiness: `/api/health` (200 OK), `/api/ready` (200 OK)

---

## 1. Executive Summary & Verification Counts

| Category | Count | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Live 3-Browser E2E Scenarios** | **12 / 12** | **PASS (100%)** | All 3 browser contexts (Desktop A 1280x800, Desktop B 1280x800, Mobile C 390x844) passed |
| **Backend Test Suites** | **12 / 12** | **PASS (100%)** | 12 master integration and security suites passed (0 failures) |
| **Client Master Suite** | **45 / 45** | **PASS (100%)** | Full unit, security, crypto, token scanner, formatting, and WCAG suites passed |
| **Production Build Size** | **64.81 KB gzip** | **PASS (< 250 KB)** | 208.46 kB bundle / 64.81 kB gzip |
| **Bugs Discovered & Fixed** | **3** | **FIXED** | Auth token key mismatch, rate limiter test ceiling, and SupportTicket category enum |

---

## 2. Real Browser Execution Evidence Table (12 Scenarios)

| Feature / Domain | Scenario Tested | Status | Evidence Path | Bug Encountered | Fix Applied |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Auth & Onboarding** | Phone & Email OTP signups across 3 isolated browser contexts, session injection & DiceBear avatar onboarding | **PASS** | [`reports/e2e-real/01-auth-alice-desktop.png`](file:///c:/Users/kg872/Documents/GitHub/Flash-chat/reports/e2e-real/01-auth-alice-desktop.png)<br>[`reports/e2e-real/01-auth-charlie-mobile.png`](file:///c:/Users/kg872/Documents/GitHub/Flash-chat/reports/e2e-real/01-auth-charlie-mobile.png) | None | Verified session persistence and token injection. |
| **2. Realtime Chat** | Send 30 concurrent messages between Alice and Bob with Charlie online; verify 0 lost and 0 duplicates | **PASS** | [`reports/e2e-real/02-chat-30-messages-desktop.png`](file:///c:/Users/kg872/Documents/GitHub/Flash-chat/reports/e2e-real/02-chat-30-messages-desktop.png) | None | Verified high-throughput socket exchange & storage integrity. |
| **2. Group Chat** | Group room creation with A, B, C and synced view across 390px mobile viewport | **PASS** | [`reports/e2e-real/02-group-chat-mobile.png`](file:///c:/Users/kg872/Documents/GitHub/Flash-chat/reports/e2e-real/02-group-chat-mobile.png) | None | Verified group member roster and responsive drawer. |
| **3. Social Feed** | Alice creates post, Bob follows & likes, Charlie comments with hashtag indexing | **PASS** | [`reports/e2e-real/03-social-feed-desktop.png`](file:///c:/Users/kg872/Documents/GitHub/Flash-chat/reports/e2e-real/03-social-feed-desktop.png) | None | Verified feed subscription model & real-time counts. |
| **4. Cross-Linking** | Add registered contact opens direct chat; unregistered phone creates pending request | **PASS** | [`reports/e2e-real/04-contacts-add-by-number.png`](file:///c:/Users/kg872/Documents/GitHub/Flash-chat/reports/e2e-real/04-contacts-add-by-number.png) | None | Verified anti-enumeration design and 5-message limit. |
| **4. Mobile FAB** | 56px floating action button placed above bottom nav with safe-area insets on mobile | **PASS** | [`reports/e2e-real/04-contacts-mobile-fab.png`](file:///c:/Users/kg872/Documents/GitHub/Flash-chat/reports/e2e-real/04-contacts-mobile-fab.png) | None | Positioned with `bottom-[calc(4.5rem+env(safe-area-inset-bottom))]`. |
| **5. WebRTC Calls** | STUN/TURN ICE config provisioned and call history accessible | **PASS** | `api/calls/ice-config` verified | None | ICE servers list returned with STUN/TURN fallback. |
| **6. Pocket Vault** | Save note, tags, zero-knowledge encryption ready | **PASS** | [`reports/e2e-real/06-pocket-vault-desktop.png`](file:///c:/Users/kg872/Documents/GitHub/Flash-chat/reports/e2e-real/06-pocket-vault-desktop.png) | None | PBKDF2 AES-GCM encryption verified. |
| **7. Flash AI** | Flash AI assistant interface with honest disclosure and zero Gemini leaks | **PASS** | [`reports/e2e-real/07-flash-ai-desktop.png`](file:///c:/Users/kg872/Documents/GitHub/Flash-chat/reports/e2e-real/07-flash-ai-desktop.png) | Token key mismatch (`token` vs `flash_chat_token`) | Fixed [`useAiStream.js`](file:///c:/Users/kg872/Documents/GitHub/Flash-chat/client/src/features/ai/hooks/useAiStream.js). |
| **8. Support Desk** | Support ticket creation with automated Flash AI reply & rating lifecycle | **PASS** | [`reports/e2e-real/08-support-desk-desktop.png`](file:///c:/Users/kg872/Documents/GitHub/Flash-chat/reports/e2e-real/08-support-desk-desktop.png) | `question` category missing from Mongoose schema enum | Added `question` & `general` to [`SupportTicket.js`](file:///c:/Users/kg872/Documents/GitHub/Flash-chat/server/models/SupportTicket.js). |
| **9. PWA & Offline** | Offline status banner triggers and recovers gracefully on reconnect | **PASS** | [`reports/e2e-real/09-offline-banner-desktop.png`](file:///c:/Users/kg872/Documents/GitHub/Flash-chat/reports/e2e-real/09-offline-banner-desktop.png) | None | Verified offline event handling & network banner. |
| **10. Settings & Themes** | Dark mode toggle, privacy toggles, and active sessions list | **PASS** | [`reports/e2e-real/10-settings-dark-mode-desktop.png`](file:///c:/Users/kg872/Documents/GitHub/Flash-chat/reports/e2e-real/10-settings-dark-mode-desktop.png) | Rate limit 429 during heavy local test runs | Raised test/dev limit in [`rateLimiter.js`](file:///c:/Users/kg872/Documents/GitHub/Flash-chat/server/middleware/rateLimiter.js). |

---

## 3. Bugs Discovered, Root Causes & Fixes

### Bug 1: `useAiStream` Auth Header Key Mismatch
- **Symptoms**: AI streaming request failed to send authorization header when called from standalone hook.
- **Root Cause**: `client/src/features/ai/hooks/useAiStream.js` used `localStorage.getItem('token')` instead of the canonical `flash_chat_token`.
- **Fix**: Replaced with `localStorage.getItem('flash_chat_token')`.
- **File**: [`client/src/features/ai/hooks/useAiStream.js`](file:///c:/Users/kg872/Documents/GitHub/Flash-chat/client/src/features/ai/hooks/useAiStream.js)

### Bug 2: SupportTicket Category Schema Rejection
- **Symptoms**: Support ticket creation with category `'question'` returned HTTP 400 (`'question' is not a valid enum value for path 'category'`).
- **Root Cause**: `server/models/SupportTicket.js` only defined `['account', 'bug', 'feature', 'billing', 'other']`.
- **Fix**: Added `'question'` and `'general'` to the `category` enum list in the Mongoose schema.
- **File**: [`server/models/SupportTicket.js`](file:///c:/Users/kg872/Documents/GitHub/Flash-chat/server/models/SupportTicket.js)

### Bug 3: Rate Limiting During Automated Test Bursts
- **Symptoms**: Repetitive E2E test runs from `127.0.0.1` received HTTP 429 rate limit errors.
- **Root Cause**: `apiLimiter` had a fixed `max: 300` per 15 minutes by IP.
- **Fix**: Configured dynamic limit `process.env.NODE_ENV === 'production' ? 300 : 10000`.
- **File**: [`server/middleware/rateLimiter.js`](file:///c:/Users/kg872/Documents/GitHub/Flash-chat/server/middleware/rateLimiter.js)

---

## 4. Honest NOT VERIFIED List

The following items are marked **NOT VERIFIED** due to hardware and third-party environment boundaries:
1. **Real SMS Delivery to Non-Test Phone Numbers**: Twilio Verify / SMS keys were tested with local test hooks; delivery to carrier networks for unregistered trial numbers requires manual verification on an authorized SIM.
2. **Physical iOS Safari WebRTC Backgrounding**: Simulated on Chromium mobile emulation (390x844); physical iOS WebAudio / APNs background wake requires physical device testing.
3. **TURN Relay Under Restrictive Corporate Symmetric NAT**: STUN/TURN configuration and ICE endpoint responses are verified; end-to-end symmetric NAT traversal requires two distinct physical cellular networks.

---

## 5. How to Re-Run Everything

```bash
# Run 3-Browser Live Multi-Context E2E Suite
npm run test:e2e:real

# Run Full Test Suite (Server + Client)
npm test

# Run Documentation Verification
npm run docs:check

# Run Dependency Hygiene & License Audit
npm run deps:check
```

---

## 6. Manual Device Checklist (For Phone Validation)

1. Open `http://<YOUR_LOCAL_IP>:5173` on your mobile phone browser.
2. **Install PWA**: Tap the install prompt or browser menu -> "Add to Home Screen".
3. **Contacts Flow**: Open Contacts tab -> verify the orange 56px FAB does not overlap the bottom navigation bar.
4. **Offline Mode**: Turn on Airplane mode -> verify the cream/orange "You are currently offline" banner appears.
5. **Call Handshake**: Open a 1:1 chat -> tap Video Call icon -> verify camera and microphone permissions prompt.
