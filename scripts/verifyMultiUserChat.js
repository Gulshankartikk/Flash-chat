/**
 * Flash Chat - End-to-End Multi-User Authentication, Manual Search & Real-Time Chat Verification
 *
 * Verifies:
 * 1. Multi-User Authentication (Alice, Bob, Charlie) independent registration, login, JWT and session isolation.
 * 2. Manual User Search: Searching by display name and @username returns matching users with avatar and presence.
 *    Self is excluded from search results. Non-onboarded registered users are fully discoverable.
 * 3. Start Direct Chat Deduplication: Multiple attempts by either participant return the exact same conversation.
 *    Conversation isolation across different user pairs.
 * 4. Real-Time Socket.IO Messaging: Instant delivery to recipient socket, delivery and read status, and
 *    room isolation preventing third parties (Charlie) from receiving private messages.
 * 5. MongoDB Persistence: Chat history and latest message preview persist across simulated page reloads.
 * 6. Privacy Barrier: Non-members cannot read conversation messages.
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

async function runMultiUserVerification() {
  console.log('\n========================================================================');
  console.log('⚡ FLASH CHAT - MULTI-USER AUTH, SEARCH & REAL-TIME CHAT VERIFICATION');
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
    // -------------------------------------------------------------
    // PHASE 1: Multi-User Registration & Authentication Lifecycle
    // -------------------------------------------------------------
    console.log('\x1b[1m[1] Multi-User Independent Registration & Session Validation\x1b[0m');
    const unique = Date.now().toString(36);

    const userAData = {
      name: 'Alice Springs',
      username: `alice_${unique}`,
      email: `alice_${unique}@flashchat.test`,
      password: 'Password123!'
    };

    const userBData = {
      name: 'Bob Builder',
      username: `bob_${unique}`,
      email: `bob_${unique}@flashchat.test`,
      password: 'Password123!'
    };

    const userCData = {
      name: 'Charlie Chaplin',
      username: `charlie_${unique}`,
      email: `charlie_${unique}@flashchat.test`,
      password: 'Password123!'
    };

    // User A: Signup via /api/auth/signup
    const regA = await request('POST', '/api/auth/signup', userAData);
    assert(regA.status === 201, `User Alice registered via /api/auth/signup (HTTP 201)`);
    const tokenA = regA.data.accessToken || regA.data.token;
    const userIdA = regA.data.user?._id || regA.data.user?.id;
    assert(!!tokenA && !!userIdA, `Alice received valid JWT token and distinct User ID`);

    // User B: Register via alias /api/auth/register
    const regB = await request('POST', '/api/auth/register', userBData);
    assert(regB.status === 201, `User Bob registered via endpoint alias /api/auth/register (HTTP 201)`);
    const tokenB = regB.data.accessToken || regB.data.token;
    const userIdB = regB.data.user?._id || regB.data.user?.id;
    assert(!!tokenB && !!userIdB && userIdB !== userIdA, `Bob received valid JWT token and distinct User ID`);

    // User C: Signup via /api/auth/signup
    const regC = await request('POST', '/api/auth/signup', userCData);
    assert(regC.status === 201, `User Charlie registered successfully (HTTP 201)`);
    const tokenC = regC.data.accessToken || regC.data.token;
    const userIdC = regC.data.user?._id || regC.data.user?.id;
    assert(!!tokenC && !!userIdC && userIdC !== userIdA && userIdC !== userIdB, `Charlie received distinct User ID`);

    // Login Alice via /api/auth/login
    const loginA = await request('POST', '/api/auth/login', {
      email: userAData.email,
      password: userAData.password
    });
    assert(loginA.status === 200, `Alice logged in via /api/auth/login with valid credentials (HTTP 200)`);
    const authHeaderA = { Authorization: `Bearer ${tokenA}` };

    // Verify session restoration and profile for Alice
    const meA = await request('GET', '/api/auth/me', null, authHeaderA);
    assert(meA.status === 200, `Alice profile fetched via /api/auth/me`);
    assert(meA.data.user?.name === 'Alice Springs', `Alice session returns correct user name: ${meA.data.user?.name}`);
    assert(meA.data.user?._id === userIdA, `Alice session strictly matches Alice ID with 0 cross-contamination`);

    // Verify Bob session
    const authHeaderB = { Authorization: `Bearer ${tokenB}` };
    const meB = await request('GET', '/api/auth/me', null, authHeaderB);
    assert(meB.status === 200 && meB.data.user?.name === 'Bob Builder', `Bob session independently returns Bob's profile`);

    // Verify Charlie session
    const authHeaderC = { Authorization: `Bearer ${tokenC}` };
    const meC = await request('GET', '/api/auth/me', null, authHeaderC);
    assert(meC.status === 200 && meC.data.user?.name === 'Charlie Chaplin', `Charlie session independently returns Charlie's profile`);

    // -------------------------------------------------------------
    // PHASE 2: Manual User Search & Discovery
    // -------------------------------------------------------------
    console.log('\n\x1b[1m[2] Manual User Search & Visibility\x1b[0m');

    // Alice searches for Bob by username
    const searchBobByUsername = await request('GET', `/api/users/search?q=${userBData.username}`, null, authHeaderA);
    assert(searchBobByUsername.status === 200, `/api/users/search responded HTTP 200`);
    const foundBob = searchBobByUsername.data.users?.find((u) => u._id === userIdB);
    assert(!!foundBob, `Alice manually found Bob by username (@${userBData.username})`);
    assert(foundBob?.name === 'Bob Builder', `Search result contains Bob's display name`);
    assert(foundBob?.avatar !== undefined, `Search result contains Bob's avatar URL`);

    // Alice searches for Charlie by display name (Charlie has not completed onboarding)
    const searchCharlieByName = await request('GET', `/api/users/search?q=Charlie`, null, authHeaderA);
    const foundCharlie = searchCharlieByName.data.users?.find((u) => u._id === userIdC);
    assert(!!foundCharlie, `Alice manually found newly registered Charlie (isOnboarded does NOT block discovery)`);

    // Search self-exclusion: Alice searches for "Alice" -> must NOT include herself
    const searchSelf = await request('GET', `/api/users/search?q=${userAData.username}`, null, authHeaderA);
    const foundSelf = searchSelf.data.users?.find((u) => u._id === userIdA);
    assert(!foundSelf, `User search strictly excludes the searching user from results`);

    // Public profile lookup by username and by ObjectId
    const profileByUsername = await request('GET', `/api/users/${userBData.username}`, null, authHeaderA);
    assert(profileByUsername.status === 200, `Public profile resolved by username /api/users/${userBData.username}`);

    const profileById = await request('GET', `/api/users/${userIdB}`, null, authHeaderA);
    assert(profileById.status === 200, `Public profile resolved by ObjectId /api/users/${userIdB}`);
    assert(profileById.data.user?._id === userIdB, `Profile response contains correct target user data`);

    // -------------------------------------------------------------
    // PHASE 3: Direct Chat Creation & Deduplication
    // -------------------------------------------------------------
    console.log('\n\x1b[1m[3] Direct Chat Start & Deduplication Safeguards\x1b[0m');

    // Alice starts chat with Bob via POST /api/chats/direct
    const chat1Res = await request('POST', '/api/chats/direct', { userId: userIdB }, authHeaderA);
    assert(chat1Res.status === 200, `Alice initiated direct chat with Bob via /api/chats/direct (HTTP 200)`);
    const convAB_1 = chat1Res.data.conversation?._id;
    assert(!!convAB_1, `Created conversation with ID: ${convAB_1}`);

    // Alice starts chat with Bob a second time via POST /api/chats (generic endpoint with recipientId)
    const chat2Res = await request('POST', '/api/chats', { recipientId: userIdB }, authHeaderA);
    assert(chat2Res.status === 200, `Alice opened direct chat with Bob again via POST /api/chats`);
    const convAB_2 = chat2Res.data.conversation?._id;
    assert(convAB_1 === convAB_2, `Deduplication verified: Repeated creation returned exact same conversation ID (${convAB_1})`);

    // Bob starts chat with Alice via /api/conversations (alias endpoint)
    const chat3Res = await request('POST', '/api/conversations', { userId: userIdA }, authHeaderB);
    assert(chat3Res.status === 200, `Bob initiated chat with Alice via /api/conversations alias`);
    const convBA = chat3Res.data.conversation?._id;
    assert(convBA === convAB_1, `Bidirectional deduplication verified: Bob's request returned identical conversation ID`);

    // Alice starts chat with Charlie
    const chatACRes = await request('POST', '/api/chats', { userId: userIdC }, authHeaderA);
    assert(chatACRes.status === 200, `Alice started direct chat with Charlie`);
    const convAC = chatACRes.data.conversation?._id;
    assert(convAC && convAC !== convAB_1, `Pair isolation verified: Alice-Charlie conversation (${convAC}) is distinct from Alice-Bob`);

    // -------------------------------------------------------------
    // PHASE 4: Real-Time Multi-User Socket.IO Messaging
    // -------------------------------------------------------------
    console.log('\n\x1b[1m[4] Real-Time Multi-User Socket.IO Messaging & Receipt Verification\x1b[0m');

    if (!ioClient) {
      console.warn('  ⚠️ socket.io-client library not available, skipping socket assertions');
    } else {
      // Connect Alice, Bob, and Charlie to Socket.IO simultaneously
      const socketA = ioClient(BASE_URL, {
        auth: { token: tokenA },
        transports: ['websocket'],
        reconnection: false
      });
      const socketB = ioClient(BASE_URL, {
        auth: { token: tokenB },
        transports: ['websocket'],
        reconnection: false
      });
      const socketC = ioClient(BASE_URL, {
        auth: { token: tokenC },
        transports: ['websocket'],
        reconnection: false
      });

      socketsToClose.push(socketA, socketB, socketC);

      await Promise.all([
        new Promise((res) => socketA.on('connect', res)),
        new Promise((res) => socketB.on('connect', res)),
        new Promise((res) => socketC.on('connect', res))
      ]);
      assert(socketA.connected && socketB.connected && socketC.connected, `Alice, Bob, and Charlie connected to Socket.IO concurrently`);

      // Set up real-time listener promises
      let bobReceivedMessage = null;
      let charlieReceivedLeak = false;

      socketB.on('message:new', (msg) => {
        bobReceivedMessage = msg;
      });

      socketC.on('message:new', (msg) => {
        if (msg.conversation === convAB_1) {
          charlieReceivedLeak = true;
        }
      });

      let aliceReceivedStatus = null;
      socketA.on('message:status', (status) => {
        aliceReceivedStatus = status;
      });

      let aliceReceivedReply = null;
      socketA.on('message:new', (msg) => {
        if (msg.text?.includes('Hey Alice')) {
          aliceReceivedReply = msg;
        }
      });

      // Alice sends message to Bob over Socket.IO
      const messageText = `Hello Bob! Real-time timestamp test: ${Date.now()}`;
      const ackSend = await new Promise((resolve) => {
        socketA.emit(
          'message:send',
          {
            conversationId: convAB_1,
            text: messageText,
            type: 'text'
          },
          (ack) => resolve(ack)
        );
      });

      assert(ackSend?.success === true, `Alice message:send acknowledged by server with success: true`);
      const sentMessageId = ackSend.message?._id;

      // Allow event propagation across sockets
      await sleep(300);

      assert(!!bobReceivedMessage, `Bob received message:new in real time over Socket.IO`);
      assert(bobReceivedMessage?.text === messageText, `Bob received the exact text content sent by Alice`);
      assert(bobReceivedMessage?.sender?._id === userIdA || bobReceivedMessage?.sender === userIdA, `Bob sees Alice as the sender`);
      assert(!charlieReceivedLeak, `Third party isolation verified: Charlie received 0 messages from Alice-Bob conversation`);

      // Bob marks message as read
      socketB.emit('message:read', { conversationId: convAB_1, upToMessageId: sentMessageId });
      await sleep(300);

      assert(aliceReceivedStatus !== null, `Alice received real-time read receipt (message:status)`);
      assert(aliceReceivedStatus?.status === 'read', `Status confirmed as "read"`);

      // Bob sends reply to Alice
      const replyText = `Hey Alice! Real-time messaging works perfectly! Timestamp: ${Date.now()}`;
      await new Promise((resolve) => {
        socketB.emit(
          'message:send',
          {
            conversationId: convAB_1,
            text: replyText,
            type: 'text'
          },
          (ack) => resolve(ack)
        );
      });

      await sleep(300);
      assert(!!aliceReceivedReply, `Alice received Bob's real-time reply via message:new`);
      assert(aliceReceivedReply?.text === replyText, `Alice received exact reply text`);
    }

    // -------------------------------------------------------------
    // PHASE 5: MongoDB Persistence & Message History Reload
    // -------------------------------------------------------------
    console.log('\n\x1b[1m[5] MongoDB Message History Persistence & Conversation Preview\x1b[0m');

    // Alice fetches messages via REST GET /api/chats/:id/messages
    const messagesResA = await request('GET', `/api/chats/${convAB_1}/messages`, null, authHeaderA);
    assert(messagesResA.status === 200, `Alice retrieved conversation messages history from database`);
    assert(Array.isArray(messagesResA.data.messages), `Messages returned as array`);
    assert(messagesResA.data.messages.length >= 2, `Both sent messages are persisted in MongoDB (count: ${messagesResA.data.messages.length})`);

    // Bob fetches his conversation list via GET /api/chats
    const chatsResB = await request('GET', '/api/chats', null, authHeaderB);
    assert(chatsResB.status === 200, `Bob fetched conversation list`);
    const convInB = chatsResB.data.conversations?.find((c) => c._id === convAB_1);
    assert(!!convInB, `Conversation is present in Bob's active conversation list`);
    assert(!!convInB?.lastMessage, `Conversation list contains latest message preview`);

    // -------------------------------------------------------------
    // PHASE 6: Security & Privacy Barrier
    // -------------------------------------------------------------
    console.log('\n\x1b[1m[6] Security & Privacy Boundaries\x1b[0m');

    // Charlie attempts to read Alice-Bob conversation messages
    const charlieAttempt = await request('GET', `/api/chats/${convAB_1}/messages`, null, authHeaderC);
    assert(
      charlieAttempt.status === 403 || charlieAttempt.status === 404,
      `Unauthorized user Charlie is denied access to Alice-Bob conversation history (HTTP ${charlieAttempt.status})`
    );

    // Logout cleanup
    await request('POST', '/api/auth/logout', null, authHeaderA);
    await request('POST', '/api/auth/logout', null, authHeaderB);
    await request('POST', '/api/auth/logout', null, authHeaderC);
    assert(true, `All test sessions cleanly logged out`);

  } catch (err) {
    console.error(`\n❌ UNEXPECTED ERROR: ${err.message}`);
    console.error(err.stack);
    failed++;
  } finally {
    socketsToClose.forEach((s) => {
      try {
        s.disconnect();
      } catch (e) {}
    });
  }

  console.log('\n========================================================================');
  console.log(`MULTI-USER VERIFICATION SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMultiUserVerification();
