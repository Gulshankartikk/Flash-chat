import {
  encryptMessage,
  decryptMessage,
  initializeUserE2EE,
  exportEncryptedIdentityBackup,
  restoreEncryptedIdentityBackup,
  computeIdentityFingerprint,
} from "../crypto/index";

/**
 * Encrypts plaintext using True Asymmetric E2EE (ECDH + HKDF + AES-256-GCM).
 * 
 * @param {string} plainText - The message content to encrypt.
 * @param {string} conversationId - The conversation ID.
 * @param {string} [recipientUserId] - The recipient's user ID for true E2EE.
 * @param {string} [currentUserId] - The sender's user ID.
 * @returns {Promise<string>} The encrypted ciphertext string.
 */
export async function encryptText(plainText, conversationId, recipientUserId, currentUserId) {
  if (!plainText) return plainText;
  if (recipientUserId && currentUserId) {
    return encryptMessage(plainText, recipientUserId, currentUserId, conversationId);
  }
  return plainText;
}

/**
 * Decrypts an encrypted ciphertext string back to plaintext.
 * Handles True E2EE v2 envelopes locally on the viewer's device.
 * 
 * @param {string} encryptedText - The formatted ciphertext string.
 * @param {string} conversationId - The conversation ID.
 * @param {string} [senderUserId] - Sender's user ID.
 * @param {string} [currentUserId] - Viewer's user ID.
 * @returns {Promise<string>} The decrypted plaintext.
 */
export async function decryptText(encryptedText, conversationId, senderUserId, currentUserId) {
  if (!encryptedText || typeof encryptedText !== "string") return encryptedText;
  return decryptMessage(encryptedText, senderUserId, currentUserId, conversationId);
}

export {
  initializeUserE2EE,
  exportEncryptedIdentityBackup,
  restoreEncryptedIdentityBackup,
  computeIdentityFingerprint,
};

/**
 * Encrypts a backup JSON object using a user-provided password.
 * Uses PBKDF2 for key derivation and AES-GCM for encryption.
 * 
 * @param {Object} backupObj - The backup data object.
 * @param {string} password - The password to encrypt the backup with.
 * @returns {Promise<string>} The encrypted ciphertext string.
 */
export async function encryptBackup(backupObj, password) {
  try {
    const jsonString = JSON.stringify(backupObj);
    const enc = new TextEncoder();
    
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const passwordKey = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    
    const aesKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 100000,
        hash: "SHA-256"
      },
      passwordKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );
    
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      enc.encode(jsonString)
    );
    
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, "0")).join("");
    const cipherHex = Array.from(new Uint8Array(ciphertext)).map(b => b.toString(16).padStart(2, "0")).join("");
    
    return `e2ee-backup:${saltHex}:${ivHex}:${cipherHex}`;
  } catch (err) {
    console.error("Backup encryption failed:", err);
    throw new Error("Failed to encrypt backup: " + err.message);
  }
}

/**
 * Decrypts an encrypted backup string using the user-provided password.
 * 
 * @param {string} encryptedString - The formatted ciphertext string.
 * @param {string} password - The password to decrypt the backup with.
 * @returns {Promise<Object>} The decrypted backup data object.
 */
export async function decryptBackup(encryptedString, password) {
  try {
    if (!encryptedString.startsWith("e2ee-backup:")) {
      throw new Error("Not a valid encrypted backup file");
    }
    
    const parts = encryptedString.split(":");
    if (parts.length !== 4) {
      throw new Error("Invalid encrypted backup format");
    }
    
    const [, saltHex, ivHex, cipherHex] = parts;
    
    const enc = new TextEncoder();
    const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const ciphertext = new Uint8Array(cipherHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    
    const passwordKey = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    
    const aesKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 100000,
        hash: "SHA-256"
      },
      passwordKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      aesKey,
      ciphertext
    );
    
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  } catch (err) {
    console.error("Backup decryption failed:", err);
    throw new Error("Decryption failed. Please check your password.");
  }
}
