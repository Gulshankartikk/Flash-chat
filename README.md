# ⚡ Flash Chat — Production Real-Time Communication Platform

Flash Chat is an enterprise-ready, WhatsApp-inspired full-stack communication platform built with React, Node.js/Express, Socket.io, WebRTC, and MongoDB. It supports end-to-end encrypted messaging, peer-to-peer audio and video calling, rich media sharing, Google Gemini AI writing assistance, and multi-device session management.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Key Features](#key-features)
3. [Tech Stack](#tech-stack)
4. [Folder Structure](#folder-structure)
5. [How the Application Works](#how-the-application-works)
   - [Authentication Flow](#authentication-flow)
   - [Chat & Message Flow](#chat--message-flow)
   - [Socket.io Event Architecture](#socketio-event-architecture)
   - [WebRTC Audio & Video Calling Flow](#webrtc-audio--video-calling-flow)
   - [AI Assistant & Writing Flow](#ai-assistant--writing-flow)
6. [Code Connection Map](#code-connection-map)
7. [Database Schema & Models](#database-schema--models)
8. [Environment Variables](#environment-variables)
9. [Installation & Setup](#installation--setup)
10. [WebRTC & STUN/TURN Configuration](#webrtc--stunturn-configuration)
11. [AI Configuration](#ai-configuration)
12. [Two-User Testing Guide](#two-user-testing-guide)
13. [Troubleshooting & Common Errors](#troubleshooting--common-errors)
14. [Security](#security)
15. [Performance & Reliability Optimizations](#performance--reliability-optimizations)

---

## Architecture Overview

Flash Chat decouples UI rendering, state management, HTTP API interactions, real-time WebSocket signaling, and peer-to-peer WebRTC media streaming into discrete layers.

### Client-Server Data Flow

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 BROWSER                                     │
│                                                                             │
│  ┌─────────────────────────┐            ┌────────────────────────────────┐  │
│  │   Sidebar (Nav Rail)    │            │   ChatWindow (Header, Msgs,    │  │
│  │   Left Pane (HomePage)  │            │   Composer, AI Suggestions)    │  │
│  └───────────┬─────────────┘            └───────────────┬────────────────┘  │
│              │                                          │                   │
│              ▼                                          ▼                   │
│    useLayoutStore / useUserStore              useChatStore / useWebRTC      │
│              │                                          │                   │
│              ▼                                          ▼                   │
│       Axios REST API                           Socket.io Client             │
└──────────────┬──────────────────────────────────────────┬───────────────────┘
               │ HTTP Requests                            │ WebSocket Events
               ▼                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               BACKEND SERVER                                │
│                                                                             │
│   Express HTTP Router ◄──────────────────────── SocketService               │
│   (Auth, Chat, Contacts, AI, Status)            (Signaling, Presence, Msgs) │
│              │                                          │                   │
│              ▼                                          ▼                   │
│      MongoDB Models (User, Conversation, Message, Contact)                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### WebRTC Signaling vs. Media Streaming

```text
       ┌───────────────┐                                     ┌───────────────┐
       │ User A Client │                                     │ User B Client │
       └───────┬───────┘                                     └───────┬───────┘
               │                 1. Socket.io Signaling              │
               │ ── call_user (Offer SDP) ─────────────────────────► │
               │ ◄─ call_accepted (Answer SDP) ────────────────────  │
               │ ◄─ ice_candidate (STUN/TURN Gathering) ───────────► │
               │                                                     │
               │                 2. Peer-to-Peer Media               │
               │ ◄═════════ Direct WebRTC Media Streams ═══════════► │
               │            (Encrypted SRTP Audio & Video)           │
```

- **Socket.io**: Transmits signaling metadata only (SDP offers, SDP answers, ICE candidates, call accept/reject/end events).
- **WebRTC**: Carries encrypted RTP audio, video, and screen-sharing media packets directly between user browsers.
- **MongoDB**: Persists users, contacts, conversations, and message history.

---

## Key Features

- **Decoupled Scroll Architecture**: Independent scroll containers for contacts and messages. Scrolling long message threads never causes the contact list to jump or disappear.
- **Real-Time Messaging**: Instant delivery via Socket.io with HTTP fallback, optimistic UI updates, delivered/read receipts, typing indicators, and emoji reactions.
- **Precision Emoji Picker**: Inserts emojis at the cursor selection point inside the composer instead of naively appending to the end of the text.
- **Flash AI Assistant & Writing Suite**:
  - ✨ Improve & Polish
  - ✨ Fix Grammar & Spelling
  - ✨ Professional Tone
  - ✨ Casual & Friendly
  - ✨ Shorten & Concise
  - ✨ Expand & Detail
  - ✨ Translate to English
  - 💡 Smart Replies (contextual quick reply chips)
  - 🤖 Offline local heuristic fallback when Gemini API keys are absent.
- **Real WebRTC Audio & Video Calling**:
  - Live `getUserMedia()` camera and microphone integration.
  - Ringing, Connecting, Connected, Busy, and Ended states with custom dark-mode UI.
  - In-call microphone mute/unmute, camera toggle, and screen sharing.
  - Automatic peer cleanup on tab close, network loss, or socket disconnect.
- **Contact & Group Management**:
  - User search by username and email.
  - Contact requests (Send, Accept, Reject, Block).
  - Group creation with custom photo upload and multi-member selection.
  - Group invite links with preview dialogs.
- **True End-to-End Encryption (E2EE)**:
  - Client-side Web Crypto ECDH (Curve P-256) + AES-GCM (256-bit).
  - Keys generated on-device and stored in hardware-isolated IndexedDB.
- **Enterprise Authentication**:
  - Dual-token architecture: Short-lived access JWTs + rotating refresh JWTs.
  - Multi-device active session tracking with remote revocation.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Tailwind CSS, Framer Motion, Lucide React, Zustand, Axios, Socket.io-client |
| **Backend** | Node.js, Express, Socket.io, Mongoose, Multer, Cloudinary, JWT |
| **Database** | MongoDB (with compound indexes on participants and message timestamps) |
| **Real-Time** | WebSocket / Socket.io engine |
| **Media Calling** | WebRTC (RTCPeerConnection, STUN/TURN, getUserMedia) |
| **AI Engine** | Google Gemini Flash API (`@google/genai` REST) with local heuristic fallback |
| **Cryptography** | Native Web Crypto API (ECDH P-256, AES-256-GCM, PBKDF2) |

---

## Folder Structure

```text
Flash-chat/
├── backend/
│   ├── config/               # MongoDB, Cloudinary, Redis configurations
│   ├── constants/
│   │   └── socketEvents.js   # Centralized Socket.io event name registry
│   ├── controllers/          # HTTP request handlers (Auth, Chat, User, Contact)
│   ├── middleware/           # authMiddleware, rate-limiters, multer upload
│   ├── models/               # Mongoose models (User, Message, Conversation, Contact)
│   ├── routes/               # Express route declarations
│   ├── services/             # socketService, aiService, twilioService
│   ├── tests/                # Automated Jest test suites (E2E calling, AI, E2EE)
│   ├── server.js             # HTTP server & Socket.io initialization
│   └── .env.example          # Backend environment template
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ai/           # AI suggestion banners & rewriter popovers
│   │   │   ├── calls/        # Call modal, local/remote video grids, call controls
│   │   │   ├── chat/         # MessageList, MessageBubble, ChatInput, ChatHeader
│   │   │   ├── contacts/     # ContactsPanel, AddContactModal, ContactList
│   │   │   ├── layout/       # Sidebar nav rail, ThemeDialog
│   │   │   ├── HomePage.jsx  # Main sidebar coordinator (Chats / Contacts views)
│   │   │   └── Layout.jsx    # Split-view desktop/mobile responsive shell
│   │   ├── constants/
│   │   │   └── socketEvents.js # Centralized client socket event registry
│   │   ├── context/
│   │   │   └── CallContext.jsx # Global WebRTC call provider & state
│   │   ├── hooks/
│   │   │   ├── useWebRTC.js    # RTCPeerConnection lifecycle & media tracks
│   │   │   └── useNotifications.js # Socket notification listeners
│   │   ├── pages/
│   │   │   └── chatSection/
│   │   │       └── ChatWindow.jsx # Active chat area container
│   │   ├── services/
│   │   │   ├── chat.services.js # Socket.io emit/on wrappers
│   │   │   └── url.services.js  # Axios instance with refresh interceptors
│   │   ├── store/            # Zustand stores (chatStore, useUserStore, useLayoutStore)
│   │   └── utils/            # E2EE Web Crypto engine & backup decoders
│   └── .env.example          # Frontend environment template
│
└── README.md
```

---

## How the Application Works

### Authentication Flow
1. User logs in via Email OTP, SMS OTP, or Google OAuth 2.0 (`POST /api/auth/*`).
2. Server validates credentials, generates an Access JWT (15-min expiry) and Refresh JWT (7-day expiry).
3. Tokens are stored in secure `HttpOnly` cookies.
4. Active session record (IP, User Agent, device type) is saved to the user's `activeSessions` array in MongoDB.
5. Axios response interceptors monitor API calls: if a 401 Unauthorized occurs, `POST /api/auth/refresh-token` automatically obtains a fresh token and retries the original request without UI interruption.

### Chat & Message Flow
1. User types in `ChatInput.jsx`.
2. As the user types, debounced Socket events (`typing_start`) inform the recipient.
3. User clicks Send or presses Enter:
   - Message is optimistically appended to Zustand `chatStore.messages`.
   - Client emits `send_message` over Socket.io.
   - Server receives message in `socketService.js`, checks blocklists, saves to MongoDB, and updates `Conversation.lastMessage`.
   - Server broadcasts `receive_message` and `new_notification` to recipient's socket.
   - Receiver receives message and emits `message_read`, which updates tick marks to double-blue on the sender's client.

### Socket.io Event Architecture
All socket events are standardized in `backend/constants/socketEvents.js` and `frontend/src/constants/socketEvents.js`:

| Event Constant | Direction | Description |
|---|---|---|
| `USER_CONNECTED` | Client ➔ Server | Registers user socket, sets `isOnline: true`, broadcasts status |
| `USER_STATUS` | Server ➔ Client | Informs clients of user online/offline status change |
| `SEND_MESSAGE` | Client ➔ Server | Dispatches a message to private peer or group |
| `RECEIVE_MESSAGE` | Server ➔ Client | Delivers message payload to recipient |
| `MESSAGE_READ` | Client ➔ Server | Acknowledges message receipt and read status |
| `TYPING_START` / `TYPING_STOP` | Client ➔ Server | Relays user typing activity with 3s auto-cancel timers |
| `CALL_USER` | Client ➔ Server | Initiates call with SDP offer and call metadata |
| `INCOMING_CALL` | Server ➔ Client | Triggers incoming ringing modal on recipient device |
| `ACCEPT_CALL` | Client ➔ Server | Transmits SDP answer back to caller |
| `CALL_ACCEPTED` | Server ➔ Client | Notifies caller; media connection transitions to connected |
| `REJECT_CALL` / `CANCEL_CALL` | Client ➔ Server | Declines or cancels call attempt |
| `END_CALL` / `CALL_ENDED` | Both | Closes peer connection and releases media tracks |
| `ICE_CANDIDATE` | Both | Relays STUN/TURN network routing candidates |
| `MEDIA_STATE_CHANGED` | Both | Synchronizes microphone mute and camera disable states |

### WebRTC Audio & Video Calling Flow
1. **Call Initiation**: Caller clicks Phone (audio) or Video icon in `ChatHeader.jsx`.
2. **Local Media**: `useWebRTC.js` calls `navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo })`. Local stream attaches to the local `<video>` element.
3. **Offer Generation**: `RTCPeerConnection` creates an SDP offer (`createOffer()`) and sets it as local description.
4. **Signaling**: Client emits `call_user` through Socket.io with the offer SDP.
5. **Ringing**: Receiver socket receives `incoming_call`. The incoming call modal rings with caller avatar and name.
6. **Answer**: Receiver clicks "Accept". Receiver's `useWebRTC.js` captures media, sets the caller's offer as remote description, generates an SDP answer (`createAnswer()`), sets local description, and emits `accept_call`.
7. **ICE Candidate Exchange**: As STUN servers discover public IPs/ports, both peers exchange `ice_candidate` events via Socket.io and add them using `addIceCandidate()`.
8. **Connected State**: Direct encrypted P2P RTP audio/video stream begins playing.

### AI Assistant & Writing Flow
1. **Input Composition**: When a user drafts a message in `ChatInput.jsx`, an AI Sparkle icon appears.
2. **Writing Menu**: User can select from 7 tone adjustments:
   - *Improve & Polish*, *Fix Grammar*, *Professional*, *Casual*, *Shorten*, *Expand*, *Translate to English*.
3. **API Processing**: Frontend calls `POST /api/chat/ai/rewrite` with `{ text, style }`.
4. **Backend AI Service**: `backend/services/aiService.js` routes the request to Google Gemini Flash API (`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`).
5. **Offline Fallback**: If `GEMINI_API_KEY` is not configured, the service seamlessly falls back to smart local heuristic rules.
6. **Safety**: Suggestions are inserted into the draft input field. The AI **never** automatically sends messages without user confirmation.

---

## Code Connection Map

When maintaining or extending Flash Chat, consult this map to identify interrelated files:

```text
Message Sending & Realtime Delivery:
  frontend/src/components/chat/ChatInput.jsx
    ↓ (onSend)
  frontend/src/pages/chatSection/ChatWindow.jsx
    ↓ (handleSend)
  frontend/src/store/chatStore.js
    ↓ (sendMessage)
  frontend/src/services/socketService.js / chat.services.js
    ↓ (emit "send_message")
  backend/services/socketService.js
    ↓ (socket.on "send_message")
  backend/models/message.js & Conversation.js

Audio / Video Calling Pipeline:
  frontend/src/components/chat/ChatHeader.jsx
    ↓ (onVoiceCall / onVideoCall)
  frontend/src/context/CallContext.jsx
    ↓ (startCall)
  frontend/src/hooks/useWebRTC.js
    ↓ (RTCPeerConnection + getUserMedia)
  frontend/src/constants/socketEvents.js
    ↓ (CALL_USER, ACCEPT_CALL, ICE_CANDIDATE)
  backend/services/socketService.js
    ↓ (activeCalls map & userSockets dispatch)
  frontend/src/components/calls/CallScreen.jsx (CallControls, Video Grid)

AI Writing & Smart Suggestions:
  frontend/src/components/chat/ChatInput.jsx
    ↓ (handleAIRewrite)
  frontend/src/components/chat/AISuggestions.jsx
    ↓ (fetchSuggestions)
  frontend/src/services/url.services.js
    ↓ (POST /api/chat/ai/*)
  backend/routes/chatRoute.js
    ↓
  backend/controllers/chatController.js
    ↓
  backend/services/aiService.js (Gemini API + Local Heuristic Fallback)

Layout & Scroll Decoupling:
  frontend/src/components/Layout.jsx (Outer h-screen overflow-hidden container)
    ├── Left: frontend/src/components/HomePage.jsx (flex-1 min-h-0 overflow-y-auto)
    └── Right: frontend/src/pages/chatSection/ChatWindow.jsx
          └── frontend/src/components/chat/MessageList.jsx (flex-1 min-h-0 overflow-y-auto)
```

---

## Database Schema & Models

```text
User
 ├── username (unique, indexed)
 ├── email (unique, indexed)
 ├── password (bcrypt hashed)
 ├── profilePicture, about, isOnline, lastSeen
 ├── privacySettings (readReceipts, lastSeenVisibility)
 ├── blockedUsers -> [User ObjectId]
 └── activeSessions -> [{ device, ip, userAgent, lastActive, tokenHash }]

Conversation
 ├── conversationType ("private" | "group")
 ├── participants -> [User ObjectId] (compound indexed)
 ├── groupName, groupPhoto, groupAdmin -> [User ObjectId]
 ├── inviteCode (unique index)
 ├── lastMessage -> Message ObjectId
 └── pinnedMessages -> [Message ObjectId]

Message
 ├── sender -> User ObjectId
 ├── conversation -> Conversation ObjectId
 ├── content (AES ciphertext or plaintext)
 ├── messageType ("text" | "image" | "video" | "audio" | "document")
 ├── messageStatus ("sent" | "delivered" | "read")
 ├── replyTo -> Message ObjectId
 ├── reactions -> [{ user: User ObjectId, emoji: String }]
 └── isPinned, isDeleted, isEdited, editedAt
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
# Server
PORT=8000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
MONGO_URI=mongodb://127.0.0.1:27017/flashchat

# Authentication
JWT_SECRET=replace_with_a_secure_jwt_secret_minimum_32_characters
JWT_REFRESH_SECRET=replace_with_a_secure_refresh_secret_minimum_32_characters

# Cloudinary (Media Uploads)
CLOUDINARY_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Google Gemini AI (Optional - local fallback provided if absent)
GEMINI_API_KEY=your_gemini_api_key
```

### Frontend (`frontend/.env`)

```env
# Backend API Base URL
REACT_APP_API_URL=http://localhost:8000

# WebRTC STUN/TURN (Optional - defaults to Google public STUN)
REACT_APP_STUN_SERVER=stun:stun.l.google.com:19302
REACT_APP_TURN_SERVER=
REACT_APP_TURN_USERNAME=
REACT_APP_TURN_CREDENTIAL=
```

---

## Installation & Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **MongoDB**: v5.0 or higher running locally or MongoDB Atlas URI

### 1. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```
Backend runs on `http://localhost:8000`.

### 2. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
npm start
```
Frontend runs on `http://localhost:3000`.

### 3. Production Build
```bash
cd frontend
npm run build
```
Creates an optimized production bundle in `frontend/build/`.

---

## WebRTC & STUN/TURN Configuration

Flash Chat includes default public STUN servers out of the box:
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`

For carrier-grade deployments across Symmetric NAT networks or cellular carriers that block UDP:
1. Obtain TURN credentials (e.g. from Twilio Network Traversal, Xirsys, or Coturn).
2. Set `REACT_APP_TURN_SERVER`, `REACT_APP_TURN_USERNAME`, and `REACT_APP_TURN_CREDENTIAL` in `frontend/.env`.

---

## AI Configuration

Flash Chat uses Google Gemini 2.5 Flash for high-speed generative suggestions.
- Add your API key to `backend/.env`: `GEMINI_API_KEY=your_key_here`.
- If `GEMINI_API_KEY` is omitted, the application operates in **local offline mode**: all rewrite tones and smart reply suggestions function with built-in heuristic NLP engines without throwing errors.

---

## Two-User Testing Guide

To test real-time features between two concurrent users on a local machine:

1. **Window 1 (User A)**: Open regular browser at `http://localhost:3000`.
2. **Window 2 (User B)**: Open an Incognito / Private browsing window at `http://localhost:3000`.
3. **Log in / Sign up**:
   - Window 1: Sign in with User A (e.g. `gulshan@example.com` - Gulshan / Gullu).
   - Window 2: Sign in with User B (e.g. `kartik@example.com` - Kartik).
4. **Contacts**: In Window 1, search for Kartik and click to start a conversation.
5. **Real-Time Messages**:
   - Window 1 sends: *"Hey Kartik, how are you?"*
   - Window 2 receives the message instantly via Socket.io with a green notification badge.
   - Window 2 replies: *"All good Gulshan!"*
6. **Typing Indicators**:
   - As Window 1 types, Window 2 shows *"typing..."* under the chat header.
7. **Audio / Video Calling**:
   - In Window 1, click the Video Call icon in the chat header.
   - Window 2 displays the incoming call screen with accept and decline buttons.
   - Click "Accept" in Window 2: WebRTC peer connection initializes, streams media, and displays local and remote video feeds.
   - Click Mute or Camera Off to verify in-call track controls.
   - Click End Call: both sides cleanly release media devices and return to the chat screen.
8. **Independent Scrolling**:
   - Scroll through the message list in Window 1: verify the contact list on the left remains visible and fixed in place.

---

## Troubleshooting & Common Errors

| Issue | Cause | Fix |
|---|---|---|
| `Cannot connect to Socket.io` | CORS origin mismatch or port conflict | Verify `FRONTEND_URL` in `backend/.env` matches frontend host (e.g. `http://localhost:3000`). |
| `Microphone/Camera permission denied` | Browser blocked media permissions | Open browser settings and allow camera/microphone for `localhost:3000`. In development, use `localhost` or `https://` (browsers block WebRTC on raw HTTP IPs). |
| `Message stuck on sent` | Recipient offline | Message is stored in MongoDB. Once recipient connects, socket sync updates status to delivered. |
| `AI Suggestions unavailable` | Missing Gemini key | Application automatically falls back to local heuristic mode; add `GEMINI_API_KEY` to backend `.env` for generative AI. |

---

## Security

- **ECDH P-256 E2EE**: Browser-level end-to-end encryption ensures the server only ever receives and persists encrypted ciphertext envelopes.
- **Hardware-Isolated Keystore**: Private keys remain strictly on the client device inside non-exportable IndexedDB storage.
- **Strict Content Security & Rate Limiting**: AI endpoints and authentication endpoints are throttled to prevent brute force and resource exhaustion.
- **Cookie-Hardened Sessions**: Access and refresh tokens are transmitted via `HttpOnly`, `SameSite=Strict`, `Secure` cookies to prevent XSS credential theft.

---

## Performance & Reliability Optimizations

Flash Chat has been systematically audited and optimized across frontend startup, state management, React rendering, real-time messaging, and database queries:

### 1. Instant Startup & Persistent Route Architecture
- **Persistent Layout Shell**: Protected tab routes (`/`, `/user-profile`, `/status`, `/setting`) now share a persistent `<Layout />` wrapper with `<Outlet />`. Navigating between chats, contacts, status, and settings never unmounts the layout shell, nav rail, or theme managers.
- **Session Verification Cooldown**: `useBackgroundAuthSync` and `checkUserAuth` implement an in-flight singleton promise with a 5-minute session cooldown, preventing duplicate `/check-auth` requests on navigation.
- **Deduplicated Script Ingestion**: Third-party external scripts (such as Google Identity Services) are guarded against redundant DOM appends on route re-entry.

### 2. Infinite Scroll & Cursor Pagination
- **Chunked Message Fetching**: `openConversation()` loads a lightweight initial batch of the latest 30 messages (`limit=30`).
- **Seamless History Loading**: Scrolling upward triggers `loadOlderMessages()`, fetching older chunks using `before=${oldestMessage.createdAt}` cursor pagination.
- **Scroll Position Restoration**: Formula `newScrollTop = newScrollHeight - oldScrollHeight + oldScrollTop` prevents layout jumps when prepending historical messages.

### 3. High-Performance React Rendering & Crypto Caching
- **Memoized Message Bubbles**: `MessageBubble` is wrapped in `React.memo` with custom prop comparators, preventing unaffected bubbles from re-rendering when typing indicators toggle or new messages arrive.
- **Synchronous Plaintext Fast-Path**: Normal plaintext messages (non-`e2ee:`) bypass dynamic `import()` and asynchronous decryption pipelines, rendering synchronously.
- **In-Memory Decryption Cache**: Decrypted plaintext and conversation preview strings are cached in memory (`decryptedCache` and `previewCache`), eliminating redundant AES-GCM / ECDH decryption during scroll gestures.

### 4. Efficient AI Suggestions & Request Safeguards
- **Stable Hook Dependencies**: `fetchSuggestions` in `ChatInput` relies on primitive message and conversation identifiers, preventing redundant requests on every re-render.
- **Early Rejection**: Empty, whitespace, or encrypted messages immediately bypass `/chat/ai/suggestions` calls, eliminating unnecessary backend compute.

### 5. Database Indexing & Connection Pooling
- **Message Model Indexes**: Added compound indexes `{ conversation: 1, deletedFor: 1, createdAt: -1 }` and `{ conversation: 1, sender: 1, createdAt: -1 }` for high-speed paginated query execution.
- **Contact Model Indexes**: Added `{ receiver: 1, status: 1 }` and `{ sender: 1, status: 1 }` compound indexes, eliminating collection scans on contact and request lists.
- **User Model Indexes**: Added `{ blockedUsers: 1 }` and `{ isOnline: 1, lastSeen: -1 }` for rapid user queries and presence updates.
- **Connection Tuning**: Mongoose configured with `maxPoolSize: 50`, `minPoolSize: 5`, and `serverSelectionTimeoutMS: 5000`. Redis configured with `connectTimeout: 500` and `enableOfflineQueue: false` for immediate fallback in dev environments.

### 6. Memory Leak Prevention
- **Object URL Cleanup**: Temporary blob previews (`URL.createObjectURL`) for attachments are systematically revoked via `URL.revokeObjectURL` upon message submission or error.
- **Socket Idempotency**: All real-time event listeners and timers are cleanly guarded against duplicate attachment.

