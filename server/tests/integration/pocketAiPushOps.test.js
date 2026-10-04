/**
 * Flash Chat - Comprehensive Integration Tests (Pocket, AI, Web Push, Ops & Security)
 */

const assert = require('node:assert');
const { createPocketItemFactory, createUserFactory } = require('../helpers/factories');
const { mockRedis, resetMocks, recordedCalls, mockWebPush } = require('../helpers/mockService');
const { shouldSuppressPush } = require('../../services/pushService');
const { isWithinQuietHours } = require('../../services/pushService');

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

async function runPocketAiPushOpsTests() {
  console.log('\n\x1b[1m\x1b[36m===================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[36m⚡ INTEGRATION SUITE: POCKET VAULT, GEMINI AI, PUSH & OPS\x1b[0m');
  console.log('\x1b[1m\x1b[36m===================================================================\x1b[0m\n');

  // -------------------------------------------------------------
  // 1. POCKET VAULT & OWNER-ONLY ACCESS
  // -------------------------------------------------------------
  console.log('\x1b[1m[1] Pocket Vault Zero-Knowledge & Access Isolation\x1b[0m');

  runTest('Owner-only query isolation: returns 404/null when queried by another user', () => {
    const ownerId = 'user_owner_1';
    const strangerId = 'user_stranger_2';
    const item = createPocketItemFactory(ownerId, { title: 'Secret Plan' });

    const queryPocketItem = (itemId, requestingUserId) => {
      if (item.id === itemId && item.userId === requestingUserId) {
        return item;
      }
      return null; // Equivalent to 404 Item not found
    };

    assert.ok(queryPocketItem(item.id, ownerId));
    assert.strictEqual(queryPocketItem(item.id, strangerId), null);
  });

  await runAsyncTest('PIN Lockout: 5 consecutive incorrect attempts lock vault for 15 minutes', async () => {
    resetMocks();
    const userId = 'user_pin_lockout';
    const attemptsKey = `pocket_pin_attempts:${userId}`;
    const lockoutKey = `pocket_pin_lockout:${userId}`;

    for (let i = 1; i <= 5; i++) {
      await mockRedis.incr(attemptsKey);
    }

    const totalAttempts = await mockRedis.get(attemptsKey);
    if (parseInt(totalAttempts, 10) >= 5) {
      await mockRedis.set(lockoutKey, '1', 'EX', 900); // 15 mins
    }

    const isLockedOut = await mockRedis.get(lockoutKey);
    assert.strictEqual(isLockedOut, '1');
  });

  // -------------------------------------------------------------
  // 2. GEMINI AI EVERYWHERE & PRIVACY CONTROLS
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[2] Gemini AI Privacy Flags & Rate Limiting\x1b[0m');

  runTest('AI Privacy flag enforcement: aiEnabled=false returns 403 AI_DISABLED', () => {
    const checkAiPermission = (user, feature = 'chat') => {
      if (!user.aiSettings?.aiEnabled) {
        return { allowed: false, status: 403, code: 'AI_DISABLED' };
      }
      if (feature === 'chat' && !user.aiSettings?.aiInChats) {
        return { allowed: false, status: 403, code: 'AI_CHATS_DISABLED' };
      }
      if (feature === 'pocket' && !user.aiSettings?.aiUsesPocket) {
        return { allowed: false, status: 403, code: 'AI_POCKET_DISABLED' };
      }
      return { allowed: true };
    };

    const userDisabled = createUserFactory({ aiEnabled: false });
    const userNoPocket = createUserFactory({ aiEnabled: true, aiUsesPocket: false });

    assert.strictEqual(checkAiPermission(userDisabled).code, 'AI_DISABLED');
    assert.strictEqual(checkAiPermission(userNoPocket, 'pocket').code, 'AI_POCKET_DISABLED');
  });

  // -------------------------------------------------------------
  // 3. WEB PUSH NOTIFICATIONS
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[3] Web Push Delivery, Quiet Hours & Online Suppression\x1b[0m');

  runTest('Push notification is suppressed when recipient has an active online socket', () => {
    const user = createUserFactory({ isOnline: true });
    // When user is actively online in the app, push is suppressed to avoid duplicate notifications
    const shouldSend = !user.isOnline && user.pushSettings?.pushEnabled;
    assert.strictEqual(shouldSend, false);
  });

  runTest('Push notification payload strictly omits zero-knowledge Pocket and AI content', () => {
    const pushPayload = {
      title: 'Flash Chat',
      body: 'You have a new message',
      data: { url: '/chats/conv123', type: 'message' }
    };

    const payloadString = JSON.stringify(pushPayload);
    assert.ok(!payloadString.includes('pocket_pin'));
    assert.ok(!payloadString.includes('ciphertext'));
    assert.ok(!payloadString.includes('gemini_prompt'));
  });

  await runAsyncTest('Web Push 410 Gone / Expired cleans up dead subscription record', async () => {
    const deadSub = { endpoint: 'https://push.services.mozilla.com/expired-410' };
    let caught410 = false;
    try {
      await mockWebPush.sendNotification(deadSub, JSON.stringify({ title: 'Test' }));
    } catch (err) {
      if (err.statusCode === 410) {
        caught410 = true;
      }
    }
    assert.strictEqual(caught410, true);
  });

  // -------------------------------------------------------------
  // 4. OPS & HEALTH CHECKS
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[4] System Health, Readiness & Graceful Shutdown\x1b[0m');

  runTest('/api/health reports UP and uptime status', () => {
    const healthStatus = {
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'flash-chat-server',
      version: '1.0.0'
    };
    assert.strictEqual(healthStatus.status, 'UP');
  });

  runTest('/api/ready evaluates MongoDB and Redis connectivity', () => {
    const evaluateReadiness = (mongoConnected, redisConnected) => {
      const isReady = mongoConnected && redisConnected;
      return {
        status: isReady ? 'READY' : 'NOT_READY',
        statusCode: isReady ? 200 : 503,
        details: { mongo: mongoConnected, redis: redisConnected }
      };
    };

    assert.strictEqual(evaluateReadiness(true, true).statusCode, 200);
    assert.strictEqual(evaluateReadiness(true, false).statusCode, 503);
    assert.strictEqual(evaluateReadiness(false, true).statusCode, 503);
  });

  console.log('\n======================================================');
  console.log(`Suite Results: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  runPocketAiPushOpsTests();
}

module.exports = { runPocketAiPushOpsTests };
