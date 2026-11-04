# 🛡️ Security Policy - Flash Chat

At Flash Chat, security and user privacy are foundational. This document outlines our cryptographic standards, authentication model, threat model, and vulnerability reporting procedures.

---

## 🔐 Cryptographic Architecture

### 1. Asymmetric End-to-End Encryption (E2EE)
- **Algorithm**: Elliptic Curve Diffie-Hellman (**ECDH**) on Curve **P-256** (secp256r1) + **HKDF-SHA256** + **AES-256-GCM**.
- **Key Storage**: Private keys are generated and stored exclusively in the browser's hardware-backed/sandboxed **IndexedDB** (`FlashChat_E2EE_Keystore`). Private keys are non-extractable (`extractable: false`) whenever possible.
- **Key Exchange**: Public keys are published to the user directory and embedded in message envelopes (`e2ee:v2:<iv_hex>:<sender_public_jwk_base64>:<ciphertext_hex>`), allowing immediate zero-roundtrip decryption across devices.
- **Zero-Knowledge Server**: The server only stores opaque ciphertext blobs and IVs. Neither database administrators nor network sniffers can inspect message contents.

### 2. Encrypted Backups
- **Algorithm**: Client-Side **PBKDF2** (100,000 iterations, SHA-256) deriving an **AES-256-GCM** key.
- **Password Safety**: The backup password never leaves the user's browser. Decryption occurs purely client-side before parsing.

---

## 🔑 Authentication & Session Security

- **Short-Lived Access Tokens**: JWT Access tokens expire in 15 minutes and are stored in `HttpOnly`, `Secure`, `SameSite=Strict` cookies.
- **Rotating Refresh Tokens**: 7-day refresh tokens are bound to active device sessions and rotated upon renewal.
- **Session Revocation**: Users can view all active login sessions (IP, User Agent, last active timestamp) and revoke specific devices or log out from all other devices remotely.
- **Rate Limiting**: Tiered DDoS and brute-force protection across authentication and AI endpoints.

---

## 🐛 Reporting a Vulnerability

If you discover a potential security vulnerability in Flash Chat, please report it privately:

1. **Email**: `security@flashchat.dev` (or open a private security advisory on GitHub).
2. **Details**: Include steps to reproduce, potential impact, and affected components.
3. **Response Time**: We aim to acknowledge reports within 24 hours and patch critical issues promptly.
