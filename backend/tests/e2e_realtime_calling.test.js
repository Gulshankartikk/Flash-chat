const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { io: ioClient } = require("../../frontend/node_modules/socket.io-client");
const http = require("http");

// Target local running server on port 8000
const BACKEND_URL = "http://localhost:8000";

describe("🚀 Flash Chat Full End-to-End Realtime & WebRTC Calling Verification Suite", () => {
  let socketA;
  let socketB;
  let userA;
  let userB;

  let tokenA;
  let tokenB;

  before(async () => {
    // 1. Authenticate / register User A (Gulshan)
    const resA = await fetch(`${BACKEND_URL}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "gulshan.test@flashchat.local", name: "Gulshan Test" }),
    });
    const dataA = await resA.json();
    userA = dataA.data?.user || dataA.data || dataA.user;
    tokenA = dataA.data?.token || dataA.token;
    assert.ok(userA?._id, "User A must have an _id");
    assert.ok(tokenA, "User A must receive an auth token");

    // 2. Authenticate / register User B (Kartik)
    const resB = await fetch(`${BACKEND_URL}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "kartik.test@flashchat.local", name: "Kartik Test" }),
    });
    const dataB = await resB.json();
    userB = dataB.data?.user || dataB.data || dataB.user;
    tokenB = dataB.data?.token || dataB.token;
    assert.ok(userB?._id, "User B must have an _id");
    assert.ok(tokenB, "User B must receive an auth token");

    // 3. Connect Socket A
    socketA = ioClient(BACKEND_URL, {
      transports: ["websocket"],
      reconnection: false,
    });
    await new Promise((resolve) => socketA.on("connect", resolve));
    socketA.emit("user_connected", userA._id);

    // 4. Connect Socket B
    socketB = ioClient(BACKEND_URL, {
      transports: ["websocket"],
      reconnection: false,
    });
    await new Promise((resolve) => socketB.on("connect", resolve));
    socketB.emit("user_connected", userB._id);

    // Give server a moment to register both sockets
    await new Promise((r) => setTimeout(r, 200));
  });

  after(() => {
    socketA?.disconnect();
    socketB?.disconnect();
  });

  it("1. PRESENCE: Users announce presence and receive status updates", async () => {
    const presencePromise = new Promise((resolve) => {
      socketB.on("user_status", (data) => {
        if (String(data.userId) === String(userA._id)) {
          resolve(data);
        }
      });
    });
    // Trigger presence update from A
    socketA.emit("user_connected", userA._id);
    const presence = await presencePromise;
    assert.strictEqual(presence.isOnline, true, "User A should report online status");
  });

  it("2. TYPING INDICATOR: User A starts typing -> User B receives event; User A stops -> User B receives stop", async () => {
    const typingStartPromise = new Promise((resolve) => {
      socketB.on("user_typing", (data) => {
        if (data.isTyping) resolve(data);
      });
    });

    socketA.emit("typing_start", {
      conversationId: `conv_${userA._id}_${userB._id}`,
      receiverId: userB._id,
    });

    const startData = await typingStartPromise;
    assert.strictEqual(startData.isTyping, true);
    assert.strictEqual(String(startData.userId), String(userA._id));

    const typingStopPromise = new Promise((resolve) => {
      socketB.on("user_typing", (data) => {
        if (!data.isTyping) resolve(data);
      });
    });

    socketA.emit("typing_stop", {
      conversationId: `conv_${userA._id}_${userB._id}`,
      receiverId: userB._id,
    });

    const stopData = await typingStopPromise;
    assert.strictEqual(stopData.isTyping, false);
  });

  it("3. REALTIME TEXT CHAT: User A sends message -> User B receives it instantly with timestamp and status", async () => {
    const testMessageText = `Hello Kartik! Realtime text test at ${Date.now()}`;

    const receivePromise = new Promise((resolve) => {
      socketB.once("receive_message", (msg) => {
        resolve(msg);
      });
    });

    // Send via REST API (authoritative persistence & socket broadcast)
    const sendRes = await fetch(`${BACKEND_URL}/api/chat/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        senderId: userA._id,
        receiverId: userB._id,
        content: testMessageText,
        contentType: "text",
      }),
    });
    const sendData = await sendRes.json();
    assert.strictEqual(sendRes.status, 200, "Send message must return 200 OK");

    const receivedMsg = await receivePromise;
    assert.strictEqual(receivedMsg.content, testMessageText, "Received message content must match");
    assert.ok(receivedMsg.createdAt, "Message must have a timestamp");
    assert.ok(receivedMsg._id, "Message must have an _id");
  });

  it("4. READ RECEIPT: User B marks message read -> User A receives message_status_update", async () => {
    // Send a message first
    const sendRes = await fetch(`${BACKEND_URL}/api/chat/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        senderId: userA._id,
        receiverId: userB._id,
        content: "Receipt test message",
        contentType: "text",
      }),
    });
    const sendData = await sendRes.json();
    const messageId = sendData.data?._id || sendData.data?.message?._id;

    const receiptPromise = new Promise((resolve) => {
      socketA.on("message_status_update", (data) => {
        if (String(data.messageId) === String(messageId) && data.messageStatus === "read") {
          resolve(data);
        }
      });
    });

    socketB.emit("message_read", {
      messageIds: [messageId],
      senderId: userA._id,
    });

    const receipt = await receiptPromise;
    assert.strictEqual(receipt.messageStatus, "read");
  });

  it("5. WEBRTC SIGNALING (CALL_USER & INCOMING_CALL): User A initiates video call -> User B receives incoming_call", async () => {
    const mockOffer = { type: "offer", sdp: "v=0\r\no=gulshan 12345 67890 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n" };
    const roomId = `room_test_${Date.now()}`;

    const incomingCallPromise = new Promise((resolve) => {
      socketB.once("incoming_call", (data) => {
        resolve(data);
      });
    });

    socketA.emit("call_user", {
      to: userB._id,
      from: userA._id,
      roomId,
      offer: mockOffer,
      callType: "video",
      callerName: "Gulshan Test",
      callerAvatar: "https://example.com/avatar.jpg",
    });

    const callData = await incomingCallPromise;
    assert.strictEqual(String(callData.from), String(userA._id));
    assert.strictEqual(callData.callType, "video");
    assert.strictEqual(callData.offer.type, "offer");
  });

  it("6. WEBRTC SIGNALING (ACCEPT_CALL & CALL_ACCEPTED): User B accepts call -> User A receives answer", async () => {
    const mockAnswer = { type: "answer", sdp: "v=0\r\no=kartik 54321 09876 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n" };

    const callAcceptedPromise = new Promise((resolve) => {
      socketA.once("call_accepted", (data) => {
        resolve(data);
      });
    });

    socketB.emit("accept_call", {
      to: userA._id,
      answer: mockAnswer,
    });

    const acceptedData = await callAcceptedPromise;
    assert.strictEqual(acceptedData.answer.type, "answer");
  });

  it("7. ICE CANDIDATE EXCHANGE: User A and User B exchange candidates", async () => {
    const candidatePromise = new Promise((resolve) => {
      socketB.once("ice_candidate", (data) => {
        resolve(data);
      });
    });

    const mockCandidate = { candidate: "candidate:1 1 UDP 2130706431 192.168.1.1 50000 typ host", sdpMid: "0", sdpMLineIndex: 0 };
    socketA.emit("ice_candidate", {
      to: userB._id,
      candidate: mockCandidate,
    });

    const receivedCandidate = await candidatePromise;
    assert.strictEqual(receivedCandidate.candidate.sdpMid, "0");
  });

  it("8. MEDIA STATE TOGGLE: User A mutes mic / turns off camera -> User B receives media_state_changed", async () => {
    const micTogglePromise = new Promise((resolve) => {
      socketB.once("media_state_changed", (data) => {
        resolve(data);
      });
    });

    socketA.emit("media_state_changed", {
      to: userB._id,
      type: "audio",
      enabled: false,
    });

    const micData = await micTogglePromise;
    assert.strictEqual(micData.type, "audio");
    assert.strictEqual(micData.enabled, false, "Microphone should be reported disabled");

    const camTogglePromise = new Promise((resolve) => {
      socketB.once("media_state_changed", (data) => {
        resolve(data);
      });
    });

    socketA.emit("media_state_changed", {
      to: userB._id,
      type: "video",
      enabled: false,
    });

    const camData = await camTogglePromise;
    assert.strictEqual(camData.type, "video");
    assert.strictEqual(camData.enabled, false, "Camera should be reported disabled");
  });

  it("9. CALL CLEANUP: Either user ends call -> other receives call_ended and call state resets", async () => {
    const callEndedPromise = new Promise((resolve) => {
      socketA.once("call_ended", (data) => {
        resolve(data);
      });
    });

    socketB.emit("end_call", { to: userA._id });

    const endData = await callEndedPromise;
    assert.ok(endData, "User A must receive call_ended event");
  });

  it("10. CALL SAFETY (BUSY CHECK): Calling a user already on a call returns call_user_busy", async () => {
    // Put User B into an active call with User A
    socketA.emit("call_user", {
      to: userB._id,
      from: userA._id,
      roomId: "room_busy_test",
      offer: { type: "offer", sdp: "dummy" },
      callType: "audio",
      callerName: "Gulshan",
    });

    // Create a 3rd user (Gullu)
    const resC = await fetch(`${BACKEND_URL}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "gullu.test@flashchat.local", name: "Gullu Test" }),
    });
    const dataC = await resC.json();
    const userC = dataC.data?.user || dataC.data;

    const socketC = ioClient(BACKEND_URL, { transports: ["websocket"] });
    await new Promise((r) => socketC.on("connect", r));
    socketC.emit("user_connected", userC._id);

    const busyPromise = new Promise((resolve) => {
      socketC.once("call_user_busy", (data) => {
        resolve(data);
      });
    });

    // Gullu calls Kartik who is already in a call
    socketC.emit("call_user", {
      to: userB._id,
      from: userC._id,
      roomId: "room_gullu",
      offer: { type: "offer", sdp: "dummy" },
      callType: "audio",
      callerName: "Gullu",
    });

    const busyData = await busyPromise;
    assert.strictEqual(String(busyData.to), String(userB._id));
    assert.ok(busyData.message.includes("busy"), "Must return busy message");

    // Cleanup
    socketA.emit("end_call", { to: userB._id });
    socketC.disconnect();
  });

  it("11. CALL SAFETY (OFFLINE CHECK): Calling an offline user returns call_user_offline", async () => {
    const offlinePromise = new Promise((resolve) => {
      socketA.once("call_user_offline", (data) => {
        resolve(data);
      });
    });

    const fakeOfflineId = "609c12345678901234567890";
    socketA.emit("call_user", {
      to: fakeOfflineId,
      from: userA._id,
      roomId: "room_offline_test",
      offer: { type: "offer", sdp: "dummy" },
      callType: "video",
      callerName: "Gulshan",
    });

    const offlineData = await offlinePromise;
    assert.strictEqual(String(offlineData.to), String(fakeOfflineId));
    assert.ok(offlineData.message.includes("offline"));
  });

  it("12. CALL CANCELLATION: Caller cancels before answer -> receiver receives call_cancelled", async () => {
    const cancelPromise = new Promise((resolve) => {
      socketB.once("call_cancelled", (data) => {
        resolve(data);
      });
    });

    socketA.emit("call_user", {
      to: userB._id,
      from: userA._id,
      roomId: "room_cancel_test",
      offer: { type: "offer", sdp: "dummy" },
      callType: "video",
      callerName: "Gulshan",
    });

    // Caller cancels immediately
    socketA.emit("cancel_call", { to: userB._id });

    const cancelData = await cancelPromise;
    assert.strictEqual(String(cancelData.from), String(userA._id));
  });

  it("13. LOCAL MEDIA STORAGE: Upload file fallback saves to local storage and returns URL", async () => {
    const formData = new FormData();
    const blob = new Blob(["Hello Flash Chat File Content"], { type: "text/plain" });
    formData.append("file", blob, "test_doc.txt");
    formData.append("senderId", userA._id);
    formData.append("receiverId", userB._id);
    formData.append("messageType", "document");

    const res = await fetch(`${BACKEND_URL}/api/chat/send-message`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenA}`,
      },
      body: formData,
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200, "Media upload must return 200");
    const msg = data.data || data;
    assert.ok(msg.imageOrVideoUrl, "Uploaded message must have imageOrVideoUrl");
    assert.ok(msg.imageOrVideoUrl.includes("/upload/"), "Must point to /upload/ path");
  });
});
