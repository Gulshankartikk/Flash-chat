const { test, describe } = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");
const { subtle } = crypto.webcrypto;

// Helper: ECDH Keypair generation
async function generateECDHKeyPair() {
  return subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
}

// Helper: HKDF AES-256-GCM derivation
async function deriveSessionKey(ownPrivateKey, peerPublicKey, userIdA, userIdB) {
  const salt = [userIdA, userIdB].sort().join(":");
  const sharedBits = await subtle.deriveBits(
    { name: "ECDH", public: peerPublicKey },
    ownPrivateKey,
    256
  );

  const derivedKeyBytes = crypto.hkdfSync(
    "sha256",
    Buffer.from(sharedBits),
    Buffer.from(salt),
    Buffer.from("FlashChat-Message-Encryption-v2"),
    32
  );

  return subtle.importKey(
    "raw",
    derivedKeyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

// Helper: Encrypt message
async function encryptTestMessage(plainText, senderKeyPair, recipientPublicKey, senderId, recipientId) {
  const sessionKey = await deriveSessionKey(senderKeyPair.privateKey, recipientPublicKey, senderId, recipientId);
  const iv = crypto.randomBytes(12);
  const encodedText = Buffer.from(plainText, "utf8");

  const ciphertextBuffer = await subtle.encrypt(
    { name: "AES-GCM", iv },
    sessionKey,
    encodedText
  );

  const ivHex = iv.toString("hex");
  const cipherHex = Buffer.from(ciphertextBuffer).toString("hex");
  const senderPublicJwk = await subtle.exportKey("jwk", senderKeyPair.publicKey);
  const senderJwkBase64 = Buffer.from(JSON.stringify(senderPublicJwk)).toString("base64");

  return `e2ee:v2:${ivHex}:${senderJwkBase64}:${cipherHex}`;
}

// Helper: Decrypt message
async function decryptTestMessage(envelope, recipientKeyPair, senderId, recipientId) {
  const parts = envelope.split(":");
  if (parts.length < 5) throw new Error("Invalid envelope");

  const [, , ivHex, senderJwkBase64, cipherHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const cipherBytes = Buffer.from(cipherHex, "hex");

  const senderJwk = JSON.parse(Buffer.from(senderJwkBase64, "base64").toString("utf8"));
  const senderPublicKey = await subtle.importKey(
    "jwk",
    senderJwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );

  const sessionKey = await deriveSessionKey(recipientKeyPair.privateKey, senderPublicKey, senderId, recipientId);

  const decryptedBuffer = await subtle.decrypt(
    { name: "AES-GCM", iv },
    sessionKey,
    cipherBytes
  );

  return Buffer.from(decryptedBuffer).toString("utf8");
}

describe("🛡️ True End-to-End Encryption (E2EE) Verification Suite", () => {
  const userAliceId = "64f8a1111111111111111111";
  const userBobId = "64f8a2222222222222222222";
  const userEveAttackerId = "64f8a3333333333333333333";

  test("1. Plaintext Never Sent: Message payload produces an authenticated e2ee:v2 envelope", async () => {
    const aliceKeys = await generateECDHKeyPair();
    const bobKeys = await generateECDHKeyPair();
    const sensitivePlaintext = "Top secret conversation between Alice and Bob!";

    const envelope = await encryptTestMessage(
      sensitivePlaintext,
      aliceKeys,
      bobKeys.publicKey,
      userAliceId,
      userBobId
    );

    assert.ok(envelope.startsWith("e2ee:v2:"), "Payload must have e2ee:v2 header");
    assert.ok(!envelope.includes(sensitivePlaintext), "Plaintext must NEVER appear in envelope");
  });

  test("2. IV Freshness: 50 messages with identical plaintext generate 50 unique nonces & unique ciphertexts", async () => {
    const aliceKeys = await generateECDHKeyPair();
    const bobKeys = await generateECDHKeyPair();
    const repeatedPlaintext = "Hello Bob!";

    const seenIVs = new Set();
    const seenCiphertexts = new Set();

    for (let i = 0; i < 50; i++) {
      const envelope = await encryptTestMessage(
        repeatedPlaintext,
        aliceKeys,
        bobKeys.publicKey,
        userAliceId,
        userBobId
      );

      const parts = envelope.split(":");
      const iv = parts[2];
      const cipher = parts[4];

      assert.strictEqual(seenIVs.has(iv), false, `IV collision detected at iteration ${i}!`);
      assert.strictEqual(seenCiphertexts.has(cipher), false, `Ciphertext collision detected at iteration ${i}!`);

      seenIVs.add(iv);
      seenCiphertexts.add(cipher);
    }

    assert.strictEqual(seenIVs.size, 50, "Must have exactly 50 unique nonces");
  });

  test("3. Authenticated Decryption: Authorized recipient decrypts message accurately", async () => {
    const aliceKeys = await generateECDHKeyPair();
    const bobKeys = await generateECDHKeyPair();
    const message = "Meeting at 3 PM at the coffee shop.";

    const envelope = await encryptTestMessage(
      message,
      aliceKeys,
      bobKeys.publicKey,
      userAliceId,
      userBobId
    );

    const decrypted = await decryptTestMessage(
      envelope,
      bobKeys,
      userAliceId,
      userBobId
    );

    assert.strictEqual(decrypted, message, "Decrypted message must match original plaintext");
  });

  test("4. Unauthorized 3rd Party: Attacker with distinct keypair CANNOT decrypt message", async () => {
    const aliceKeys = await generateECDHKeyPair();
    const bobKeys = await generateECDHKeyPair();
    const eveKeys = await generateECDHKeyPair();
    const message = "Confidential financial data";

    const envelope = await encryptTestMessage(
      message,
      aliceKeys,
      bobKeys.publicKey,
      userAliceId,
      userBobId
    );

    // Eve tries to decrypt using her own private key instead of Bob's
    await assert.rejects(
      async () => {
        await decryptTestMessage(envelope, eveKeys, userAliceId, userEveAttackerId);
      },
      (err) => {
        return err.name === "OperationError" || err.message.includes("operation failed") || err.message.includes("tag verification failed");
      },
      "Unauthorized decryption must fail with authentication error"
    );
  });

  test("5. Tamper Resistance: Tampering with 1 character of ciphertext causes AEAD verification failure", async () => {
    const aliceKeys = await generateECDHKeyPair();
    const bobKeys = await generateECDHKeyPair();
    const message = "Transfer $1,000 to account 12345";

    const envelope = await encryptTestMessage(
      message,
      aliceKeys,
      bobKeys.publicKey,
      userAliceId,
      userBobId
    );

    // Tamper with the last byte of ciphertext
    const parts = envelope.split(":");
    const lastChar = parts[4].slice(-1);
    const tamperedChar = lastChar === "0" ? "1" : "0";
    parts[4] = parts[4].slice(0, -1) + tamperedChar;
    const tamperedEnvelope = parts.join(":");

    await assert.rejects(
      async () => {
        await decryptTestMessage(tamperedEnvelope, bobKeys, userAliceId, userBobId);
      },
      "Tampered message must be rejected by AES-GCM tag verification"
    );
  });

  test("6. Zero Private Key Exposure: Public JWK has no private exponent (d parameter)", async () => {
    const aliceKeys = await generateECDHKeyPair();
    const publicJwk = await subtle.exportKey("jwk", aliceKeys.publicKey);

    assert.strictEqual(publicJwk.kty, "EC");
    assert.strictEqual(publicJwk.crv, "P-256");
    assert.ok(publicJwk.x, "Must contain x coordinate");
    assert.ok(publicJwk.y, "Must contain y coordinate");
    assert.strictEqual(publicJwk.d, undefined, "Private key parameter 'd' must NEVER be present in public key");
  });
});
