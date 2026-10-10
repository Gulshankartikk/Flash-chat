# Flash Chat — Visual Regression & Snapshot Testing Guide

**Version**: 1.0.0 (Part B-3b Final)  
**Tooling**: Playwright (`toHaveScreenshot`), Dockerized Baseline Container, CSS Reduced-Motion Harness  

---

## 1. Deterministic Visual Setup

To eliminate flakiness, rendering drift, and font differences across operating systems:

1. **Pinned Docker Execution Environment**:
   All official visual regression snapshots are generated inside the official pinned Playwright container:
   ```bash
   mcr.microsoft.com/playwright:v1.44.0-jammy
   ```
2. **Deterministic Time & Clock**:
   Snapshots freeze the browser clock using `page.clock.setFixedTime(new Date('2026-10-04T12:00:00.000Z'))` to ensure timestamps and relative times render identically.
3. **Font Readiness**:
   `await document.fonts.ready;` is executed before capturing any frame, ensuring web fonts (`Inter`) are fully rasterized.
4. **Motion & Caret Suppression**:
   Test-only stylesheet forces `animation-duration: 0s !important; transition-duration: 0s !important; caret-color: transparent !important;`.
5. **Dynamic Region Masking**:
   Avatars from external CDNs, streaming counters, usage meters, and video element frames are automatically masked (`mask: [page.locator('.dynamic-mask')]`).

---

## 2. Matrix & Viewport Dimensions

| Viewport Category | Width x Height | Devices Emulated | Themes Tested |
|---|---|---|---|
| **Mobile Compact** | 360 x 740 | Android Small / Galaxy | Light & Dark |
| **Mobile Standard** | 390 x 844 | iPhone 13, iPhone 14 | Light & Dark |
| **Tablet** | 768 x 1024 | iPad Mini / Portrait | Light & Dark |
| **Desktop Standard** | 1280 x 800 | Laptop Screen | Light & Dark |
| **Desktop Wide** | 1440 x 900 | High-Res Monitor | Light & Dark |

### Covered Screens & States
1. Auth Welcome & OTP verification step
2. Chats List & Active Chat Window (All message types fixture: text, audio, image, video, document, location, contact, shared post/story, replies, reactions)
3. Calling Screen & Incoming Call Modal
4. Social Feed, Stories Viewer, Reels & Create Flow
5. Pocket Vault Home, PIN Lock Screen & Item Editor
6. Flash AI Chat & AiSheet
7. Contacts List (Grouped A-Z), Add Contact Modal & Import Preview
8. Support Desk Home, Start Ticket Modal & Chat
9. Admin Support Console (`/admin/support` - Desktop Only)
10. Settings Hub, 404 Page & Offline Page

---

## 3. Workflow & Baseline Maintenance Commands

### Running Visual Regression Tests
```bash
npm --prefix client run test:visual
```

### Updating Baselines (Dockerized)
```bash
docker run --rm --network host -v $(pwd):/work/ -w /work/client mcr.microsoft.com/playwright:v1.44.0-jammy npm run test:visual:update
```

### Pull Request Review Rule
- **Threshold**: `maxDiffPixelRatio: 0.01` (1% pixel variance maximum).
- **Mandatory PR Diff Review**: Any changes to `.png` snapshot baselines require an explicit image diff review and QA Lead approval before merging into `main`.
