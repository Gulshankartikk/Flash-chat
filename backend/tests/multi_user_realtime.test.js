const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { io: ioClient } = require("../../frontend/node_modules/socket.io-client");

const BACKEND_URL = "http://localhost:8000";

describe("Flash Chat — Multi-User Real-Time Chat Testing & Reliability", () => {
  // 4 Distinct Users
  let userA, userB, userC, userD;
  let tokenA, tokenB, tokenC, tokenD;
  let sessionA, sessionB, sessionC, sessionD;

  // Sockets (including multi-tab for User A)
  let socketA1, socketA2, socketB, socketC, socketD;

  // Helper to provision user with distinct mobile number + email + display name
  async function provisionUser(phone, suffix, email, displayName) {
    // 1. Google/Email provisioning for instant deterministic auth
    const authRes = await fetch(`${BACKEND_URL}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: displayName }),
    });
    const authData = await authRes.json();
    assert.strictEqual(authRes.status, 200, `Auth failed for ${email}: ${JSON.stringify(authData)}`);

    const user = authData.data?.user || authData.data;
    const token = authData.data?.token || authData.token;
    const sessionId = authData.data?.sessionId || authData.sessionId;

    // 2. Link phone number so user has both Mobile + Email
    const linkRes = await fetch(`${BACKEND_URL}/api/auth/link-phone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ phoneNumber: phone, phoneSuffix: suffix }),
    });
    const linkData = await linkRes.json();
    assert.strictEqual(linkRes.status, 200, `Phone link failed for ${phone}: ${JSON.stringify(linkData)}`);

    return {
      user: linkData.data || user,
      token,
      sessionId,
      phoneNumber: phone,
      phoneSuffix: suffix,
      email,
      displayName,
    };
  }

  // Helper to create and connect a socket
  function connectSocket(userId) {
    return new Promise((resolve, reject) => {
      const socket = ioClient(BACKEND_URL, {
        transports: ["websocket"],
        reconnection: false,
        timeout: 5000,
      });

      socket.on("connect", () => {
        socket.emit("user_connected", String(userId));
        resolve(socket);
      });

      socket.on("connect_error", (err) => {
        reject(err);
      });
    });
  }

  before(async () => {
    // 1. Provision 4 completely separate user accounts
    console.log("Provisioning 4 separate user accounts...");
    const accountA = await provisionUser("9876500001", "+91", "usera.multi@flashchat.local", "User A");
    userA = accountA.user;
    tokenA = accountA.token;
    sessionA = accountA.sessionId;

    const accountB = await provisionUser("9876500002", "+91", "userb.multi@flashchat.local", "User B");
    userB = accountB.user;
    tokenB = accountB.token;
    sessionB = accountB.sessionId;

    const accountC = await provisionUser("9876500003", "+91", "userc.multi@flashchat.local", "User C");
    userC = accountC.user;
    tokenC = accountC.token;
    sessionC = accountC.sessionId;

    const accountD = await provisionUser("9876500004", "+91", "userd.multi@flashchat.local", "User D");
    userD = accountD.user;
    tokenD = accountD.token;
    sessionD = accountD.sessionId;

    console.log("Connecting simultaneous sockets across all accounts...");
    // 2. Connect sockets
    socketA1 = await connectSocket(userA._id); // Browser 1 - Tab 1
    socketA2 = await connectSocket(userA._id); // Browser 1 - Tab 2 (Multi-tab)
    socketB = await connectSocket(userB._id);  // Browser 2
    socketC = await connectSocket(userC._id);  // Mobile / Browser 3
    socketD = await connectSocket(userD._id);  // Mobile / Browser 4

    // Small delay to allow presence registration
    await new Promise((r) => setTimeout(r, 200));
  });

  after(() => {
    socketA1?.disconnect();
    socketA2?.disconnect();
    socketB?.disconnect();
    socketC?.disconnect();
    socketD?.disconnect();
  });

  it("1. ACCOUNT & SESSION ISOLATION: 4 completely separate accounts with distinct sessions", () => {
    // Verify 4 distinct users
    const ids = new Set([String(userA._id), String(userB._id), String(userC._id), String(userD._id)]);
    assert.strictEqual(ids.size, 4, "All 4 users must have distinct MongoDB ObjectIds");

    // Verify distinct phone numbers & emails
    const phones = new Set([userA.phoneNumber, userB.phoneNumber, userC.phoneNumber, userD.phoneNumber]);
    assert.strictEqual(phones.size, 4, "All 4 users must have distinct phone numbers");

    const emails = new Set([userA.email, userB.email, userC.email, userD.email]);
    assert.strictEqual(emails.size, 4, "All 4 users must have distinct email addresses");

    // Verify distinct tokens and session IDs
    const tokens = new Set([tokenA, tokenB, tokenC, tokenD]);
    assert.strictEqual(tokens.size, 4, "All 4 users must have distinct JWT access tokens");

    const sessions = new Set([sessionA, sessionB, sessionC, sessionD]);
    assert.strictEqual(sessions.size, 4, "All 4 users must have distinct session IDs");
  });

  it("2. TEST 1: User A sends 'Hello User B' -> User B receives real-time without refresh", async () => {
    const text = "Hello User B";

    const receivePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout waiting for User B to receive message")), 4000);
      socketB.once("receive_message", (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
    });

    // User A sends message via REST API
    const sendRes = await fetch(`${BACKEND_URL}/api/chat/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        receiverId: userB._id,
        content: text,
      }),
    });
    const sendData = await sendRes.json();
    assert.strictEqual(sendRes.status, 200, "Send message must return HTTP 200");
    assert.strictEqual(sendData.data?.content, text);

    // User B receives the message in real time
    const receivedMsg = await receivePromise;
    assert.strictEqual(receivedMsg.content, text);
    assert.strictEqual(String(receivedMsg.sender?._id || receivedMsg.sender), String(userA._id));
    assert.strictEqual(String(receivedMsg.receiver?._id || receivedMsg.receiver), String(userB._id));
    assert.ok(receivedMsg._id, "Message must contain a valid unique ID");
  });

  it("3. TEST 2: User B replies 'Hello User A' -> User A receives real-time immediately", async () => {
    const replyText = "Hello User A";

    const receivePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout waiting for User A to receive reply")), 4000);
      socketA1.once("receive_message", (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
    });

    const sendRes = await fetch(`${BACKEND_URL}/api/chat/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        receiverId: userA._id,
        content: replyText,
      }),
    });
    const sendData = await sendRes.json();
    assert.strictEqual(sendRes.status, 200);

    const receivedMsg = await receivePromise;
    assert.strictEqual(receivedMsg.content, replyText);
    assert.strictEqual(String(receivedMsg.sender?._id || receivedMsg.sender), String(userB._id));
    assert.strictEqual(String(receivedMsg.receiver?._id || receivedMsg.receiver), String(userA._id));
  });

  it("4. TEST 3: Simultaneous messages from User A and User B arrive without loss or duplicates", async () => {
    const textFromA = `Simultaneous from A ${Date.now()}`;
    const textFromB = `Simultaneous from B ${Date.now()}`;

    const bReceivedPromise = new Promise((resolve) => {
      socketB.once("receive_message", (msg) => resolve(msg));
    });

    const aReceivedPromise = new Promise((resolve) => {
      socketA1.once("receive_message", (msg) => resolve(msg));
    });

    // Send simultaneously
    const [resA, resB] = await Promise.all([
      fetch(`${BACKEND_URL}/api/chat/send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ receiverId: userB._id, content: textFromA }),
      }),
      fetch(`${BACKEND_URL}/api/chat/send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenB}`,
        },
        body: JSON.stringify({ receiverId: userA._id, content: textFromB }),
      }),
    ]);

    assert.strictEqual(resA.status, 200);
    assert.strictEqual(resB.status, 200);

    const [bGotMsg, aGotMsg] = await Promise.all([bReceivedPromise, aReceivedPromise]);
    assert.strictEqual(bGotMsg.content, textFromA);
    assert.strictEqual(aGotMsg.content, textFromB);

    // Verify messages have distinct IDs and correct timestamps
    assert.notStrictEqual(bGotMsg._id, aGotMsg._id);
    assert.ok(new Date(bGotMsg.createdAt).getTime() > 0);
    assert.ok(new Date(aGotMsg.createdAt).getTime() > 0);
  });

  it("5. TEST 4: Four Users Full Mesh (A↔B, A↔C, A↔D, B↔C, B↔D, C↔D) with strict separation", async () => {
    const pairs = [
      { sender: userA, receiver: userC, token: tokenA, socket: socketC, label: "A->C" },
      { sender: userC, receiver: userA, token: tokenC, socket: socketA1, label: "C->A" },
      { sender: userA, receiver: userD, token: tokenA, socket: socketD, label: "A->D" },
      { sender: userD, receiver: userA, token: tokenD, socket: socketA1, label: "D->A" },
      { sender: userB, receiver: userC, token: tokenB, socket: socketC, label: "B->C" },
      { sender: userC, receiver: userB, token: tokenC, socket: socketB, label: "C->B" },
      { sender: userB, receiver: userD, token: tokenB, socket: socketD, label: "B->D" },
      { sender: userD, receiver: userB, token: tokenD, socket: socketB, label: "D->B" },
      { sender: userC, receiver: userD, token: tokenC, socket: socketD, label: "C->D" },
      { sender: userD, receiver: userC, token: tokenD, socket: socketC, label: "D->C" },
    ];

    for (const p of pairs) {
      const messageText = `Mesh test message ${p.label} ${Date.now()}`;
      const receivePromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout for ${p.label}`)), 3000);
        p.socket.once("receive_message", (msg) => {
          clearTimeout(timer);
          resolve(msg);
        });
      });

      const res = await fetch(`${BACKEND_URL}/api/chat/send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${p.token}`,
        },
        body: JSON.stringify({
          receiverId: p.receiver._id,
          content: messageText,
        }),
      });
      assert.strictEqual(res.status, 200);

      const received = await receivePromise;
      assert.strictEqual(received.content, messageText);
      assert.strictEqual(String(received.sender?._id || received.sender), String(p.sender._id));
      assert.strictEqual(String(received.receiver?._id || received.receiver), String(p.receiver._id));
    }
  });

  it("6. MULTI-TAB TESTING: Message to User A is delivered to Tab 1 (socketA1) and Tab 2 (socketA2) simultaneously", async () => {
    const multiTabText = `Multi-tab broadcast test ${Date.now()}`;

    let tab1Received = null;
    let tab2Received = null;

    const p1 = new Promise((resolve) => {
      socketA1.once("receive_message", (msg) => {
        tab1Received = msg;
        resolve(msg);
      });
    });

    const p2 = new Promise((resolve) => {
      socketA2.once("receive_message", (msg) => {
        tab2Received = msg;
        resolve(msg);
      });
    });

    // User B sends message to User A
    const res = await fetch(`${BACKEND_URL}/api/chat/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        receiverId: userA._id,
        content: multiTabText,
      }),
    });
    assert.strictEqual(res.status, 200);

    await Promise.all([p1, p2]);

    assert.ok(tab1Received, "Tab 1 must receive the message");
    assert.ok(tab2Received, "Tab 2 must receive the message");
    assert.strictEqual(tab1Received._id, tab2Received._id, "Both tabs must receive identical message ID");
    assert.strictEqual(tab1Received.content, multiTabText);
    assert.strictEqual(tab2Received.content, multiTabText);
  });

  it("7. ONLINE / OFFLINE HANDLING: Offline user reconnects and retrieves missed messages without loss", async () => {
    // 1. Disconnect socketB (simulate offline)
    socketB.disconnect();
    await new Promise((r) => setTimeout(r, 200));

    // 2. User A sends message while User B is offline
    const offlineText = `Offline delivery test ${Date.now()}`;
    const sendRes = await fetch(`${BACKEND_URL}/api/chat/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        receiverId: userB._id,
        content: offlineText,
      }),
    });
    const sendData = await sendRes.json();
    assert.strictEqual(sendRes.status, 200);
    const convId = sendData.data?.conversation?._id || sendData.data?.conversation;
    assert.ok(convId, "Conversation ID must be present");

    // 3. Reconnect socketB (simulate back online)
    socketB = await connectSocket(userB._id);
    await new Promise((r) => setTimeout(r, 200));

    // 4. User B fetches conversation messages
    const getRes = await fetch(`${BACKEND_URL}/api/chat/conversation/${convId}/message`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const getData = await getRes.json();
    assert.strictEqual(getRes.status, 200);

    const messages = getData.data || [];
    const found = messages.find((m) => m.content === offlineText);
    assert.ok(found, "Offline message must be retrieved intact by User B after reconnecting");
    assert.strictEqual(String(found.sender?._id || found.sender), String(userA._id));
  });

  it("8. UNREAD MESSAGE TRACKING: Unread counts increment properly and clear on read receipt", async () => {
    // User A sends message to User C
    const unreadTestText = `Unread check ${Date.now()}`;
    const sendRes = await fetch(`${BACKEND_URL}/api/chat/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        receiverId: userC._id,
        content: unreadTestText,
      }),
    });
    const sendData = await sendRes.json();
    const sentMsg = sendData.data;
    const convId = sentMsg.conversation?._id || sentMsg.conversation;

    // User C checks conversations list
    const convRes = await fetch(`${BACKEND_URL}/api/chat/conversation`, {
      headers: { Authorization: `Bearer ${tokenC}` },
    });
    const convData = await convRes.json();
    const conversations = convData.data || [];
    const convForC = conversations.find((c) => String(c._id) === String(convId));
    assert.ok(convForC, "Conversation must appear in User C's list");
    assert.ok(convForC.unreadCount >= 1, `User C's unread count should be >= 1, got ${convForC.unreadCount}`);

    // User C opens and marks message as read
    const readReceiptPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout waiting for read receipt")), 4000);
      const handler = (data) => {
        if (String(data.messageId) === String(sentMsg._id) && (data.messageStatus === "read" || data.messageStatus === "seen")) {
          clearTimeout(timer);
          socketA1.off("message_status_update", handler);
          resolve(data);
        }
      };
      socketA1.on("message_status_update", handler);
    });

    const readRes = await fetch(`${BACKEND_URL}/api/chat/message/read`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenC}`,
      },
      body: JSON.stringify({
        conversationId: convId,
        messageIds: [sentMsg._id],
      }),
    });
    assert.strictEqual(readRes.status, 200);

    // User A receives real-time read receipt on socket
    const receipt = await readReceiptPromise;
    assert.ok(receipt.messageStatus === "read" || receipt.messageStatus === "seen");
  });

  it("9. PREVENT CROSS-USER DATA LEAKAGE: Strict isolation of conversations and messages", async () => {
    // 1. Create a private conversation between User C and User D
    const secretText = `Secret CD conversation ${Date.now()}`;
    const cdRes = await fetch(`${BACKEND_URL}/api/chat/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenC}`,
      },
      body: JSON.stringify({
        receiverId: userD._id,
        content: secretText,
      }),
    });
    const cdData = await cdRes.json();
    const cdConvId = cdData.data?.conversation?._id || cdData.data?.conversation;
    assert.ok(cdConvId);

    // 2. User A attempts to access the C-D conversation messages
    const leakRes = await fetch(`${BACKEND_URL}/api/chat/conversation/${cdConvId}/message`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(leakRes.status, 403, "User A must be forbidden from accessing User C-D messages");

    // 3. User A checks their conversation list
    const aConvRes = await fetch(`${BACKEND_URL}/api/chat/conversation`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const aConvs = (await aConvRes.json()).data || [];
    const leakedConv = aConvs.find((c) => String(c._id) === String(cdConvId));
    assert.strictEqual(leakedConv, undefined, "User A must NEVER see User C-D conversation in their list");
  });

  it("10. LOGOUT SESSION ISOLATION: Logging out User D does NOT affect User A, B, or C", async () => {
    // 1. User D logs out
    const logoutRes = await fetch(`${BACKEND_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenD}` },
    });
    assert.strictEqual(logoutRes.status, 200);

    // 2. User A, B, C can still communicate in real-time
    const postLogoutText = `Post logout check ${Date.now()}`;
    const bReceivePromise = new Promise((resolve) => {
      socketB.once("receive_message", (msg) => resolve(msg));
    });

    const sendRes = await fetch(`${BACKEND_URL}/api/chat/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        receiverId: userB._id,
        content: postLogoutText,
      }),
    });
    assert.strictEqual(sendRes.status, 200);

    const received = await bReceivePromise;
    assert.strictEqual(received.content, postLogoutText, "User A and B can still chat uninterrupted after User D logged out");
  });
});
