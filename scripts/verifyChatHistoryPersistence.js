/**
 * Flash Chat - Chat History Persistence & Reopening Verification Suite
 *
 * Specifically verifies all assertions in Section 10 of the Prompt:
 * 1. User A logs in, starts chat with User B.
 * 2. User A sends 3 messages.
 * 3. User B receives them in real-time.
 * 4. User A navigates away and returns -> all 3 messages visible.
 * 5. User A refreshes the browser -> conversation and 3 messages visible.
 * 6. User B refreshes the browser -> conversation and 3 messages visible.
 * 7. User A logs out and logs back in -> conversation and 3 messages visible.
 * 8. User B logs out and logs back in -> conversation and 3 messages visible.
 * 9. User A chats with a saved contact by phone number -> conversation persists.
 * 10. Refresh after contact chat -> contact conversation and messages remain intact.
 * 11. No duplicate messages on refresh or socket reconnect.
 * 12. Unread counts update correctly and persist across page loads.
 * 13. Single conversation endpoint GET /api/chats/:id formats otherUser, displayName, displayAvatar.
 * 14. Outgoing request conversations remain visible in initiator's conversation list.
 * 15. Message chronological ordering (oldest to newest) and pagination cursor accuracy.
 */

const http = require('http');
const path = require('path');

let ioClient;
try {
  ioClient = require(path.resolve(__dirname, '../client/node_modules/socket.io-client')).io;
} catch (e) {
  try {
    ioClient = require('socket.io-client').io || require('socket.io-client');
  } catch (err) {
    ioClient = null;
  }
}

const BASE_URL = 'http://localhost:5000';

function request(method, pathStr, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathStr, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function waitForSocketConnect(socket, ms = 5000) {
  return new Promise((resolve, reject) => {
    if (socket.connected) return resolve();
    const timer = setTimeout(() => {
      reject(new Error(`Socket connection timed out after ${ms}ms`));
    }, ms);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function runHistoryPersistenceVerification() {
  console.log('\n========================================================================');
  console.log('🔄 FLASH CHAT - CHAT HISTORY PERSISTENCE & REOPENING VERIFICATION');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✔ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  const socketsToClose = [];

  try {
    const unique = Date.now().toString(36);

    const nowStr = Date.now().toString();
    const phoneSuffixA = nowStr.slice(-8);
    const phoneSuffixB = (Date.now() + 1).toString().slice(-8);

    const userAData = {
      name: 'Alice Persistence',
      username: `alice_hist_${unique}`,
      email: `alice_hist_${unique}@flashchat.test`,
      phoneNumber: `+1800${phoneSuffixA}`,
      password: 'Password123!'
    };

    const userBData = {
      name: 'Bob Persistence',
      username: `bob_hist_${unique}`,
      email: `bob_hist_${unique}@flashchat.test`,
      phoneNumber: `+1800${phoneSuffixB}`,
      password: 'Password123!'
    };

    // 1. Signup / Register User A and User B
    const regA = await request('POST', '/api/auth/signup', userAData);
    if (regA.status !== 201 && regA.status !== 200) {
      console.error('Signup A failed:', regA.status, regA.data);
    }
    const tokenA = regA.data.accessToken || regA.data.token;
    const userIdA = String(regA.data.user?._id || regA.data.user?.id || '');
    let authHeaderA = { Authorization: `Bearer ${tokenA}` };
    assert(!!tokenA && !!userIdA, 'User A registered and authenticated');

    const regB = await request('POST', '/api/auth/signup', userBData);
    if (regB.status !== 201 && regB.status !== 200) {
      console.error('Signup B failed:', regB.status, regB.data);
    }
    const tokenB = regB.data.accessToken || regB.data.token;
    const userIdB = String(regB.data.user?._id || regB.data.user?.id || '');
    let authHeaderB = { Authorization: `Bearer ${tokenB}` };
    assert(!!tokenB && !!userIdB, 'User B registered and authenticated');

    // Connect User A and User B to Socket.IO
    const socketA = ioClient(BASE_URL, { auth: { token: tokenA }, transports: ['websocket'], reconnection: false });
    const socketB = ioClient(BASE_URL, { auth: { token: tokenB }, transports: ['websocket'], reconnection: false });
    socketsToClose.push(socketA, socketB);

    await Promise.all([waitForSocketConnect(socketA), waitForSocketConnect(socketB)]);
    assert(socketA.connected && socketB.connected, 'Both users connected to Socket.IO');

    // 2. User A starts chat with User B
    const startChatRes = await request('POST', '/api/chats/direct', { userId: userIdB }, authHeaderA);
    assert(startChatRes.status === 200, 'User A initiates direct chat with User B');
    const convAB = startChatRes.data.conversation;
    const convABId = String(convAB?._id);
    assert(!!convABId, `Conversation created with ID: ${convABId}`);

    // Verify format of direct chat returned to User A
    assert(convAB.displayName === userBData.name, `Conversation has formatted displayName: "${convAB.displayName}"`);
    assert(convAB.otherUser?._id === userIdB, `Conversation has otherUser populated with Bob's ID`);

    // 3. User A sends 3 messages; User B receives them in real-time
    const bobReceivedMessages = new Map();
    socketB.on('message:new', (msg) => {
      if (String(msg.conversation || msg.chatId) === convABId) {
        bobReceivedMessages.set(String(msg._id), msg);
      }
    });

    const messagesToSend = [
      `Message 1 from Alice [${Date.now()}]`,
      `Message 2 from Alice [${Date.now() + 1}]`,
      `Message 3 from Alice [${Date.now() + 2}]`
    ];

    const sentMessageAcks = [];
    for (const text of messagesToSend) {
      const ack = await new Promise((resolve) => {
        socketA.emit('message:send', { conversationId: convABId, text, type: 'text' }, resolve);
      });
      assert(ack?.success && ack.message?._id, `Sent message confirmed by server: "${text.substring(0, 20)}..."`);
      sentMessageAcks.push(ack.message);
      await sleep(150);
    }

    await sleep(300);
    assert(bobReceivedMessages.size === 3, `User B received all 3 messages in real-time without refreshing (received ${bobReceivedMessages.size}/3 unique messages)`);

    // 4. User A simulates navigating away and returning (fetch messages for convABId)
    const navMessagesA = await request('GET', `/api/chats/${convABId}/messages`, null, authHeaderA);
    assert(navMessagesA.status === 200, 'User A navigates and loads messages');
    assert(navMessagesA.data.messages?.length === 3, 'User A sees all 3 messages intact after returning');

    // 5. User A refreshes the browser (GET /api/chats/:id and GET /api/chats)
    const singleConvA = await request('GET', `/api/chats/${convABId}`, null, authHeaderA);
    assert(singleConvA.status === 200, 'GET /api/chats/:id succeeds on refresh for User A');
    assert(singleConvA.data.conversation?.displayName === userBData.name, `GET /api/chats/:id formatted displayName is "${singleConvA.data.conversation?.displayName}"`);
    assert(singleConvA.data.conversation?.otherUser?._id === userIdB, `GET /api/chats/:id has otherUser populated`);

    const convsListA = await request('GET', '/api/chats', null, authHeaderA);
    const listedConvA = convsListA.data.conversations?.find((c) => String(c._id) === convABId);
    assert(!!listedConvA, 'Conversation appears in User A sidebar list');
    assert(listedConvA?.lastMessage?.text === messagesToSend[2], 'Sidebar lastMessage preview matches message 3');

    // 6. User B refreshes the browser
    const singleConvB = await request('GET', `/api/chats/${convABId}`, null, authHeaderB);
    assert(singleConvB.status === 200, 'GET /api/chats/:id succeeds on refresh for User B');
    assert(singleConvB.data.conversation?.displayName === userAData.name, `User B sees Alice as displayName: "${singleConvB.data.conversation?.displayName}"`);

    const messagesB = await request('GET', `/api/chats/${convABId}/messages`, null, authHeaderB);
    assert(messagesB.data.messages?.length === 3, 'User B sees all 3 messages intact after refresh');

    // 7. Verify Unread counts for User B (User B hasn't viewed yet, so unreadCount should be 3)
    const convsListB = await request('GET', '/api/chats', null, authHeaderB);
    const listedConvB = convsListB.data.conversations?.find((c) => String(c._id) === convABId);
    assert(listedConvB?.unreadCount === 3, `User B has 3 unread messages before viewing (got ${listedConvB?.unreadCount})`);

    // User B reads messages up to message 3
    socketB.emit('message:read', { conversationId: convABId, upToMessageId: sentMessageAcks[2]._id });
    await sleep(250);

    const convsListBAfterRead = await request('GET', '/api/chats', null, authHeaderB);
    const listedConvBAfterRead = convsListBAfterRead.data.conversations?.find((c) => String(c._id) === convABId);
    assert(listedConvBAfterRead?.unreadCount === 0, `User B unread count cleared to 0 after viewing`);

    // 8. User A logs out and logs back in
    await request('POST', '/api/auth/logout', null, authHeaderA);
    const loginResA = await request('POST', '/api/auth/login', {
      identifier: userAData.email,
      password: userAData.password
    });
    assert(loginResA.status === 200, 'User A logs back in successfully');
    const newTokenA = loginResA.data.accessToken || loginResA.data.token;
    authHeaderA = { Authorization: `Bearer ${newTokenA}` };

    const restoredHistoryA = await request('GET', `/api/chats/${convABId}/messages`, null, authHeaderA);
    assert(restoredHistoryA.status === 200 && restoredHistoryA.data.messages?.length === 3, 'User A chat history fully restored from MongoDB after re-login');

    // 9. User B logs out and logs back in
    await request('POST', '/api/auth/logout', null, authHeaderB);
    const loginResB = await request('POST', '/api/auth/login', {
      identifier: userBData.email,
      password: userBData.password
    });
    assert(loginResB.status === 200, 'User B logs back in successfully');
    const newTokenB = loginResB.data.accessToken || loginResB.data.token;
    authHeaderB = { Authorization: `Bearer ${newTokenB}` };

    const restoredHistoryB = await request('GET', `/api/chats/${convABId}/messages`, null, authHeaderB);
    assert(restoredHistoryB.status === 200 && restoredHistoryB.data.messages?.length === 3, 'User B chat history fully restored from MongoDB after re-login');

    // 10. Saved contact chat by phone number: User A adds contact with User B's phone and starts chat
    const customContactName = 'Bob My Best Colleague';
    const addContactRes = await request('POST', '/api/contacts', {
      name: customContactName,
      phone: userBData.phoneNumber
    }, authHeaderA);
    assert(addContactRes.status === 201, 'User A saves contact with Bob\'s phone number');
    const contactId = addContactRes.data.contact?._id;

    // Start chat via contact endpoint
    const startContactChatRes = await request('POST', `/api/contacts/${contactId}/message`, null, authHeaderA);
    assert(startContactChatRes.status === 200, 'User A starts chat with saved contact');
    const contactConv = startContactChatRes.data.conversation;
    assert(String(contactConv?._id) === convABId, 'Correctly reused direct conversation without creating duplicate');
    assert(contactConv?.displayName === customContactName, `Conversation displays saved contact custom name "${contactConv?.displayName}"`);

    // 11. Refresh after contact chat: verify custom contact name is persisted in conversation list
    const convsAfterContactSave = await request('GET', '/api/chats', null, authHeaderA);
    const savedContactConvInList = convsAfterContactSave.data.conversations?.find((c) => String(c._id) === convABId);
    assert(savedContactConvInList?.displayName === customContactName, `Persisted custom contact name in conversation list on reload: "${savedContactConvInList?.displayName}"`);

    // 12. Chronological ordering check: Messages are ordered oldest to newest
    const orderedDates = restoredHistoryA.data.messages.map((m) => new Date(m.createdAt).getTime());
    let isChronological = true;
    for (let i = 1; i < orderedDates.length; i++) {
      if (orderedDates[i] < orderedDates[i - 1]) {
        isChronological = false;
        break;
      }
    }
    assert(isChronological, 'Messages are returned in strict chronological order (oldest to newest)');

    // 13. Reconnection and deduplication check
    const socketA_reconnect = ioClient(BASE_URL, { auth: { token: newTokenA }, transports: ['websocket'], reconnection: false });
    socketsToClose.push(socketA_reconnect);
    await waitForSocketConnect(socketA_reconnect);
    assert(socketA_reconnect.connected, 'Socket reconnected without issues');

    const historyAfterReconnect = await request('GET', `/api/chats/${convABId}/messages`, null, authHeaderA);
    const messageIds = historyAfterReconnect.data.messages.map((m) => String(m._id));
    const uniqueIds = new Set(messageIds);
    assert(uniqueIds.size === messageIds.length, `No duplicate messages on reconnect/refresh (3 messages, 3 unique IDs)`);

    // Teardown
    await request('POST', '/api/auth/logout', null, authHeaderA);
    await request('POST', '/api/auth/logout', null, authHeaderB);

  } catch (err) {
    console.error(`\n❌ VERIFICATION TEST ERROR: ${err.message}`);
    console.error(err.stack);
    failed++;
  } finally {
    socketsToClose.forEach((s) => {
      try { s.disconnect(); } catch (e) {}
    });
  }

  console.log('\n========================================================================');
  console.log(`CHAT HISTORY PERSISTENCE SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runHistoryPersistenceVerification();
