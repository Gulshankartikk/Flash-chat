/**
 * Flash Chat - Full Project Automated Live Self-Test Suite ("Test of Yourself")
 * Runs comprehensive end-to-end verification across live server on http://localhost:5000
 */

const http = require('http');
const path = require('path');

let io;
try {
  io = require(path.resolve(__dirname, '../client/node_modules/socket.io-client')).io;
} catch (e) {
  try {
    io = require('socket.io-client').io || require('socket.io-client');
  } catch (err) {
    io = null;
  }
}

const BASE_URL = 'http://localhost:5000';

async function request(method, pathStr, body = null, headers = {}) {
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

async function runFullSelfTest() {
  console.log('\n========================================================================');
  console.log('⚡ FLASH CHAT - FULL PROJECT LIVE SELF-TEST SUITE ("Test of Yourself")');
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

  try {
    // -------------------------------------------------------------
    // SECTION 1: Health & Readiness
    // -------------------------------------------------------------
    console.log('[1] Server Health & Readiness Probes');
    const health = await request('GET', '/api/health');
    assert(health.status === 200, `/api/health responded with HTTP 200 (Got ${health.status})`);
    assert(health.data.status === 'healthy', `Server status is "healthy"`);
    assert(health.data.services.mongodb === 'connected', `MongoDB is actively connected`);
    assert(health.data.version === '1.1.0', `Version matches release v1.1.0 (Got ${health.data.version})`);

    const ready = await request('GET', '/api/ready');
    assert(ready.status === 200 && ready.data.status === 'ready', `/api/ready probe confirmed database readiness`);

    // -------------------------------------------------------------
    // SECTION 2: User Registration, JWT Tokens & Session Me
    // -------------------------------------------------------------
    console.log('\n[2] User Authentication & Session Management');
    const unique = Date.now().toString(36);
    const testUserA = {
      name: 'Alice Tester',
      email: `alice_${unique}@flashchat.test`,
      password: 'Password123!'
    };
    const testUserB = {
      name: 'Bob Tester',
      email: `bob_${unique}@flashchat.test`,
      password: 'Password123!'
    };

    const regA = await request('POST', '/api/auth/signup', testUserA);
    assert(regA.status === 201, `User Alice registered successfully (HTTP 201)`);
    const tokenA = regA.data.accessToken || regA.data.token;
    const userIdA = regA.data.user?._id || regA.data.user?.id;
    assert(!!tokenA && !!userIdA, `Received valid JWT access token and User ID for Alice`);

    const regB = await request('POST', '/api/auth/signup', testUserB);
    assert(regB.status === 201, `User Bob registered successfully (HTTP 201)`);
    const tokenB = regB.data.accessToken || regB.data.token;
    const userIdB = regB.data.user?._id || regB.data.user?.id;

    // Login Alice
    const loginA = await request('POST', '/api/auth/login', {
      email: testUserA.email,
      password: testUserA.password
    });
    assert(loginA.status === 200, `Alice logged in successfully via /api/auth/login`);

    // Fetch /api/auth/me
    const meA = await request('GET', '/api/auth/me', null, {
      Authorization: `Bearer ${tokenA}`
    });
    assert(meA.status === 200 && meA.data.user.email === testUserA.email, `/api/auth/me returns authenticated user profile`);

    // -------------------------------------------------------------
    // SECTION 3: Realtime Socket.IO Connection & Authentication
    // -------------------------------------------------------------
    console.log('\n[3] Realtime Socket.IO Handshake & Authentication');
    let socketA = null;
    if (io) {
      socketA = io(BASE_URL, {
        auth: { token: tokenA },
        transports: ['websocket'],
        reconnection: false
      });

      const socketConnected = await new Promise((resolve) => {
        socketA.on('connect', () => resolve(true));
        socketA.on('connect_error', (err) => {
          console.error('Socket error:', err.message);
          resolve(false);
        });
        setTimeout(() => resolve(false), 4000);
      });
      assert(socketConnected === true, `Socket.IO connected and authenticated via JWT`);
    } else {
      console.log('  ⚠️ socket.io-client not required directly; skipping client socket connection.');
    }

    // -------------------------------------------------------------
    // SECTION 4: Direct Chat & Realtime Messaging
    // -------------------------------------------------------------
    console.log('\n[4] Direct Conversations & Messaging');
    const createConv = await request('POST', '/api/chats/direct', {
      userId: userIdB
    }, { Authorization: `Bearer ${tokenA}` });

    assert(createConv.status === 200 || createConv.status === 201, `Created 1-on-1 direct chat between Alice and Bob`);
    const convObj = createConv.data.conversation || createConv.data.chat || createConv.data;
    const convId = convObj._id || convObj.id;

    // Send Message
    const sendMsg = await request('POST', '/api/messages', {
      conversationId: convId,
      text: 'Hello Bob! This is an automated self-test message ⚡',
      clientId: `client_${unique}_1`
    }, { Authorization: `Bearer ${tokenA}` });

    assert(sendMsg.status === 200 || sendMsg.status === 201, `Sent message from Alice to Bob`);
    const msgObj = sendMsg.data.message || sendMsg.data;
    assert(msgObj.text && msgObj.text.includes('automated self-test message'), `Message payload verified in chat store`);

    // Get Messages for chat
    const getMsgs = await request('GET', `/api/chats/${convId}/messages`, null, {
      Authorization: `Bearer ${tokenA}`
    });
    assert(getMsgs.status === 200 && Array.isArray(getMsgs.data.messages || getMsgs.data), `Fetched conversation messages list`);

    // -------------------------------------------------------------
    // SECTION 5: Flash AI Generative Intelligence & Fallback
    // -------------------------------------------------------------
    console.log('\n[5] Flash AI Generative Intelligence & Transparency');
    const aiUsage = await request('GET', '/api/ai/usage', null, {
      Authorization: `Bearer ${tokenA}`
    });
    const usageData = aiUsage.data.data || aiUsage.data;
    assert(aiUsage.status === 200 && typeof usageData.remaining === 'number', `Flash AI usage meter responsive (limit: ${usageData.limit})`);

    const aiDisclosure = await request('GET', '/api/ai/disclosure', null, {
      Authorization: `Bearer ${tokenA}`
    });
    assert(aiDisclosure.status === 200 && aiDisclosure.data.provider === 'Google Gemini', `Flash AI provider disclosure conforms to guidelines`);

    const aiRewrite = await request('POST', '/api/ai/chat/rewrite', {
      text: 'can you review this code quickly please',
      tone: 'friendly'
    }, { Authorization: `Bearer ${tokenA}` });
    const rewriteData = aiRewrite.data.data || aiRewrite.data;
    assert(aiRewrite.status === 200 && (!!rewriteData.rewritten || !!rewriteData.text), `Flash AI rewrite endpoint generated styled text`);

    // -------------------------------------------------------------
    // SECTION 6: Zero-Knowledge Pocket Vault
    // -------------------------------------------------------------
    console.log('\n[6] Zero-Knowledge Pocket Vault (CRUD & Metadata)');
    const pocketItem = await request('POST', '/api/pocket/items', {
      type: 'note',
      title: 'Self-Test Secure Note',
      content: 'Encrypted payload ciphertext representation',
      isEncrypted: false,
      tags: ['test', 'automated']
    }, { Authorization: `Bearer ${tokenA}` });

    assert(pocketItem.status === 201, `Created new Pocket item in personal vault (HTTP 201)`);
    const pocketItemId = pocketItem.data.item?._id || pocketItem.data.item?.id;

    const pocketList = await request('GET', '/api/pocket/items', null, {
      Authorization: `Bearer ${tokenA}`
    });
    assert(pocketList.status === 200 && (pocketList.data.items || pocketList.data).length > 0, `Pocket vault items list retrieved`);

    // Clean up Pocket item
    if (pocketItemId) {
      await request('DELETE', `/api/pocket/items/${pocketItemId}`, null, {
        Authorization: `Bearer ${tokenA}`
      });
    }

    // -------------------------------------------------------------
    // SECTION 7: Contacts System
    // -------------------------------------------------------------
    console.log('\n[7] Contacts Directory & Auto-Link');
    const addContact = await request('POST', '/api/contacts', {
      name: 'Bob Work',
      phone: '+15551002002',
      email: testUserB.email,
      notes: 'Colleague on Flash Chat'
    }, { Authorization: `Bearer ${tokenA}` });

    assert(addContact.status === 201, `Added Bob to Alice contacts book`);
    const contactList = await request('GET', '/api/contacts', null, {
      Authorization: `Bearer ${tokenA}`
    });
    assert(contactList.status === 200 && (contactList.data.contacts || contactList.data).length > 0, `Retrieved Alice contacts directory`);

    // -------------------------------------------------------------
    // SECTION 8: Support Desk & Tickets
    // -------------------------------------------------------------
    console.log('\n[8] Help & Customer Support Desk');
    const supportFaqs = await request('GET', '/api/support/faq', null, {
      Authorization: `Bearer ${tokenA}`
    });
    assert(supportFaqs.status === 200 && Array.isArray(supportFaqs.data.faqs || supportFaqs.data), `Fetched public Support FAQs`);

    const createTicket = await request('POST', '/api/support/tickets', {
      subject: 'Self-Test Support Inquiry',
      category: 'account',
      message: 'Testing support desk ticketing automation.'
    }, { Authorization: `Bearer ${tokenA}` });

    assert(createTicket.status === 201, `Created support ticket for Alice (HTTP 201)`);
    const myTickets = await request('GET', '/api/support/tickets', null, {
      Authorization: `Bearer ${tokenA}`
    });
    assert(myTickets.status === 200 && (myTickets.data.tickets || myTickets.data).length > 0, `Fetched user support tickets`);

    // -------------------------------------------------------------
    // SECTION 9: Social Feeds & Discovery
    // -------------------------------------------------------------
    console.log('\n[9] Social Feeds & Discovery');
    const exploreFeed = await request('GET', '/api/explore', null, {
      Authorization: `Bearer ${tokenA}`
    });
    assert(exploreFeed.status === 200, `Fetched social explore feed`);

    // -------------------------------------------------------------
    // SECTION 10: Teardown & Connection Cleanup
    // -------------------------------------------------------------
    console.log('\n[10] Teardown & Connection Cleanup');
    if (socketA) {
      socketA.disconnect();
      assert(!socketA.connected, `Socket connection gracefully disconnected`);
    }

  } catch (err) {
    console.error('\n❌ Fatal error during live self-test execution:', err);
    failed++;
  }

  console.log('\n========================================================================');
  console.log(`📊 LIVE SELF-TEST SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('========================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runFullSelfTest();
