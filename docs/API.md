# Flash Chat — REST & Realtime Socket API Specification

This document details the HTTP endpoints and Socket.IO events for Flash Chat v1.1.0, including Manual Contacts, Phone-based Chat Creation, Pending Requests, Support Desk, Flash AI, and Auth.

---

## 1. Phone-Based Chats & Pending Requests (`/api/chats`)

### `POST /api/chats/by-phone`
- **Rate Limit**: 30 lookups/hour/user, 100 daily lookup cap.
- **Request Body**:
  ```json
  {
    "phone": "+919876543210",
    "name": "Alex Smith",
    "saveContact": true
  }
  ```
- **Response `200 OK` (Registered & Discoverable)**:
  ```json
  {
    "success": true,
    "status": "ready",
    "conversationId": "65b91a20c9e0110001000001",
    "contactId": "65b91a20c9e0110001000002"
  }
  ```
- **Response `200 OK` (Unregistered / Blocked / Discoverability Off — Anti-Enumeration Generic Response)**:
  ```json
  {
    "success": true,
    "status": "pending",
    "canInvite": true,
    "pendingId": "65b91a20c9e0110001000003",
    "contactId": "65b91a20c9e0110001000002",
    "rawPhoneMasked": "+91 98•••••210"
  }
  ```
- **Errors**: `400 Bad Request` (invalid E.164 phone or own number), `429 Too Many Requests` (rate limit or daily cap exceeded).

### `GET /api/chats/pending`
- **Behavior**: Retrieves all active queued pending conversations for the authenticated user.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "pendingConversations": [
      {
        "_id": "65b91a20c9e0110001000003",
        "rawPhoneMasked": "+91 98•••••210",
        "name": "Alex Smith",
        "queuedMessages": [
          { "text": "Hi Alex, joined Flash Chat!", "createdAt": "2026-10-10T10:00:00.000Z" }
        ],
        "expiresAt": "2026-11-09T10:00:00.000Z",
        "createdAt": "2026-10-10T10:00:00.000Z"
      }
    ]
  }
  ```

### `POST /api/chats/pending/:id/messages`
- **Request Body**: `{ "text": "Hey there!" }` (Max 5 queued messages per pending conversation, max 500 chars).
- **Response `200 OK`**: `{ "success": true, "queuedCount": 2 }`
- **Errors**: `400 Bad Request` (limit of 5 queued messages reached or invalid text length), `404 Not Found` (pending conversation not found or expired).

### `DELETE /api/chats/pending/:id`
- **Behavior**: Cancels and permanently deletes the pending conversation and its queued messages.
- **Response `200 OK`**: `{ "success": true, "message": "Pending conversation deleted." }`

### `POST /api/chats/:id/accept`
- **Behavior**: Accepts an incoming message request (`status = 'request' -> 'active'`). Enables calling, receipts, and media downloads.
- **Response `200 OK`**: `{ "success": true, "conversation": { ... } }`

### `POST /api/chats/:id/reject`
- **Behavior**: Deletes or rejects an incoming message request.
- **Response `200 OK`**: `{ "success": true, "message": "Conversation removed." }`

---

## 2. Contacts API (`/api/contacts`)
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

## 3. Support Desk API (`/api/support`)

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

## 4. Realtime Socket Events (Socket.IO)

| Event Name | Direction | Payload | Description |
|---|---|---|---|
| `message:send` | Client -> Server | `{ conversationId, text, clientId, type }` | Send message with deduplication key |
| `message:new` | Server -> Client | `{ _id, conversationId, sender, text, createdAt }` | Broadcast new message to room |
| `ticket:updated` | Server -> Client | `{ ticketId, status, assignedTo }` | Support ticket status transition |
| `call:signal` | Bidirectional | `{ to, signalData, type }` | WebRTC 1:1 offer/answer/ICE exchange |
| `pending:delivered` | Server -> Client | `{}` | Emitted to sender when pending contact joins platform |
| `conversation:request` | Server -> Client | `{ conversationId }` | Emitted to receiver when a new message request arrives |
