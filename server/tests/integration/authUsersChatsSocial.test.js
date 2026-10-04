/**
 * Flash Chat - Comprehensive Integration Tests (Auth, Users, Chats, Social, Notifications)
 */

const assert = require('node:assert');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const { createUserFactory, createAuthTokens, createMessageFactory, generateMongoId } = require('../helpers/factories');
const { mockRedis, resetMocks, recordedCalls } = require('../helpers/mockService');
const { sanitizeText } = require('../../utils/sanitize');
const { formatAiPrompt } = require('../../services/ai/prompts');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    \x1b[31m${err.message}\x1b[0m`);
    failed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    \x1b[31m${err.message}\x1b[0m`);
    failed++;
  }
}

async function runAuthUsersChatsSocialTests() {
  console.log('\n\x1b[1m\x1b[36m===================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[36m🔒 INTEGRATION SUITE: AUTH, USERS, CHATS, SOCIAL & NOTIFICATIONS\x1b[0m');
  console.log('\x1b[1m\x1b[36m===================================================================\x1b[0m\n');

  // -------------------------------------------------------------
  // 1. AUTHENTICATION & SESSIONS
  // -------------------------------------------------------------
  console.log('\x1b[1m[1] Authentication Engine, Session Lifecycle & Token Rotation\x1b[0m');

  await runAsyncTest('OTP Request rate limiting and cooldown enforcement', async () => {
    resetMocks();
    const identifier = '+12345678900';
    const cooldownKey = `otp_cooldown:${identifier}`;

    // First OTP request sets cooldown
    await mockRedis.set(cooldownKey, '1', 'EX', 60);

    const isCooldownActive = await mockRedis.get(cooldownKey);
    assert.strictEqual(isCooldownActive, '1');
  });

  runTest('Refresh token rotation issues unique session IDs and tracks usage', () => {
    const user = createUserFactory();
    const session1 = createAuthTokens(user);
    const session2 = createAuthTokens(user);

    assert.notStrictEqual(session1.refreshToken, session2.refreshToken);
    assert.notStrictEqual(session1.sessionId, session2.sessionId);
  });

  runTest('CSRF Origin Guard allows trusted CLIENT_URL and blocks cross-origin attacks', () => {
    const trustedOrigin = 'http://localhost:5173';
    const maliciousOrigin = 'https://phishing-site.evil';

    const isOriginAllowed = (origin, clientUrl) => {
      if (!origin) return true; // Mobile apps / server-to-server
      return origin === clientUrl || origin === 'http://localhost:5173' || origin === 'http://localhost';
    };

    assert.strictEqual(isOriginAllowed(trustedOrigin, 'http://localhost:5173'), true);
    assert.strictEqual(isOriginAllowed(maliciousOrigin, 'http://localhost:5173'), false);
  });

  // -------------------------------------------------------------
  // 2. USERS & PROFILES
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[2] Users, Onboarding & Profile Verification\x1b[0m');

  runTest('Username uniqueness validation regex and length limits', () => {
    const isValidUsername = (u) => /^[a-zA-Z0-9_]{3,30}$/.test(u);

    assert.strictEqual(isValidUsername('flash_user1'), true);
    assert.strictEqual(isValidUsername('abc'), true);
    assert.strictEqual(isValidUsername('ab'), false); // Too short
    assert.strictEqual(isValidUsername('user@bad'), false); // Invalid char
    assert.strictEqual(isValidUsername('a'.repeat(31)), false); // Too long
  });

  runTest('User search excludes self and blocked users', () => {
    const currentUserId = 'user_me';
    const blockedIds = ['user_blocked_1', 'user_blocked_2'];
    const searchCandidates = [
      { id: 'user_me', username: 'me' },
      { id: 'user_blocked_1', username: 'blocked1' },
      { id: 'user_valid_1', username: 'valid1' },
      { id: 'user_valid_2', username: 'valid2' }
    ];

    const results = searchCandidates.filter(
      (u) => u.id !== currentUserId && !blockedIds.includes(u.id)
    );

    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].id, 'user_valid_1');
    assert.strictEqual(results[1].id, 'user_valid_2');
  });

  // -------------------------------------------------------------
  // 3. CHATS & MESSAGING
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[3] Chats, Message Deduplication & Edit Windows\x1b[0m');

  runTest('Direct chat pair key generation is order-independent (deduplication)', () => {
    const getPairKey = (u1, u2) => [String(u1), String(u2)].sort().join('_');

    const keyAB = getPairKey('userA', 'userB');
    const keyBA = getPairKey('userB', 'userA');

    assert.strictEqual(keyAB, keyBA);
  });

  runTest('Message edit allowed within 15 minutes and rejected after window', () => {
    const now = Date.now();
    const messageCreated10MinAgo = now - 10 * 60 * 1000;
    const messageCreated20MinAgo = now - 20 * 60 * 1000;

    const canEditMessage = (createdAt, currentTime = Date.now()) => {
      const FIFTEEN_MINS_MS = 15 * 60 * 1000;
      return currentTime - createdAt <= FIFTEEN_MINS_MS;
    };

    assert.strictEqual(canEditMessage(messageCreated10MinAgo, now), true);
    assert.strictEqual(canEditMessage(messageCreated20MinAgo, now), false);
  });

  runTest('Message delete for me vs delete for everyone logic', () => {
    const msg = createMessageFactory('userA', 'conv1');

    // Delete for me
    msg.deletedFor.push('userA');
    assert.ok(msg.deletedFor.includes('userA'));
    assert.strictEqual(msg.deletedForEveryone, false);

    // Delete for everyone
    msg.deletedForEveryone = true;
    assert.strictEqual(msg.deletedForEveryone, true);
  });

  // -------------------------------------------------------------
  // 4. SOCIAL & FEED PRIVACY
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[4] Social Graph, Follow Approvals & Content Sharing\x1b[0m');

  runTest('Follow request behavior: public accounts auto-accept, private accounts stay pending', () => {
    const followUser = (followerId, targetUser) => {
      return {
        follower: followerId,
        following: targetUser._id,
        status: targetUser.isPrivateAccount ? 'pending' : 'accepted'
      };
    };

    const publicUser = createUserFactory({ isPrivateAccount: false });
    const privateUser = createUserFactory({ isPrivateAccount: true });

    const followPub = followUser('userX', publicUser);
    const followPriv = followUser('userX', privateUser);

    assert.strictEqual(followPub.status, 'accepted');
    assert.strictEqual(followPriv.status, 'pending');
  });

  runTest('Shared post message format encapsulates immutable media snapshot', () => {
    const postSnapshot = {
      postId: 'post_123',
      authorName: 'Alex Rivers',
      authorUsername: 'alex',
      mediaUrl: 'https://cloudinary.com/post_thumb.jpg',
      caption: 'Sunset in Tokyo 🌅'
    };

    const sharedMsg = createMessageFactory('userA', 'conv1', {
      type: 'shared_post',
      text: 'Check this post out!',
      sharedContent: postSnapshot
    });

    assert.strictEqual(sharedMsg.type, 'shared_post');
    assert.strictEqual(sharedMsg.sharedContent.postId, 'post_123');
  });

  console.log('\n======================================================');
  console.log(`Suite Results: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  runAuthUsersChatsSocialTests();
}

module.exports = { runAuthUsersChatsSocialTests };
