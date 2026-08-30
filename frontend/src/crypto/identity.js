/**
 * identity.js — User & Device Identity Key Management
 * 
 * Generates and manages asymmetric cryptographic identity key pairs (ECDH Curve P-256)
 * using the browser-native Web Crypto API.
 */

const CURVE_NAME = "P-256";

function getCryptoSubtle() {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    return window.crypto.subtle;
  }
  throw new Error("Web Crypto API is not supported in this environment");
}

/**
 * Generates a new random ECDH P-256 key pair.
 * 
 * @returns {Promise<CryptoKeyPair>} The generated asymmetric key pair.
 */
export async function generateIdentityKeyPair() {
  const cryptoSubtle = getCryptoSubtle();

  return cryptoSubtle.generateKey(
    {
      name: "ECDH",
      namedCurve: CURVE_NAME,
    },
    true, // extractable for local JWK storage and public key publishing
    ["deriveKey", "deriveBits"]
  );
}

/**
 * Exports a public CryptoKey to standard JSON Web Key (JWK) format.
 * 
 * @param {CryptoKey} publicKey 
 * @returns {Promise<JsonWebKey>}
 */
export async function exportPublicKeyToJWK(publicKey) {
  const cryptoSubtle = getCryptoSubtle();
  return cryptoSubtle.exportKey("jwk", publicKey);
}

/**
 * Imports a JWK object into an ECDH public CryptoKey.
 * 
 * @param {JsonWebKey|Object} jwk 
 * @returns {Promise<CryptoKey>}
 */
export async function importPublicKeyFromJWK(jwk) {
  const cryptoSubtle = getCryptoSubtle();
  return cryptoSubtle.importKey(
    "jwk",
    jwk,
    {
      name: "ECDH",
      namedCurve: CURVE_NAME,
    },
    true,
    []
  );
}

/**
 * Exports a private CryptoKey to JWK format for secure client-side encrypted backup.
 * 
 * @param {CryptoKey} privateKey 
 * @returns {Promise<JsonWebKey>}
 */
export async function exportPrivateKeyToJWK(privateKey) {
  const cryptoSubtle = getCryptoSubtle();
  return cryptoSubtle.exportKey("jwk", privateKey);
}

/**
 * Imports a private key JWK into an ECDH private CryptoKey.
 * 
 * @param {JsonWebKey|Object} jwk 
 * @returns {Promise<CryptoKey>}
 */
export async function importPrivateKeyFromJWK(jwk) {
  const cryptoSubtle = getCryptoSubtle();
  return cryptoSubtle.importKey(
    "jwk",
    jwk,
    {
      name: "ECDH",
      namedCurve: CURVE_NAME,
    },
    true,
    ["deriveKey", "deriveBits"]
  );
}

/**
 * Computes a human-readable SHA-256 fingerprint from a public JWK.
 * Can be used for out-of-band "Safety Number" identity verification.
 * 
 * @param {JsonWebKey|Object} publicJwk 
 * @returns {Promise<string>} Hexadecimal fingerprint formatted as 12 grouped hex blocks
 */
export async function computeIdentityFingerprint(publicJwk) {
  const cryptoSubtle = getCryptoSubtle();
  const canonicalString = JSON.stringify({
    crv: publicJwk.crv,
    kty: publicJwk.kty,
    x: publicJwk.x,
    y: publicJwk.y,
  });

  const encoder = new TextEncoder();
  const hashBuffer = await cryptoSubtle.digest("SHA-256", encoder.encode(canonicalString));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();

  // Format in blocks of 4 chars e.g. "A1B2 C3D4 E5F6 ..."
  return hex.match(/.{1,4}/g)?.slice(0, 8).join(" ") || hex;
}
