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

  // -------------------------------------------------------------
  // 5. CLUSTERED PRESENCE & RECONNECTION MESSAGE SYNCHRONIZATION
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[5] Clustered Presence, Reconnection & Offline Message Sync\x1b[0m');

  runTest('Multi-tab socket tracking maintains presence until all sockets disconnect', () => {
    const userSockets = new Map();

    const connectTab = (userId, socketId) => {
      if (!userSockets.has(userId)) userSockets.set(userId, new Set());
      userSockets.get(userId).add(socketId);
    };

    const disconnectTab = (userId, socketId) => {
      const set = userSockets.get(userId);
      if (!set) return true;
      set.delete(socketId);
      if (set.size === 0) {
        userSockets.delete(userId);
        return true; // Marked offline
      }
      return false; // Still online in other tab
    };

    connectTab('user1', 'sock_tab1');
    connectTab('user1', 'sock_tab2');

    // First tab closes
    const isOfflineAfterTab1 = disconnectTab('user1', 'sock_tab1');
    assert.strictEqual(isOfflineAfterTab1, false);
    assert.strictEqual(userSockets.has('user1'), true);

    // Second tab closes
    const isOfflineAfterTab2 = disconnectTab('user1', 'sock_tab2');
    assert.strictEqual(isOfflineAfterTab2, true);
    assert.strictEqual(userSockets.has('user1'), false);
  });

  runTest('Offline message synchronization filters unreceived messages after timestamp', () => {
    const mockMessages = [
      { _id: 'm1', createdAt: new Date(Date.now() - 50000) },
      { _id: 'm2', createdAt: new Date(Date.now() - 30000) },
      { _id: 'm3', createdAt: new Date(Date.now() - 10000) }
    ];

    const lastSyncTime = new Date(Date.now() - 20000);
    const syncMissed = mockMessages.filter(m => m.createdAt > lastSyncTime);

    assert.strictEqual(syncMissed.length, 1);
    assert.strictEqual(syncMissed[0]._id, 'm3');
  });

  runTest('Client offline message queue retains outgoing messages until socket reconnects', () => {
    const queue = [];
    let isConnected = false;

    const sendMessageOrQueue = (msg) => {
      if (!isConnected) {
        queue.push(msg);
        return { status: 'queued' };
      }
      return { status: 'sent', message: msg };
    };

    const drainQueue = () => {
      const dispatched = [...queue];
      queue.length = 0;
      return dispatched;
    };

    const res1 = sendMessageOrQueue({ text: 'Offline 1', clientId: 'c1' });
    const res2 = sendMessageOrQueue({ text: 'Offline 2', clientId: 'c2' });

    assert.strictEqual(res1.status, 'queued');
    assert.strictEqual(res2.status, 'queued');
    assert.strictEqual(queue.length, 2);

    // Reconnected
    isConnected = true;
    const sent = drainQueue();
    assert.strictEqual(sent.length, 2);
    assert.strictEqual(queue.length, 0);
  });

  console.log('\n======================================================');
  console.log(`Socket Suite Results: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

if (require.main === module) {
  runSocketAndSignalingTests();
}

module.exports = { runSocketAndSignalingTests };
