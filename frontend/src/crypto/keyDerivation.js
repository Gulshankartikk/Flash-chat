/**
 * keyDerivation.js — HKDF (RFC 5869) Key Derivation Engine
 * 
 * Uses HMAC-based Extract-and-Expand Key Derivation Function (HKDF-SHA256)
 * to derive cryptographic AES-256-GCM message encryption keys from raw
 * shared secrets with domain separation (salt and context info).
 */

const DEFAULT_INFO = "FlashChat-Message-Encryption-v2";

function getCryptoSubtle() {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    return window.crypto.subtle;
  }
  throw new Error("Web Crypto API is not available");
}

/**
 * Derives a 256-bit AES-GCM encryption key from raw shared secret bits using HKDF-SHA256.
 * 
 * @param {ArrayBuffer} sharedSecretBits - Raw output from ECDH key agreement
 * @param {string|Uint8Array} salt - Unique conversation salt (e.g. sorted "userIdA:userIdB")
 * @param {string} [info] - Application-specific contextual info string
 * @returns {Promise<CryptoKey>} Derived 256-bit AES-GCM CryptoKey
 */
export async function deriveAESGCMKeyFromSecret(
  sharedSecretBits,
  salt,
  info = DEFAULT_INFO
) {
  const cryptoSubtle = getCryptoSubtle();

  const encoder = new TextEncoder();
  const saltBytes = typeof salt === "string" ? encoder.encode(salt) : salt;
  const infoBytes = typeof info === "string" ? encoder.encode(info) : info;

  // 1. Import raw shared secret as an HKDF master key
  const hkdfBaseKey = await cryptoSubtle.importKey(
    "raw",
    sharedSecretBits,
    { name: "HKDF" },
    false,
    ["deriveKey"]
  );

  // 2. Expand into 256-bit AES-GCM key
  return cryptoSubtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: saltBytes,
      info: infoBytes,
    },
    hkdfBaseKey,
    { name: "AES-GCM", length: 256 },
    false, // Non-extractable for memory protection
    ["encrypt", "decrypt"]
  );
}

/**
 * Derives a deterministic salt string from two participant user IDs.
 * Sorting guarantees that both sender and receiver always compute the exact same salt.
 * 
 * @param {string} userIdA 
 * @param {string} userIdB 
 * @returns {string} e.g. "64f8a...:64f8b..."
 */
export function buildParticipantSalt(userIdA, userIdB) {
  if (!userIdA || !userIdB) {
    throw new Error("Both participant IDs are required to construct conversation salt");
  }
  return [String(userIdA), String(userIdB)].sort().join(":");
}
