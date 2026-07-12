# 🚀 Flash Chat - Premium Real-Time Messaging Web App

Flash Chat is a production-grade, secure, and feature-rich real-time messaging application. It features end-to-end encryption, an integrated AI assistant, a robust backup/restore system, and a high-performance caching and security architecture.

---

## ✨ Key Features

### 💬 Core Chat & Messaging
*   **Real-Time Communication**: Seamless messaging powered by **Socket.io**.
*   **Message Reactions & Replies**: Express yourself with quick reactions (👍❤️😂😢) and threaded replies.
*   **Edit & Delete**: Edit messages or delete them for everyone.
*   **Typing & Presence Indicators**: See when contacts are typing or online/offline.
*   **Group Chats**: Create group conversations with custom names and profile pictures. Direct messaging and group notifications update in real-time.
*   **Group Admin Controls**: Manage group membership (add/remove participants) and promote users to group admins.
*   **User Blocking**: Block/unblock contacts to stop unwanted messages. Block status is enforced server-side and on sockets.
*   **Privacy Visibility Settings**: Configure visibility settings (`everyone`, `contacts`, `nobody`) for your Last Seen status, profile photo, and "About" info. Toggle read receipts on or off.

### 🤖 Flash AI Chatbot
*   **Integrated AI Assistant**: Chat directly with "Flash AI" via the quick-access sidebar banner.
*   **Double Engine**: Powered by the **Google Gemini API** (via `GEMINI_API_KEY`) with an offline conversational fallback.
*   **Asynchronous Responses**: Simulates natural typing behavior and responds in real-time.

### 🔐 Client-Side End-to-End Encryption (E2EE)
*   **Zero-Knowledge Privacy**: Message contents are encrypted client-side using **AES-GCM** via the browser's native **Web Crypto API**.
*   **Key Derivation**: Unique encryption keys are derived on the fly per conversation using the `conversationId`.
*   **Encrypted in Transit & Rest**: Messages are encrypted before hitting the network or database and are decrypted on the fly in the UI, marked by a secure green lock icon 🔒.

### ☁️ E2EE Backup & Restore
*   **Encrypted Backups**: Export your entire chat history into a password-protected `.enc` file.
*   **PBKDF2 Key Derivation**: Derives a secure key from your password using PBKDF2 to encrypt the backup client-side. The server never receives your backup password.
*   **Smart Merge Restore**: Import backups; the backend matches participants by email/phone, merges messages, avoids duplicates, and updates your inbox.

### ⚡ Redis Caching Layer
*   **High Performance**: User profiles and authentication sessions are cached in **Redis** to minimize MongoDB queries.
*   **Graceful Fallback**: If Redis or its package is unavailable, it automatically falls back to a custom in-memory TTL cache, ensuring zero downtime in local development.

### 🛡️ Rate Limiting & Security
*   **DDoS Protection**: Express rate limiting applied globally to all API endpoints.
*   **Brute-Force Protection**: Stricter limits applied to OTP generation and verification routes.
*   **In-Memory Fallback**: Uses a custom IP-tracking fallback if the `express-rate-limit` package is missing.

### 🐳 Docker Orchestration
*   **Single-Command Setup**: Fully containerized environment using `docker-compose.yml`.
*   **Services Included**:
    *   `frontend`: React application built and served via **Nginx**.
    *   `backend`: Node.js Express server.
    *   `redis`: Redis cache.
    *   `mongo`: MongoDB database.

### 🚀 CI/CD Pipeline
*   **Automated Verification**: GitHub Actions workflow (`.github/workflows/ci-cd.yml`) that automatically installs dependencies, lints, and builds the frontend/backend on every push or pull request to the `main` branch.

---

## 🛠️ Tech Stack
*   **Frontend**: React, TailwindCSS, Lucide Icons, Axios, Socket.io-client, Web Crypto API.
*   **Backend**: Node.js, Express, Socket.io, Mongoose (MongoDB), JSON Web Tokens (JWT), Cloudinary.
*   **Caching & Infra**: Redis, Docker, Nginx, GitHub Actions.

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   MongoDB & Redis (if running locally)
*   Or **Docker** (recommended)

---

### Run with Docker (Recommended)
You can start the entire stack (Frontend, Backend, Redis, MongoDB) with a single command:
```bash
docker-compose up --build
```
*   Frontend: `http://localhost:3000`
*   Backend: `http://localhost:8000`

---

### Run Locally (Development Mode)

#### 1. Configure Environment Variables
Create a `.env` file in the `backend` directory:
```env
PORT=8000
MONGO_URI=mongodb://127.0.0.1:27017/flash-chat
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:3000
CLOUDINARY_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
GEMINI_API_KEY=your_gemini_api_key
```

#### 2. Start the Backend
```bash
cd backend
npm install
npm run dev
```

#### 3. Start the Frontend
```bash
cd frontend
npm install
npm start
```
*   The frontend will open at `http://localhost:3000`.
