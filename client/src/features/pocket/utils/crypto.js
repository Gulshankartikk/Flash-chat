/**
 * Client-Side AES-GCM 256-bit Encryption with PBKDF2 Key Derivation
 * Using native Web Crypto API (SubtleCrypto).
 *
 * Security:
 * - 250,000 PBKDF2 iterations with SHA-256
 * - Cryptographically random 16-byte salt and 12-byte IV per encryption
 * - Plaintext and passphrase are never persisted to localStorage or sent to the server.
 */

// Helper to convert Uint8Array to Base64 string
export const uint8ToBase64 = (bytes) => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// Helper to convert Base64 string to Uint8Array
export const base64ToUint8 = (base64) => {
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * Derives an AES-GCM 256 key from a passphrase and salt using PBKDF2 (250,000 iterations).
 */
const deriveKey = async (passphrase, saltBytes) => {
  const enc = new TextEncoder();
  const passphraseKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 250000,
      hash: 'SHA-256'
    },
    passphraseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypts a plaintext string with a passphrase using AES-GCM.
 *
 * @param {string} plaintext
 * @param {string} passphrase
 * @returns {Promise<{ ciphertext: string, iv: string, salt: string }>}
 */
export const encryptItemContent = async (plaintext, passphrase) => {
  if (!plaintext) {
    return { ciphertext: '', iv: '', salt: '' };
  }
  if (!passphrase || passphrase.length < 4) {
    throw new Error('Encryption passphrase must be at least 4 characters long.');
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(passphrase, salt);
  const enc = new TextEncoder();
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    enc.encode(plaintext)
  );

  return {
    ciphertext: uint8ToBase64(new Uint8Array(encryptedBuffer)),
    iv: uint8ToBase64(iv),
    salt: uint8ToBase64(salt)
  };
};

/**
 * Decrypts AES-GCM ciphertext using the passphrase, iv, and salt.
 *
 * @param {string} ciphertextBase64
 * @param {string} ivBase64
 * @param {string} saltBase64
 * @param {string} passphrase
 * @returns {Promise<string>} Decrypted plaintext
 */
export const decryptItemContent = async (ciphertextBase64, ivBase64, saltBase64, passphrase) => {
  if (!ciphertextBase64) return '';
  if (!passphrase) throw new Error('Passphrase is required for decryption.');

  try {
    const salt = base64ToUint8(saltBase64);
    const iv = base64ToUint8(ivBase64);
    const ciphertext = base64ToUint8(ciphertextBase64);

    const key = await deriveKey(passphrase, salt);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      ciphertext
    );

    const dec = new TextDecoder('utf-8');
    return dec.decode(decryptedBuffer);
  } catch (err) {
    throw new Error('Incorrect passphrase or corrupted encrypted content.');
  }
};
