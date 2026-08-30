const { test, describe } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

process.env.JWT_SECRET = 'test_jwt_secret_super_secure_key_12345';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_super_secure_key_67890';

const { generateAccessToken, generateRefreshToken, generateSessionId } = require('../utils/generateToken');

describe('Flash Chat Security & Token Tests', () => {
  test('generateAccessToken generates a valid short-lived JWT', () => {
    const userId = '64f8a1234567890abcdef123';
    const sessionId = generateSessionId();
    const token = generateAccessToken(userId, sessionId);

    assert.ok(token, 'Access token must be generated');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    assert.strictEqual(decoded.userId, userId);
    assert.strictEqual(decoded.sessionId, sessionId);
    assert.ok(decoded.exp > decoded.iat, 'Token must have expiration');
  });

  test('generateRefreshToken generates a valid long-lived JWT with correct secret', () => {
    const userId = '64f8a1234567890abcdef123';
    const sessionId = generateSessionId();
    const token = generateRefreshToken(userId, sessionId);

    assert.ok(token, 'Refresh token must be generated');
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    assert.strictEqual(decoded.userId, userId);
    assert.strictEqual(decoded.sessionId, sessionId);
    // 7 days in seconds = 7 * 24 * 60 * 60 = 604800
    assert.ok(decoded.exp - decoded.iat >= 604000, 'Refresh token should expire in ~7 days');
  });

  test('Expired tokens trigger TokenExpiredError', async () => {
    const expiredToken = jwt.sign(
      { userId: '123', sessionId: 'abc' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );

    assert.throws(
      () => {
        jwt.verify(expiredToken, process.env.JWT_SECRET);
      },
      (err) => err.name === 'TokenExpiredError'
    );
  });

  test('AES-256-GCM symmetric encryption roundtrip', () => {
    const secretKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const plaintext = 'Secret flash chat message content';

    const cipher = crypto.createCipheriv('aes-256-gcm', secretKey, iv);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    assert.strictEqual(decrypted, plaintext, 'Decrypted text must match plaintext');
  });
});
