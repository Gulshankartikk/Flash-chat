/**
 * encryption.js — AES-256-GCM Authenticated Encryption & Envelope Protocol
 * 
 * Implements authenticated message encryption (AES-256-GCM) with fresh 96-bit (12-byte)
 * random nonces per message. Zero nonce reuse.
 */

const IV_LENGTH_BYTES = 12; // 96 bits standard for AES-GCM

function getCryptoSubtle() {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    return window.crypto.subtle;
  }
  throw new Error("Web Crypto API is not available");
}

function getRandomValues(array) {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    return window.crypto.getRandomValues(array);
  }
  throw new Error("Web Crypto API is not available");
}

/**
 * Encrypts a plaintext UTF-8 string with a derived AES-GCM key and fresh random IV.
 * 
 * @param {string} plainText - The message content
 * @param {CryptoKey} aesKey - 256-bit AES-GCM CryptoKey
 * @returns {Promise<{ iv: Uint8Array, ciphertext: Uint8Array, ivHex: string, cipherHex: string }>}
 */
export async function encryptAESGCM(plainText, aesKey) {
  const cryptoSubtle = getCryptoSubtle();

  // Generate a fresh, random 96-bit IV for this specific message
  const iv = getRandomValues(new Uint8Array(IV_LENGTH_BYTES));

  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plainText);

  // Authenticated encryption (ciphertext includes 128-bit authentication tag at the end)
  const ciphertextBuffer = await cryptoSubtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    aesKey,
    plaintextBytes
  );

  const ciphertext = new Uint8Array(ciphertextBuffer);

  const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, "0")).join("");
  const cipherHex = Array.from(ciphertext).map((b) => b.toString(16).padStart(2, "0")).join("");

  return {
    iv,
    ciphertext,
    ivHex,
    cipherHex,
  };
}

/**
 * Decrypts and authenticates AES-256-GCM ciphertext bytes.
 * Throws if the ciphertext or authentication tag was modified.
 * 
 * @param {Uint8Array} cipherBytes - Ciphertext bytes (including auth tag)
 * @param {Uint8Array} ivBytes - 96-bit initialization vector
 * @param {CryptoKey} aesKey - 256-bit AES-GCM CryptoKey
 * @returns {Promise<string>} Decrypted UTF-8 plaintext string
 */
export async function decryptAESGCM(cipherBytes, ivBytes, aesKey) {
  const cryptoSubtle = getCryptoSubtle();

  const decryptedBuffer = await cryptoSubtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBytes,
    },
    aesKey,
    cipherBytes
  );

  return new TextDecoder().decode(decryptedBuffer);
}

/**
 * Packages encrypted parts into a standard Flash Chat v2 E2EE Envelope:
 * "e2ee:v2:<iv_hex>:<sender_public_jwk_base64>:<ciphertext_hex>"
 * 
 * @param {string} ivHex 
 * @param {JsonWebKey|Object} senderPublicJwk 
 * @param {string} cipherHex 
 * @returns {string}
 */
export function buildE2EEEnvelope(ivHex, senderPublicJwk, cipherHex) {
  const jwkString = JSON.stringify(senderPublicJwk);
  const jwkBase64 = typeof btoa !== "undefined"
    ? btoa(jwkString)
    : Buffer.from(jwkString).toString("base64");

  return `e2ee:v2:${ivHex}:${jwkBase64}:${cipherHex}`;
}

/**
 * Parses an E2EE v2 envelope into its constituent parts.
 * 
 * @param {string} envelopeString 
 * @returns {{ iv: Uint8Array, senderJwk: JsonWebKey, cipherBytes: Uint8Array }|null}
 */
export function parseE2EEEnvelope(envelopeString) {
  if (!envelopeString || typeof envelopeString !== "string" || !envelopeString.startsWith("e2ee:v2:")) {
    return null;
  }

  const parts = envelopeString.split(":");
  if (parts.length < 5) return null;

  const [, , ivHex, senderJwkBase64, cipherHex] = parts;

  const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map((b) => parseInt(b, 16)));
  const cipherBytes = new Uint8Array(cipherHex.match(/.{1,2}/g).map((b) => parseInt(b, 16)));

  const jwkString = typeof atob !== "undefined"
    ? atob(senderJwkBase64)
    : Buffer.from(senderJwkBase64, "base64").toString("utf8");

  const senderJwk = JSON.parse(jwkString);

  return {
    iv,
    senderJwk,
    cipherBytes,
  };
}
