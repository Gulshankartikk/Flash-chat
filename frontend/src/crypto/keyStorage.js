/**
 * keyStorage.js — Isolated IndexedDB Key Storage
 * 
 * Safely persists asymmetric CryptoKeyPair and identity records in the
 * browser-sandboxed IndexedDB keystore.
 */

const DB_NAME = "FlashChat_E2EE_Keystore";
const DB_VERSION = 1;
const STORE_NAME = "keypair";
const KEY_RECORD_ID = "device_identity_keypair";

/**
 * Opens or initializes the local IndexedDB database.
 * 
 * @returns {Promise<IDBDatabase>}
 */
export function openKeyDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB is not available in this environment"));
    }

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
 * Stores identity keypair and public JWK in IndexedDB.
 * 
 * @param {CryptoKeyPair} keyPair 
 * @param {JsonWebKey} publicJwk 
 * @returns {Promise<void>}
 */
export async function saveIdentityKeyPair(keyPair, publicJwk) {
  const db = await openKeyDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const record = {
      keyPair,
      publicJwk,
      updatedAt: Date.now(),
    };

    store.put(record, KEY_RECORD_ID);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Loads the local identity record from IndexedDB.
 * 
 * @returns {Promise<{ keyPair: CryptoKeyPair, publicJwk: JsonWebKey, updatedAt: number }|null>}
 */
export async function loadIdentityKeyPair() {
  const db = await openKeyDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(KEY_RECORD_ID);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clears the local identity keypair from IndexedDB (e.g. on explicit device unregister / reset).
 * 
 * @returns {Promise<void>}
 */
export async function clearIdentityKeyPair() {
  const db = await openKeyDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(KEY_RECORD_ID);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
