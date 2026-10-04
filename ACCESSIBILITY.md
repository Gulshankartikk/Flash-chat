# Flash Chat — Accessibility & WCAG 2.1 / 2.2 AA Compliance Guide

**Standard**: WCAG 2.1 Level AA & Level AAA (Typography Contrast)  
**Verification Tooling**: `@axe-core/playwright`, Node.js WCAG Color Contrast Engine, Screen Reader Emulation  

---

## 1. Accessibility Matrix & Compliance Summary

| Scope | Requirement | Flash Chat Implementation | Status |
|---|---|---|---|
| **Color Contrast (Text)** | Normal >= 4.5:1, Large >= 3.0:1 | Ink on Cream: **13.83:1**, Ink on Card: **14.68:1**, Dark Ink on Canvas: **17.58:1** | **PASS (AAA)** |
| **Color Contrast (UI)** | Focus ring & active UI >= 3.0:1 | Primary button on gradient: **3.53:1**, Dark Focus Ring: **6.08:1** | **PASS (AA)** |
| **Touch Targets** | Min 44x44px bounding box | Shared `Button`, `Input`, and icon buttons enforce `min-h-[44px]` or `p-2.5` | **PASS (AA)** |
| **Keyboard Navigation** | Complete tab order, focus trap, Esc close | `Modal` and `BottomSheet` trap focus; `Esc` restores trigger focus | **PASS (AA)** |
| **Motion Sensitivity** | `prefers-reduced-motion` support | CSS `motion-reduce:transform-none`, animations degrade gracefully | **PASS (AA)** |
| **Screen Reader Semantics** | ARIA landmarks, roles, live regions | Semantic `<header>`, `<main>`, `<nav>`, `role="dialog"`, `aria-live="polite"` | **PASS (AA)** |
| **Viewport & Zoom** | 200% zoom reflow, no zoom-blocking meta | Viewport allows pinch-to-zoom; input font size 16px prevents iOS zoom | **PASS (AA)** |

---

## 2. Keyboard Navigation & Shortcut Reference

| Key Combination | Screen / Context | Action Executed |
|---|---|---|
| **Tab / Shift+Tab** | Global | Navigate forward / backward through interactive elements |
| **Enter / Space** | Global | Activate focused button, open dropdown, or select chip |
| **Escape (Esc)** | Modals / Sheets / Menus | Close active overlay and return focus to triggering element |
| **J / K** | Admin Support Desk (`/admin/support`) | Move selection down / up through ticket queue |
| **A** | Admin Support Desk | Quick-assign selected ticket to current agent |
| **E** | Admin Support Desk | Quick-resolve selected ticket |
| **?** | Admin Support Desk | Open Keyboard Shortcuts Cheat Sheet modal |
| **Arrow Up / Down** | Message Input | Navigate through message history or smart reply chips |

---

## 3. ARIA Landmarks & Screen Reader Hierarchy

1. **Heading Structure**: Every screen features exactly one `<h1>` for page identity (e.g. `Chats`, `Contacts`, `Support`, `Pocket`, `Flash AI`).
2. **Icon-Only Buttons**: All icon-only triggers include descriptive `aria-label` or `title` attributes (e.g. `aria-label="Start voice call"`, `aria-label="Attach file"`).
3. **Live Regions**:
   - Streaming Flash AI tokens emit through `aria-live="polite"` text streams.
   - Incoming support messages and toasts declare `role="status"` / `aria-live="polite"`.
4. **Form Controls**: All inputs are coupled with either an explicit `<label>` or `aria-describedby` for error text.

---

## 4. Manual Screen Reader Verification Script

To execute a physical screen reader audit (NVDA, JAWS, or macOS VoiceOver):
1. **Sign-In Flow**: Tab to Phone/Email input, enter identifier, submit via Enter, and verify OTP input reads "Digit 1 of 6".
2. **Chat Interaction**: Tab into active conversation, send a test message via Enter, and verify screen reader announces message dispatch.
3. **Contact Book**: Open Contacts tab, press Tab to search, type a name, and verify results count is spoken.
4. **Flash Support**: Open `/support`, trigger "Start a new ticket", fill out subject and description, submit, and verify automated Flash AI reply announcement.
