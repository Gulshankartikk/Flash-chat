/**
 * index.js — Unified Public E2EE Facade for Flash Chat
 * 
 * Provides end-to-end encryption/decryption, identity lifecycle,
 * and key management methods to the UI and store layers.
 */

import axiosInstance from "../services/url.services";
import {
  generateIdentityKeyPair,
  exportPublicKeyToJWK,
  importPublicKeyFromJWK,
  computeIdentityFingerprint,
} from "./identity";
import {
  saveIdentityKeyPair,
  loadIdentityKeyPair,
  clearIdentityKeyPair,
} from "./keyStorage";
import {
  computeECDHSharedSecret,
  fetchPeerPublicKey,
  cachePeerPublicKey,
  clearPeerKeyCache,
} from "./keyExchange";
import {
  deriveAESGCMKeyFromSecret,
  buildParticipantSalt,
} from "./keyDerivation";
import {
  encryptAESGCM,
  decryptAESGCM,
  buildE2EEEnvelope,
  parseE2EEEnvelope,
} from "./encryption";
import {
  exportEncryptedIdentityBackup,
  restoreEncryptedIdentityBackup,
} from "./recovery";

// In-memory cache for derived session keys: "userIdA:userIdB" -> CryptoKey
const sessionKeyCache = new Map();

/**
 * Initializes the user's local E2EE identity keypair:
 * 1. Checks IndexedDB for existing keypair.
 * 2. If none, generates new ECDH P-256 keypair and saves to IndexedDB.
 * 3. Publishes public key to server if necessary.
 * 
 * @param {string} currentUserId 
 * @returns {Promise<{ keyPair: CryptoKeyPair, publicJwk: JsonWebKey, publicJwkString: string }>}
 */
export async function initializeUserE2EE(currentUserId) {
  let record = await loadIdentityKeyPair(currentUserId);

  if (!record || !record.keyPair) {
    const keyPair = await generateIdentityKeyPair();
    const publicJwk = await exportPublicKeyToJWK(keyPair.publicKey);

    await saveIdentityKeyPair(keyPair, publicJwk, currentUserId);
    record = {
      keyPair,
      publicJwk,
      publicJwkString: JSON.stringify(publicJwk),
    };

    // Publish public key to server (only public key is transmitted)
    try {
      await axiosInstance.put("/users/public-key", {
        publicKey: record.publicJwkString,
      });
    } catch (err) {
      console.warn("[E2EE] Could not publish public key to server:", err);
    }
  } else {
    record.publicJwkString = JSON.stringify(record.publicJwk);
  }

  return record;
}

/**
 * Gets or derives an active 256-bit AES-GCM session key between two users.
 * 
 * @param {string} currentUserId 
 * @param {string} peerUserId 
 * @param {CryptoKey} ownPrivateKey 
 * @param {CryptoKey} peerPublicKey 
 * @returns {Promise<CryptoKey>}
 */
export async function getOrDeriveSessionKey(currentUserId, peerUserId, ownPrivateKey, peerPublicKey) {
  const salt = buildParticipantSalt(currentUserId, peerUserId);
  
  if (sessionKeyCache.has(salt)) {
    return sessionKeyCache.get(salt);
  }

  const sharedSecretBits = await computeECDHSharedSecret(ownPrivateKey, peerPublicKey);
  const sessionKey = await deriveAESGCMKeyFromSecret(sharedSecretBits, salt);
  
  sessionKeyCache.set(salt, sessionKey);
  return sessionKey;
}

/**
 * Encrypts a message for a recipient using True Asymmetric E2EE.
 * 
 * @param {string} plainText - Plaintext message
 * @param {string} recipientUserId - Recipient's user ID
 * @param {string} currentUserId - Sender's user ID
 * @param {string} [conversationId] - Optional fallback ID
 * @returns {Promise<string>} Encrypted envelope string "e2ee:v2:..."
 */
export async function encryptMessage(plainText, recipientUserId, currentUserId, conversationId) {
  if (!plainText) return plainText;

  try {
    const ownRecord = await initializeUserE2EE(currentUserId);
    const peerPublicKey = await fetchPeerPublicKey(recipientUserId);

    if (peerPublicKey && ownRecord?.keyPair?.privateKey) {
      const sessionKey = await getOrDeriveSessionKey(
        currentUserId,
        recipientUserId,
        ownRecord.keyPair.privateKey,
        peerPublicKey
      );

      const { ivHex, cipherHex } = await encryptAESGCM(plainText, sessionKey);
      return buildE2EEEnvelope(ivHex, ownRecord.publicJwk, cipherHex);
    }

    return plainText;
  } catch (err) {
    console.error("[E2EE] Message encryption error:", err);
    return plainText;
  }
}

/**
 * Decrypts an encrypted message envelope using the viewer's private key.
 * Handles both True E2EE v2 envelopes and legacy v1 conversationId envelopes.
 * Supports both recipient and sender decryption.
 * 
 * @param {string} encryptedText - Encrypted envelope string
 * @param {string} senderUserId - Sender's user ID
 * @param {string} currentUserId - Viewer's user ID
 * @param {string} [conversationId] - Optional fallback ID
 * @param {string} [peerUserId] - Peer's user ID (for sender decrypting own message)
 * @returns {Promise<string>} Decrypted plaintext
 */
export async function decryptMessage(encryptedText, senderUserId, currentUserId, conversationId, peerUserId) {
  if (!encryptedText || typeof encryptedText !== "string") return encryptedText;

  // 1. Process True E2EE v2 envelope: "e2ee:v2:<ivHex>:<senderJwkBase64>:<cipherHex>"
  if (encryptedText.startsWith("e2ee:v2:")) {
    try {
      const parsed = parseE2EEEnvelope(encryptedText);
      if (!parsed) return encryptedText;

      const ownRecord = await initializeUserE2EE(currentUserId);
      if (!ownRecord?.keyPair?.privateKey) {
        return "🔒 [Encrypted Message - Key Missing]";
      }

      const isSender = String(currentUserId) === String(senderUserId);
      let sessionKey = null;

      if (isSender) {
        // Viewer is the sender: derive session key using recipient's public key
        const targetRecipientId = peerUserId || (senderUserId !== currentUserId ? senderUserId : null);
        if (targetRecipientId) {
          const peerPublicKey = await fetchPeerPublicKey(targetRecipientId);
          if (peerPublicKey) {
            sessionKey = await getOrDeriveSessionKey(
              currentUserId,
              targetRecipientId,
              ownRecord.keyPair.privateKey,
              peerPublicKey
            );
          }
        }
      } else {
        // Viewer is the recipient: derive session key using sender's public key from the envelope
        const senderPublicKey = await importPublicKeyFromJWK(parsed.senderJwk);
        sessionKey = await getOrDeriveSessionKey(
          currentUserId,
          senderUserId,
          ownRecord.keyPair.privateKey,
          senderPublicKey
        );
      }

      if (sessionKey) {
        return await decryptAESGCM(parsed.cipherBytes, parsed.iv, sessionKey);
      }
    } catch (err) {
      console.warn("[E2EE] v2 Decryption failed:", err);
    }
  }

  // 2. Process Legacy v1 E2EE envelope: "e2ee:<ivHex>:<cipherHex>"
  if (encryptedText.startsWith("e2ee:") && !encryptedText.startsWith("e2ee:v2:")) {
    try {
      const parts = encryptedText.split(":");
      if (parts.length === 3 && conversationId) {
        const [, ivHex, cipherHex] = parts;
        const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const cipherBytes = new Uint8Array(cipherHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

        const enc = new TextEncoder();
        const rawKey = enc.encode(String(conversationId));
        const hash = await window.crypto.subtle.digest("SHA-256", rawKey);
        const legacyKey = await window.crypto.subtle.importKey(
          "raw",
          hash,
          { name: "AES-GCM" },
          false,
          ["decrypt"]
        );
        return await decryptAESGCM(cipherBytes, iv, legacyKey);
      }
    } catch (legacyErr) {
      console.warn("[E2EE] Legacy decryption failed:", legacyErr);
    }
  }

  // 3. Fallback for un-decryptable ciphertext
  if (encryptedText.startsWith("e2ee:")) {
    return "🔒 [Encrypted Message]";
  }

  // 4. Plaintext message
  return encryptedText;
}

// Re-export modular primitives
export {
  generateIdentityKeyPair,
  exportPublicKeyToJWK,
  importPublicKeyFromJWK,
  computeIdentityFingerprint,
  saveIdentityKeyPair,
  loadIdentityKeyPair,
  clearIdentityKeyPair,
  computeECDHSharedSecret,
  fetchPeerPublicKey,
  cachePeerPublicKey,
  clearPeerKeyCache,
  deriveAESGCMKeyFromSecret,
  buildParticipantSalt,
  encryptAESGCM,
  decryptAESGCM,
  buildE2EEEnvelope,
  parseE2EEEnvelope,
  exportEncryptedIdentityBackup,
  restoreEncryptedIdentityBackup,
};
