# Flash Chat — Contacts Engine & Privacy Specification

**Version**: 1.0.0 (Part B-3 Final)  
**Standard**: Privacy-First Address Book Architecture  

---

## 1. Data Isolation & Owner Protection

1. **Zero Global Contact Graph**: Every contact created in Flash Chat belongs strictly to the authenticated `ownerId`. No other user, agent, or system component can read, query, or enumerate another user's contacts.
2. **Owner Isolation Verification**: Querying `/api/contacts/:id` where `:id` belongs to another user strictly returns `404 Not Found` (never `403 Forbidden` or leakage of resource existence).
3. **Encrypted in Transit & Rest**: Contact names, notes, and numbers are stored in secure MongoDB collections with owner index isolation (`{ owner: 1, phone: 1 }`).

---

## 2. Discoverability & Opt-Out Mechanics

Flash Chat allows users full control over how they are discovered by others:

| Setting Key | Default | Behavior |
|---|---|---|
| `discoverableByPhone` | `true` | When `false`, other users saving this phone number will NOT see the "On Flash Chat" badge or linked user ID. |
| `discoverableByEmail` | `true` | When `false`, other users saving this email will NOT see the "On Flash Chat" badge or linked user ID. |

### Blocked Relationships
If User A blocks User B, neither user will show as a "Linked User" in the other user's contact book, preventing contact status probing.

---

## 3. Explicit Consent Contact Import

1. **No Silent Scraping**: Flash Chat never automatically uploads device address books in the background.
2. **Contact Picker API**: Where supported (Android Chrome), the browser's native contact picker is invoked with granular user selection.
3. **CSV File Import**: CSV files are parsed client-side with a strict batch limit of **200 contacts per import**. The user must review a preview table before clicking "Confirm & Import".
4. **Data Deletion**: When a user deletes a contact, all metadata, notes, and local offline draft records are purged immediately.
