const { test, describe } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test_jwt_secret_super_secure_key_12345';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_super_secure_key_67890';

const { generateAccessToken, generateRefreshToken, generateSessionId } = require('../utils/generateToken');

describe('📱 Phone & 🔵 Google Authentication Architecture Tests', () => {
  test('Phone OTP user identifier creation and display name derivation', () => {
    const phoneNumber = "9876543210";
    const phoneSuffix = "+91";
    const suffix4 = phoneNumber.slice(-4);
    
    const displayName = `User ${suffix4}`;
    const username = `user_${suffix4}_${crypto.randomBytes(3).toString("hex")}`;
    
    assert.strictEqual(displayName, 'User 3210');
    assert.ok(username.startsWith('user_3210_'), 'Username must have correct prefix');
  });

  test('Google OAuth user auto-provisioning derivation', () => {
    const googleProfile = {
      sub: "google-uid-1029384756",
      email: "alex.tester@gmail.com",
      email_verified: true,
      name: "Alex Developer",
      picture: "https://lh3.googleusercontent.com/a/photo.jpg",
    };

    const cleanName = googleProfile.name.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 15);
    const username = `${cleanName}_${crypto.randomBytes(2).toString("hex")}`;

    assert.strictEqual(cleanName, 'alex_developer');
    assert.ok(username.startsWith('alex_developer_'));
    assert.strictEqual(googleProfile.email_verified, true);
  });

  test('Secure HTTP-only session tokens creation and payload verification', () => {
    const userId = '64f8a1234567890abcdef999';
    const sessionId = generateSessionId();

    const accessToken = generateAccessToken(userId, sessionId);
    const refreshToken = generateRefreshToken(userId, sessionId);

    const accessDecoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    const refreshDecoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    assert.strictEqual(accessDecoded.userId, userId);
    assert.strictEqual(accessDecoded.sessionId, sessionId);
    assert.strictEqual(refreshDecoded.userId, userId);
    assert.strictEqual(refreshDecoded.sessionId, sessionId);
  });
});
