import axiosInstance from "../services/url.services";

const DB_NAME = "FlashChat_E2EE_Keystore";
const DB_VERSION = 1;
const STORE_NAME = "keypair";
const KEY_ID = "device_identity_keypair";

// In-memory public key cache: userId -> { jwkString, timestamp }
const publicKeyCache = new Map();
// In-memory derived AES-GCM key cache: peerUserId -> CryptoKey
const derivedKeyCache = new Map();

/**
 * Open or initialize the client-side IndexedDB keystore.
 */
function openKeyDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save CryptoKeyPair to IndexedDB.
 */
async function saveKeyPairToDB(keyPair, publicJwk) {
  const db = await openKeyDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ keyPair, publicJwk, createdAt: Date.now() }, KEY_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Load CryptoKeyPair from IndexedDB.
 */
async function loadKeyPairFromDB() {
  const db = await openKeyDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(KEY_ID);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve existing ECDH keypair or generate a new one and register with the backend.
 * @param {string} currentUserId - The authenticated user's ID
 * @returns {Promise<{ keyPair: CryptoKeyPair, publicJwk: Object, publicJwkString: string }>}
 */
export async function initializeUserE2EE(currentUserId) {
  try {
    let record = await loadKeyPairFromDB();

    if (!record || !record.keyPair) {
      // Generate new ECDH P-256 key pair
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: "ECDH",
          namedCurve: "P-256",
        },
        true, // extractable for export
        ["deriveKey", "deriveBits"]
      );

      const publicJwk = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
      const publicJwkString = JSON.stringify(publicJwk);

      await saveKeyPairToDB(keyPair, publicJwk);
      record = { keyPair, publicJwk, publicJwkString };

      // Publish public key to server
      try {
        await axiosInstance.put("/users/public-key", { publicKey: publicJwkString });
      } catch (uploadErr) {
        console.warn("Failed to publish E2EE public key to server:", uploadErr);
      }
    } else {
      record.publicJwkString = JSON.stringify(record.publicJwk);
    }

    return record;
  } catch (err) {
    console.error("E2EE Initialization failed:", err);
    throw err;
  }
}

/**
 * Fetch and cache a peer user's public key from the backend.
 * @param {string} peerUserId - The peer's user ID
 * @returns {Promise<CryptoKey|null>}
 */
export async function getPeerPublicKey(peerUserId) {
  if (!peerUserId) return null;

  // Check in-memory cache (valid for 10 minutes)
  const cached = publicKeyCache.get(peerUserId);
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    return cached.cryptoKey;
  }

  try {
    const res = await axiosInstance.get(`/users/${peerUserId}/public-key`);
    const jwkString = res?.data?.data?.publicKey;

    if (!jwkString) return null;

    const jwk = JSON.parse(jwkString);
    const cryptoKey = await window.crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "ECDH", namedCurve: "P-256" },
      true,
      []
    );

    publicKeyCache.set(peerUserId, { cryptoKey, jwkString, timestamp: Date.now() });
    return cryptoKey;
  } catch (err) {
    console.warn(`Could not fetch public key for user ${peerUserId}:`, err);
    return null;
  }
}

/**
 * Derive an AES-GCM shared key from own private key and peer's public key.
 * @param {CryptoKey} ownPrivateKey
 * @param {CryptoKey} peerPublicKey
 * @param {string} saltString
 * @returns {Promise<CryptoKey>}
 */
async function deriveSharedAESKey(ownPrivateKey, peerPublicKey, saltString = "FlashChat-E2EE-v2-Salt") {
  const enc = new TextEncoder();
  const salt = enc.encode(saltString);

  // Derive bits from ECDH
  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: peerPublicKey,
    },
    ownPrivateKey,
    256
  );

  // Import derived bits into HKDF base key
  const hkdfKey = await window.crypto.subtle.importKey(
    "raw",
    derivedBits,
    { name: "HKDF" },
    false,
    ["deriveKey"]
  );

  // Derive 256-bit AES-GCM key with HKDF
  return window.crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info: enc.encode("FlashChat-Message-Encryption"),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a message using true Asymmetric E2EE (ECDH + AES-256-GCM).
 * Format: "e2ee:v2:<iv_hex>:<sender_public_jwk_base64>:<ciphertext_hex>"
 * 
 * @param {string} plainText - The message to encrypt
 * @param {string} recipientUserId - The recipient's user ID
 * @param {string} currentUserId - The sender's user ID
 * @param {string} conversationId - Fallback conversation ID
 * @returns {Promise<string>} Encrypted string
 */
export async function encryptMessage(plainText, recipientUserId, currentUserId, conversationId) {
  try {
    if (!plainText) return plainText;

    // Load or initialize our own keypair
    const ownRecord = await initializeUserE2EE(currentUserId);
    const peerPublicKey = await getPeerPublicKey(recipientUserId);

    if (peerPublicKey && ownRecord?.keyPair?.privateKey) {
      // 🔐 TRUE ASYMMETRIC E2EE
      const salt = [currentUserId, recipientUserId].sort().join(":");
      const cacheKey = `${currentUserId}_${recipientUserId}`;
      
      let aesKey = derivedKeyCache.get(cacheKey);
      if (!aesKey) {
        aesKey = await deriveSharedAESKey(ownRecord.keyPair.privateKey, peerPublicKey, salt);
        derivedKeyCache.set(cacheKey, aesKey);
      }

      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const enc = new TextEncoder();
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        enc.encode(plainText)
      );

      const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, "0")).join("");
      const cipherHex = Array.from(new Uint8Array(ciphertext))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const publicJwkBase64 = btoa(ownRecord.publicJwkString);

      return `e2ee:v2:${ivHex}:${publicJwkBase64}:${cipherHex}`;
    }

    // Fallback: Legacy conversationId-based key derivation if recipient has no public key yet
    if (conversationId) {
      const { encryptText } = await import("./crypto");
      return encryptText(plainText, conversationId);
    }

    return plainText;
  } catch (err) {
    console.error("E2EE message encryption error:", err);
    return plainText;
  }
}

/**
 * Decrypts an encrypted message.
 * Handles both v2 (True ECDH) and legacy v1 (conversationId) messages.
 * 
 * @param {string} encryptedText - Ciphertext string
 * @param {string} senderUserId - Sender's user ID
 * @param {string} currentUserId - Viewer's user ID
 * @param {string} conversationId - Conversation ID for legacy fallback
 * @returns {Promise<string>} Decrypted plaintext
 */
export async function decryptMessage(encryptedText, senderUserId, currentUserId, conversationId) {
  try {
    if (!encryptedText || typeof encryptedText !== "string") return encryptedText;

    // Check if message is v2 True E2EE
    if (encryptedText.startsWith("e2ee:v2:")) {
      const parts = encryptedText.split(":");
      if (parts.length < 5) return encryptedText;

      const [, , ivHex, senderJwkBase64, cipherHex] = parts;
      const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
      const cipherBytes = new Uint8Array(cipherHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));

      const ownRecord = await initializeUserE2EE(currentUserId);
      if (!ownRecord?.keyPair?.privateKey) {
        return "🔒 [Encrypted Message - Key Missing]";
      }

      // Import sender's public key from the message envelope or cache
      const senderJwkString = atob(senderJwkBase64);
      const senderJwk = JSON.parse(senderJwkString);
      const senderPublicKey = await window.crypto.subtle.importKey(
        "jwk",
        senderJwk,
        { name: "ECDH", namedCurve: "P-256" },
        true,
        []
      );

      const salt = [currentUserId, senderUserId].sort().join(":");
      const aesKey = await deriveSharedAESKey(ownRecord.keyPair.privateKey, senderPublicKey, salt);

      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        aesKey,
        cipherBytes
      );

      return new TextDecoder().decode(decrypted);
    }

    // Legacy v1 fallback
    if (encryptedText.startsWith("e2ee:")) {
      const { decryptText } = await import("./crypto");
      return decryptText(encryptedText, conversationId);
    }

    return encryptedText;
  } catch (err) {
    console.warn("E2EE decryption error (key mismatch or unreadable payload):", err);
    return "🔒 [Encrypted Message]";
  }
}
