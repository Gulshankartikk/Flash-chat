# Flash Chat Changelog

All notable changes to the Flash Chat platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-10-04

### Added
- **Manual Contacts Engine**:
  - Full CRUD operations via `/api/contacts` with owner-isolated contact records (name, phone in E.164, email, note, avatar, favorite).
  - Bulk CSV/VCF contact import endpoint with a strict 200-row batch cap and per-row validation reporting.
  - Granular discoverability privacy toggles (`discoverableByPhone`, `discoverableByEmail`).
  - Contact invite dispatch with 7-day cooldown deduplication and rate limiting.
  - Native Web Contact Picker API integration with seamless manual fallback.
  - Offline contact mutation queue with automatic reconciliation upon network recovery.
  - Client-side `getDisplayName()` utility with strict precedence: `contactName` -> `profileName` -> `@username` -> fallback.
- **"Chat with us" Support Desk & Virtual Assistant**:
  - Support ticket lifecycle (`open`, `pending`, `resolved`) with a single active ticket constraint per customer.
  - Automated Flash AI first-response triage engine summarizing FAQs and troubleshooting steps without sensitive data exposure.
  - Dedicated Agent Console (`/admin/support`) restricted by RBAC to `support` and `admin` roles.
  - Customer satisfaction survey with a 1-5 star single-submission rating guard.
  - 7-day ticket reopen grace period expiring automatically on day 8.
- **Strict 8-Token Design System & Micro-Animations**:
  - Semantic color palette in [tokens.css](file:///client/src/styles/tokens.css): `cream` (`#FFF7ED`), `card` (`#FFFFFF`), `primary` (`#F97316`), `secondary` (`#EC4899`), `accent` (`#F43F5E`), `ink` (`#1F2937`), `muted` (`#6B7280`), `line` (`#FED7AA`), and brand gradient (`135deg #F97316 -> #EC4899`).
  - Full dark mode token set (`#18110D` dark cream canvas, `#241A14` dark card surface, `#FED7AA` line stop).
  - Standardized accessible component primitives: `Button`, `Input`, `Card`, `Modal`, `BottomSheet`, `Tabs`, `Badge`, `Avatar`, `Toast`, `Skeleton`, `EmptyState`, `Switch`, `Tooltip`, `Dropdown`, `ListItem`.
  - WCAG 2.1/2.2 AA and AAA compliance across all screens in both Light and Dark themes.
- **Flash AI Rebranding & Transparency**:
  - Unified visible AI branding to **"Flash AI"** across all UI screens, system prompts, badges, and logos.
  - Honest provider disclosure component (`AiProviderDisclosure`) explicitly disclosing Google Gemini model usage.
  - Robust prompt injection defense wrappers with strict tag balancing and delimiter isolation.

### Changed
- **Service Worker Caching**:
  - Enhanced cache denylist in [client/src/sw.js](file:///client/src/sw.js) to strictly bypass `/api/auth`, `/api/pocket`, `/api/ai`, `/api/contacts`, `/api/support`, `/api/push`, and `/api/upload`.
- **Navigation & Mobile Shell**:
  - Bottom navigation bar redesigned to include `Contacts` and `Support` alongside `Chats`, `Calls`, `Social`, `Pocket`, and `Flash AI`.
  - Added support for mobile viewport units (`100dvh`) and safe-area insets (`env(safe-area-inset-bottom)`).

### Fixed
- Replaced all rogue Tailwind color classes (`emerald-*`, `indigo-*`, `slate-*`, `rose-*`) with semantic Flash Chat tokens.
- Sanitized diagnostic payloads in support tickets to omit private tokens, credentials, or personal chat history.
- Enforced cryptographic SHA-256 integrity verification across database migrations to guarantee user message text preservation.

### Migration Notes
- Database migration script `server/migrations/partA_rename_and_roles.js` is strictly idempotent (modifies 0 records on re-run).
- Compound indexes created in background:
  - `contacts`: `{ owner: 1, phone: 1 }`, `{ owner: 1, email: 1 }`, `{ owner: 1, name: 1 }`
  - `support_tickets`: `{ user: 1, createdAt: -1 }`, `{ status: 1, createdAt: -1 }`
  - `conversations`: `{ type: 1, updatedAt: -1 }`
- Zero-COLLSCAN verified on high-throughput list and search queries.

### Breaking Changes
- None. Full backward compatibility is maintained for legacy users without role or discoverability fields (defaulting lazily to `role: "user"`, `discoverableByPhone: true`, `discoverableByEmail: true`).
