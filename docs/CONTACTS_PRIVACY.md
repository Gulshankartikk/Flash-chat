# Flash Chat — Contacts Engine & Privacy Specification

**Version**: 1.1.0 (Fix-2 Add-by-Number & Privacy)  
**Standard**: Privacy-First Address Book Architecture  

---

## 1. Data Isolation & Owner Protection

1. **Zero Global Contact Graph**: Every contact created in Flash Chat belongs strictly to the authenticated `ownerId`. No other user, agent, or system component can read, query, or enumerate another user's contacts.
2. **Owner Isolation Verification**: Querying `/api/contacts/:id` or `/api/chats/pending/:id` where `:id` belongs to another user strictly returns `404 Not Found` (never `403 Forbidden` or leakage of resource existence).
3. **Encrypted in Transit & Rest**: Contact names, notes, and numbers are stored in secure MongoDB collections with owner index isolation (`{ owner: 1, phone: 1 }`).
4. **Saved-Name Privacy**: Custom names assigned by an owner (e.g., "Mom" or "Doctor") never leak to the recipient, push notifications, or public endpoints.

---

## 2. Phone Lookup & Anti-Enumeration Defense

Flash Chat guarantees that external observers cannot probe or enumerate phone numbers registered on the platform:

| Lookup Target | Server Response | Client UI Outcome | Leaks Account Status? |
|---|---|---|---|
| **Registered User** (Discoverable) | `{ status: 'ready', conversationId }` | Navigates to conversation | No (Standard start chat) |
| **Unregistered Number** | `{ status: 'pending', canInvite: true, pendingId }` | Shows Not On Flash Chat Sheet | No |
| **Opt-Out User** (`discoverableByPhone: false`) | `{ status: 'pending', canInvite: true, pendingId }` | Shows Not On Flash Chat Sheet | **No** (Identical to unregistered) |
| **Blocked User** | `{ status: 'pending', canInvite: true, pendingId }` | Shows Not On Flash Chat Sheet | **No** (Identical to unregistered) |

- **Rate Limits**: 30 requests/hour per user and a daily lookup cap (100/day) prevent automated telephone directory sweeps.
- **HMAC Phone Hashing**: Unregistered numbers in pending conversations are stored hashed using SHA-256 HMAC (`PHONE_HASH_SECRET`). Raw numbers are never stored in pending records.

---

## 3. Pending Requests & Message Request Lifecycle

1. **30-Day TTL Retention**: `PendingConversation` records expire automatically after 30 days via a native MongoDB TTL index on `expiresAt`.
2. **5 Queued Messages Limit**: Senders can queue at most 5 text messages (up to 500 characters each). Media is not permitted for unregistered contacts.
3. **Auto-Delivery on Signup**: When an unregistered phone number completes registration, pending messages are delivered as a **Message Request** (`Conversation.status = 'request'`).
4. **Sender vs Receiver Visibility**:
   - **Sender sees**: Their private saved contact name or masked phone (`+91 98•••••210`), queued message count, and "Waiting to join" state.
   - **Receiver sees**: The sender's public profile display name and avatar (never the sender's private saved label).
5. **Safety Restrictions Before Acceptance**:
   - No read receipts or typing indicators are sent.
   - Audio and video calling are disabled.
   - Media downloads and auto-playback are blocked.
   - Links are rendered as plain text with warning.

---

## 4. Discoverability & Opt-Out Mechanics

Flash Chat allows users full control over how they are discovered by others:

| Setting Key | Default | Behavior |
|---|---|---|
| `discoverableByPhone` | `true` | When `false`, other users saving this phone number will NOT see the "On Flash Chat" badge or linked user ID. |
| `discoverableByEmail` | `true` | When `false`, other users saving this email will NOT see the "On Flash Chat" badge or linked user ID. |

---

## 5. Explicit Consent Contact Import & Logout Hygiene

1. **No Silent Scraping**: Flash Chat never automatically uploads device address books in the background.
2. **Contact Picker API**: Where supported (Android Chrome), the browser's native contact picker is invoked with granular user selection.
3. **CSV File Import**: CSV files are parsed client-side with a strict batch limit of **200 contacts per import**. The user must review a preview table before clicking "Confirm & Import".
4. **Data Deletion & Logout Cleanup**: When a user logs out, offline contact queues and Service Worker API caches (`/api/contacts`, `/api/chats/by-phone`, `/api/chats/pending`) are completely purged.
