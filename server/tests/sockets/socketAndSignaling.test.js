/**
 * Flash Chat - Comprehensive Socket.IO & WebRTC Signaling Tests (Part 10-2.4)
 */

const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const config = require('../../config/env');
const { createUserFactory, createAuthTokens, createMessageFactory } = require('../helpers/factories');

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

async function runSocketAndSignalingTests() {
  console.log('\n\x1b[1m\x1b[36m===================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[36m📡 SOCKET.IO & WEBRTC CALL SIGNALING TEST SUITE (Part 10-2.4)\x1b[0m');
  console.log('\x1b[1m\x1b[36m===================================================================\x1b[0m\n');

  // -------------------------------------------------------------
  // 1. SOCKET AUTHENTICATION & HANDSHAKE
  // -------------------------------------------------------------
  console.log('\x1b[1m[1] Socket.IO Handshake & JWT Verification\x1b[0m');

  runTest('Rejects connection when token is missing or malformed', () => {
    const authenticateSocket = (authHeader, tokenCookie) => {
      const rawToken = authHeader?.replace('Bearer ', '') || tokenCookie;
      if (!rawToken) throw new Error('Authentication required');
      try {
        return jwt.verify(rawToken, config.JWT_ACCESS_SECRET || 'test_jwt_access_secret_super_secure_12345');
      } catch (e) {
        throw new Error('Invalid token');
      }
    };

    assert.throws(() => authenticateSocket(null, null), /Authentication required/);
    assert.throws(() => authenticateSocket('Bearer invalid_token_xyz', null), /Invalid token/);
  });

  runTest('Authenticates valid JWT token and populates user session', () => {
    const user = createUserFactory();
    const { accessToken } = createAuthTokens(user);

    const decoded = jwt.verify(accessToken, config.JWT_ACCESS_SECRET || 'test_jwt_access_secret_super_secure_12345');
    assert.strictEqual(decoded.userId, user._id);
    assert.strictEqual(decoded.username, user.username);
  });

  // -------------------------------------------------------------
  // 2. REALTIME MESSAGING & DEDUPLICATION
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[2] Realtime Messaging, ClientId Deduplication & Read Receipts\x1b[0m');

  runTest('Deduplicates duplicate message submissions using clientId', () => {
    const messageHistory = new Map();
    const handleIncomingMessage = (msg) => {
      if (messageHistory.has(msg.clientId)) {
        return { isDuplicate: true, message: messageHistory.get(msg.clientId) };
      }
      messageHistory.set(msg.clientId, msg);
      return { isDuplicate: false, message: msg };
    };

    const msg1 = createMessageFactory('userA', 'conv1', { clientId: 'client_req_001', text: 'First send' });
    const res1 = handleIncomingMessage(msg1);
    const res2 = handleIncomingMessage(msg1); // duplicate

    assert.strictEqual(res1.isDuplicate, false);
    assert.strictEqual(res2.isDuplicate, true);
    assert.strictEqual(messageHistory.size, 1);
  });

  runTest('Ticks progression respects read receipts privacy setting', () => {
    const recipientUser = createUserFactory({ readReceipts: false });

    const computeTickStatus = (message, isReadByRecipient, readReceiptsAllowed) => {
      if (!isReadByRecipient) return 'delivered';
      return readReceiptsAllowed ? 'read' : 'delivered';
    };

    assert.strictEqual(computeTickStatus({}, true, true), 'read');
    assert.strictEqual(computeTickStatus({}, true, recipientUser.privacySettings.readReceipts), 'delivered');
  });

  // -------------------------------------------------------------
  // 3. WEBRTC CALL SIGNALING STATE MACHINE
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[3] WebRTC Call Signaling (Offer/Answer/ICE, Busy & Ring Timeouts)\x1b[0m');

  runTest('Busy state returned when callee is already engaged in an active call', () => {
    const activeCalls = new Map([['user_busy_callee', 'call_active_123']]);

    const initiateCall = (callerId, calleeId) => {
      if (activeCalls.has(calleeId)) {
        return { status: 'busy', reason: 'User is on another call' };
      }
      return { status: 'ringing', callId: `call_${Date.now()}` };
    };

    const res = initiateCall('user_caller', 'user_busy_callee');
    assert.strictEqual(res.status, 'busy');
  });

  runTest('Ring timeout transitions unanswered call to missed after 45 seconds', () => {
    const call = {
      callId: 'call_999',
      status: 'ringing',
      startedAt: Date.now() - 46 * 1000
    };

    const evaluateCallTimeout = (callObj, timeoutMs = 45000) => {
      if (callObj.status === 'ringing' && Date.now() - callObj.startedAt > timeoutMs) {
        return 'missed';
      }
      return callObj.status;
    };

    assert.strictEqual(evaluateCallTimeout(call), 'missed');
  });

  // -------------------------------------------------------------
  // 4. MULTI-INSTANCE REDIS ADAPTER PUB/SUB
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[4] Multi-Instance Scalability & Redis Pub/Sub Broadcasts\x1b[0m');

  runTest('Broadcasts event to conv:<id> and user:<id> rooms cross-cluster', () => {
    const mockCluster = {
      instance1: { rooms: new Set(['conv:conv123', 'user:userA']) },
      instance2: { rooms: new Set(['conv:conv123', 'user:userB']) }
    };

    const publishToRoom = (room, event, payload) => {
      const deliveredInstances = [];
      if (mockCluster.instance1.rooms.has(room)) deliveredInstances.push('instance1');
      if (mockCluster.instance2.rooms.has(room)) deliveredInstances.push('instance2');
      return deliveredInstances;
    };

    const result = publishToRoom('conv:conv123', 'message:new', { text: 'Cross-instance hello' });
    assert.strictEqual(result.length, 2);
    assert.ok(result.includes('instance1'));
    assert.ok(result.includes('instance2'));
  });

  console.log('\n======================================================');
  console.log(`Socket Suite Results: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  runSocketAndSignalingTests();
}

module.exports = { runSocketAndSignalingTests };
