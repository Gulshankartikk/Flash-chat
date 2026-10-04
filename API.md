# Flash Chat — REST & Realtime Socket API Specification

This document details the HTTP endpoints and Socket.IO events for Flash Chat v1.1.0, including Manual Contacts, Support Desk, Flash AI, and Auth.

---

## 1. Contacts API (`/api/contacts`)
*All contacts endpoints are strictly owner-isolated (returns `404 Not Found` for other users' contacts).*

### `GET /api/contacts`
- **Query Params**: `q` (search name/phone/email), `favorites` (`true`/`false`), `page`, `limit`
- **Response `200 OK`**:
```json
{
  "success": true,
  "contacts": [
    {
      "_id": "65b91a20c9e0110001000001",
      "name": "Jane Doe",
      "phone": "+14155551234",
      "email": "jane@example.com",
      "isFavorite": true,
      "linkedUser": "65b91a20c9e0110001000099",
      "isOnFlashChat": true
    }
  ],
  "total": 1
}
```

### `POST /api/contacts`
- **Request Body**: `{ "name": "Jane Doe", "phone": "+14155551234", "email": "jane@example.com", "note": "Met at conference" }`
- **Errors**: `400 Bad Request` (invalid E.164 phone), `409 Conflict` (duplicate contact for this owner)

### `POST /api/contacts/bulk`
- **Request Body**: `{ "contacts": [ { "name": "A", "phone": "+14155550001" }, ... ] }` (Max 200 items)
- **Response `200 OK`**: `{ "success": true, "imported": 45, "results": [...] }`

### `POST /api/contacts/:id/message`
- **Behavior**: Retrieves or creates the direct 1:1 conversation with the contact's linked user.
- **Errors**: `404 Not Found` (contact not found or not linked to a Flash Chat user)

### `POST /api/contacts/:id/invite`
- **Behavior**: Dispatches SMS/email invite with a 7-day cooldown deduplication lock.
- **Errors**: `429 Too Many Requests` (cooldown active or daily 10-invite limit reached)

---

## 2. Support Desk API (`/api/support`)

### `POST /api/support/tickets`
- **Request Body**: `{ "subject": "App crashes on launch", "category": "bug", "message": "Details..." }`
- **Behavior**: Initializes support conversation with virtual user **"Flash Support"** and dispatches automated AI first-response.
- **Errors**: `409 Conflict` (user already has an active open ticket; max 1 open ticket constraint)

### `GET /api/support/tickets`
- **Behavior**: Returns the customer's tickets (`404` for other users).

### `POST /api/support/tickets/:id/rate`
- **Request Body**: `{ "rating": 5, "feedback": "Super fast help!" }`
- **Errors**: `409 Conflict` (rating already submitted; 1-5 star single-submission guard)

### `GET /api/admin/support/queue`
- **Guards**: Restricted to `support` and `admin` roles (`403 Forbidden` for regular users).
- **Behavior**: Lists all open/pending tickets across the platform with SLA metadata.

---

## 3. Realtime Socket Events (Socket.IO)

| Event Name | Direction | Payload | Description |
|---|---|---|---|
| `message:send` | Client -> Server | `{ conversationId, text, clientId, type }` | Send message with deduplication key |
| `message:new` | Server -> Client | `{ _id, conversationId, sender, text, createdAt }` | Broadcast new message to room |
| `ticket:updated` | Server -> Client | `{ ticketId, status, assignedTo }` | Support ticket status transition |
| `call:signal` | Bidirectional | `{ to, signalData, type }` | WebRTC 1:1 offer/answer/ICE exchange |
