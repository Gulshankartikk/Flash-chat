/**
 * recovery.js — Client-Side Key Backup & Recovery Strategy
 * 
 * Implements password-derived encryption (PBKDF2 with 100,000 SHA-256 rounds + AES-256-GCM)
 * for private identity key exports.
 * 
 * 🔒 SECURITY NOTICE: The user's recovery password and decrypted private key
 * NEVER leave the client browser. The server never stores, receives, or logs private keys.
 */

import { exportPrivateKeyToJWK, exportPublicKeyToJWK, importPrivateKeyFromJWK, importPublicKeyFromJWK } from "./identity";
import { saveIdentityKeyPair } from "./keyStorage";

const PBKDF2_ITERATIONS = 100000;

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
 * Encrypts the local identity keypair using a user-chosen passphrase.
 * 
 * @param {CryptoKeyPair} keyPair - The user's ECDH key pair
 * @param {string} passphrase - User's recovery password
 * @returns {Promise<string>} Encrypted backup payload string e.g. "e2ee-key-backup:<saltHex>:<ivHex>:<cipherHex>"
 */
export async function exportEncryptedIdentityBackup(keyPair, passphrase) {
  const cryptoSubtle = getCryptoSubtle();

  const privateJwk = await exportPrivateKeyToJWK(keyPair.privateKey);
  const publicJwk = await exportPublicKeyToJWK(keyPair.publicKey);

  const payload = JSON.stringify({
    privateJwk,
    publicJwk,
    version: 2,
    exportedAt: new Date().toISOString(),
  });

  const encoder = new TextEncoder();
  const salt = getRandomValues(new Uint8Array(16));
  const iv = getRandomValues(new Uint8Array(12));

  // 1. Import passphrase
  const baseKey = await cryptoSubtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // 2. Derive AES-256-GCM key with PBKDF2
  const aesKey = await cryptoSubtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  // 3. Encrypt payload
  const ciphertextBuffer = await cryptoSubtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encoder.encode(payload)
  );

  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, "0")).join("");
  const cipherHex = Array.from(new Uint8Array(ciphertextBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `e2ee-key-backup:${saltHex}:${ivHex}:${cipherHex}`;
}

/**
 * Decrypts an encrypted identity backup using the passphrase and restores it to IndexedDB.
 * 
 * @param {string} backupString - The backup string
 * @param {string} passphrase - The passphrase used during export
 * @returns {Promise<{ keyPair: CryptoKeyPair, publicJwk: JsonWebKey }>}
 */
export async function restoreEncryptedIdentityBackup(backupString, passphrase) {
  const cryptoSubtle = getCryptoSubtle();

  if (!backupString.startsWith("e2ee-key-backup:")) {
    throw new Error("Invalid identity key backup format");
  }

  const parts = backupString.split(":");
  if (parts.length !== 4) {
    throw new Error("Corrupted identity key backup string");
  }

  const [, saltHex, ivHex, cipherHex] = parts;

  const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map((b) => parseInt(b, 16)));
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map((b) => parseInt(b, 16)));
  const cipherBytes = new Uint8Array(cipherHex.match(/.{1,2}/g).map((b) => parseInt(b, 16)));

  const encoder = new TextEncoder();
  const baseKey = await cryptoSubtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const aesKey = await cryptoSubtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decryptedBuffer = await cryptoSubtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    cipherBytes
  );

  const payload = JSON.parse(new TextDecoder().decode(decryptedBuffer));

  // Import CryptoKeys
  const privateKey = await importPrivateKeyFromJWK(payload.privateJwk);
  const publicKey = await importPublicKeyFromJWK(payload.publicJwk);
  const keyPair = { privateKey, publicKey };

  // Save to IndexedDB
  await saveIdentityKeyPair(keyPair, payload.publicJwk);

  return {
    keyPair,
    publicJwk: payload.publicJwk,
  };
}
