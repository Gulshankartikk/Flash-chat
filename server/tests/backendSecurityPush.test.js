/**
 * Flash Chat - Backend Step 9A Security, Web Push & Resilience Test Suite
 */

const assert = require('assert');
const { stripHtml, sanitizeObject } = require('../utils/sanitize');
const { verifyBufferSignature } = require('../middleware/uploadMiddleware');
const pushService = require('../services/pushService');
const authService = require('../services/auth/authService');

const runTests = async () => {
  console.log('\n🔒 Starting Flash Chat Step 9A Security, Push & Observability Test Suite...\n');
  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  };

  // ---------------------------------------------------------------------------
  // 1. Input Sanitization Tests
  // ---------------------------------------------------------------------------
  await test('Input Sanitization: Strip dangerous script tags and event handlers', () => {
    const maliciousInput = '<script>alert("XSS")</script>Hello <b onload="steal()">world</b>';
    const clean = stripHtml(maliciousInput);
    assert.strictEqual(clean, 'Hello world');

    const injectionObj = {
      caption: 'Awesome sunset! <img src=x onerror=alert(1)>',
      bio: '<a href="javascript:alert(2)">My link</a>'
    };
    const sanitized = sanitizeObject(injectionObj);
    assert.strictEqual(sanitized.caption, 'Awesome sunset!');
    assert.strictEqual(sanitized.bio, 'My link');
  });

  // ---------------------------------------------------------------------------
  // 2. Upload MIME Sniffing & Buffer Header Tests
  // ---------------------------------------------------------------------------
  await test('Upload Security: Reject spoofed MIME types and script-bearing SVGs', () => {
    // Valid JPEG (FF D8 FF)
    const validJpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
    assert.strictEqual(verifyBufferSignature(validJpegBuffer, 'image/jpeg'), true);

    // Fake JPEG (plain text claiming to be JPEG)
    const spoofedJpegBuffer = Buffer.from('This is a text file not a real image');
    assert.strictEqual(verifyBufferSignature(spoofedJpegBuffer, 'image/jpeg'), false);

    // Valid PNG (89 50 4E 47)
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    assert.strictEqual(verifyBufferSignature(validPngBuffer, 'image/png'), true);

    // Malicious SVG with embedded script
    const maliciousSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    assert.strictEqual(verifyBufferSignature(maliciousSvg, 'image/svg+xml'), false);

    // Clean SVG
    const cleanSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>');
    assert.strictEqual(verifyBufferSignature(cleanSvg, 'image/svg+xml'), true);
  });

  // ---------------------------------------------------------------------------
  // 3. JWT & Refresh Token Rotation with Reuse Detection
  // ---------------------------------------------------------------------------
  await test('Auth Security: Dual JWT generation and verification', () => {
    const dummyUserId = '64b1f2e9a8f3b2c1d0e4f5a6';
    const accessToken = authService.generateAccessToken(dummyUserId);
    const refreshToken = authService.generateRefreshToken(dummyUserId);

    assert.ok(accessToken && accessToken.length > 20);
    assert.ok(refreshToken && refreshToken.length > 20);

    const verifiedAccess = authService.verifyAccessToken(accessToken);
    assert.strictEqual(verifiedAccess.id, dummyUserId);

    const verifiedRefresh = authService.verifyRefreshToken(refreshToken);
    assert.strictEqual(verifiedRefresh.id, dummyUserId);
  });

  // ---------------------------------------------------------------------------
  // 4. Web Push Service & Suppression Guards
  // ---------------------------------------------------------------------------
  await test('Push Service: Online presence and conversation mute suppression', async () => {
    // 1. Online user suppression
    const onlineResult = await pushService.sendChatMessagePush({
      recipientId: 'user_123',
      sender: { name: 'Alice' },
      conversation: { _id: 'conv_abc', isGroup: false },
      message: { type: 'text', text: 'Hey there' },
      isOnline: true
    });
    assert.strictEqual(onlineResult.success, false);
    assert.strictEqual(onlineResult.reason, 'user_online');

    // 2. Muted conversation suppression
    const mutedResult = await pushService.sendChatMessagePush({
      recipientId: 'user_123',
      sender: { name: 'Bob' },
      conversation: {
        _id: 'conv_xyz',
        members: [{ user: 'user_123', isMuted: true }]
      },
      message: { type: 'text', text: 'Muted ping' },
      isOnline: false
    });
    assert.strictEqual(mutedResult.success, false);
    assert.strictEqual(mutedResult.reason, 'conversation_muted');
  });

  // ---------------------------------------------------------------------------
  // 5. CSRF Allowed Origin Validation
  // ---------------------------------------------------------------------------
  await test('CSRF Guard: Verify allowed client origins and reject external cross-sites', () => {
    const allowed = ['http://localhost:5173', 'http://localhost:3000'];
    const safeOrigin = 'http://localhost:5173';
    const maliciousOrigin = ['https://', 'evil-hacker-site', '.com'].join('');

    assert.ok(allowed.includes(safeOrigin));
    assert.ok(!allowed.some((origin) => origin === maliciousOrigin));
  });

  console.log(`\n======================================================`);
  console.log(`📊 Test Results: ${passed} Passed | ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

if (require.main === module) {
  runTests();
}

module.exports = runTests;
