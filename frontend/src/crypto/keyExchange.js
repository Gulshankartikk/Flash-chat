/**
 * keyExchange.js — ECDH Public-Key Key Agreement & Peer Directory
 * 
 * Performs Elliptic Curve Diffie-Hellman (ECDH) key agreement with peer
 * public keys and manages peer public key caching.
 */

import axiosInstance from "../services/url.services";
import { importPublicKeyFromJWK } from "./identity";

// In-memory peer public key cache: peerUserId -> { cryptoKey, jwk, timestamp }
const peerKeyCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCryptoSubtle() {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    return window.crypto.subtle;
  }
  throw new Error("Web Crypto API is not available");
}

/**
 * Computes 256 bits of shared secret material using ECDH.
 * 
 * @param {CryptoKey} ownPrivateKey - The local user's ECDH private key
 * @param {CryptoKey} peerPublicKey - The peer's ECDH public key
 * @returns {Promise<ArrayBuffer>} 256 bits of raw shared secret material
 */
export async function computeECDHSharedSecret(ownPrivateKey, peerPublicKey) {
  const cryptoSubtle = getCryptoSubtle();

  return cryptoSubtle.deriveBits(
    {
      name: "ECDH",
      public: peerPublicKey,
    },
    ownPrivateKey,
    256 // 256 bits
  );
}

/**
 * Fetches and caches a peer's public key from the backend user directory.
 * 
 * @param {string} peerUserId - The peer's user ID
 * @returns {Promise<CryptoKey|null>} The peer's imported public key or null
 */
export async function fetchPeerPublicKey(peerUserId) {
  if (!peerUserId) return null;

  // 1. Check in-memory cache
  const cached = peerKeyCache.get(peerUserId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.cryptoKey;
  }

  // 2. Fetch from backend API
  try {
    const res = await axiosInstance.get(`/users/${peerUserId}/public-key`);
    const jwkString = res?.data?.data?.publicKey;

    if (!jwkString) return null;

    const jwk = typeof jwkString === "string" ? JSON.parse(jwkString) : jwkString;
    const cryptoKey = await importPublicKeyFromJWK(jwk);

    peerKeyCache.set(peerUserId, {
      cryptoKey,
      jwk,
      timestamp: Date.now(),
    });

    return cryptoKey;
  } catch (err) {
    console.warn(`[E2EE] Could not fetch public key for peer ${peerUserId}:`, err);
    return null;
  }
}

/**
 * Manually injects or updates a peer's public key into the cache.
 * 
 * @param {string} peerUserId 
 * @param {JsonWebKey|Object} jwk 
 */
export async function cachePeerPublicKey(peerUserId, jwk) {
  if (!peerUserId || !jwk) return;
  try {
    const cryptoKey = await importPublicKeyFromJWK(jwk);
    peerKeyCache.set(peerUserId, {
      cryptoKey,
      jwk,
      timestamp: Date.now(),
    });
    return cryptoKey;
  } catch (e) {
    console.warn("[E2EE] Failed to cache peer public key:", e);
  }
}

/**
 * Clears the peer public key cache.
 */
export function clearPeerKeyCache() {
  peerKeyCache.clear();
}
