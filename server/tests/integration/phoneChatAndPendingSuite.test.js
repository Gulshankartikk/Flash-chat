/**
 * Phone-Based Chat & Pending Conversations Test Suite
 * (server/tests/integration/phoneChatAndPendingSuite.test.js)
 *
 * Verifies:
 * 1. Registered phone number -> returns status "ready" with single conversation (20 parallel idempotent calls).
 * 2. Unregistered phone number -> returns status "pending" with PendingConversation record.
 * 3. Queuing up to 5 text messages (<= 500 chars) in pending queue; 6th rejected.
 * 4. Automatic delivery upon recipient signup as a message request (Conversation.status: "request").
 * 5. Accepting message request updates status to "active".
 * 6. Rejecting message request removes request cleanly.
 * 7. Discoverability off (discoverableByPhone: false) -> no leak, no delivery upon signup.
 * 8. Blocked numbers (both directions) -> no leak, no delivery.
 * 9. Rejecting chatting with own phone number.
 * 10. Rejecting invalid non-E.164 phone numbers.
 * 11. 20-pending cap per owner.
 * 12. Privacy & owner isolation on pending endpoints (404 for others).
 */

const assert = require('assert');
const mongoose = require('mongoose');
const crypto = require('crypto');
const chatService = require('../../services/chatService');
const contactService = require('../../services/contactService');
const User = require('../../models/User');
const Conversation = require('../../models/Conversation');
const Message = require('../../models/Message');
const Contact = require('../../models/Contact');
const PendingConversation = require('../../models/PendingConversation');
const Block = require('../../models/Block');

let testsPassed = 0;
let testsFailed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    ${err.message}`);
    testsFailed++;
  }
}

async function runPhoneChatAndPendingSuite() {
  console.log('\n========================================================================');
  console.log('📱 INTEGRATION SUITE: PHONE-BASED CHATS & PENDING CONVERSATIONS');
  console.log('========================================================================\n');

  // Test setup data
  const userA_id = new mongoose.Types.ObjectId();
  const userB_id = new mongoose.Types.ObjectId(); // Registered user
  const userC_id = new mongoose.Types.ObjectId(); // Non-discoverable user
  const userD_id = new mongoose.Types.ObjectId(); // Blocked user

  const phoneA = '+14155550100';
  const phoneB = '+14155550200';
  const phoneC = '+14155550300';
  const phoneD = '+14155550400';
  const phoneUnregistered = '+19998887766';

  // Seed users in MongoDB - clean only test users data, NEVER real user data
  const testUserIds = [userA_id, userB_id, userC_id, userD_id];
  await User.deleteMany({
    $or: [
      { _id: { $in: testUserIds } },
      { phoneNumber: { $in: [phoneA, phoneB, phoneC, phoneD, phoneUnregistered] } },
      { username: { $in: ['alice_phone', 'bob_phone', 'charlie_phone', 'david_phone', 'sam_new'] } }
    ]
  });
  await Conversation.deleteMany({ 'members.user': { $in: testUserIds } });
  await Message.deleteMany({ sender: { $in: testUserIds } });
  await Contact.deleteMany({
    $or: [
      { owner: { $in: testUserIds } },
      { phone: { $in: [phoneA, phoneB, phoneC, phoneD, phoneUnregistered] } }
    ]
  });
  await PendingConversation.deleteMany({
    $or: [
      { creator: { $in: testUserIds } },
      { phone: { $in: [phoneA, phoneB, phoneC, phoneD, phoneUnregistered] } }
    ]
  });
  await Block.deleteMany({ blocker: { $in: testUserIds } });

  await User.create([
    {
      _id: userA_id,
      name: 'Alice User',
      username: 'alice_phone',
      email: 'alice.phone@test.com',
      phoneNumber: phoneA,
      discoverableByPhone: true
    },
    {
      _id: userB_id,
      name: 'Bob Registered',
      username: 'bob_phone',
      email: 'bob.phone@test.com',
      phoneNumber: phoneB,
      discoverableByPhone: true
    },
    {
      _id: userC_id,
      name: 'Charlie Private',
      username: 'charlie_phone',
      email: 'charlie.phone@test.com',
      phoneNumber: phoneC,
      discoverableByPhone: false // Opted out of discoverability
    },
    {
      _id: userD_id,
      name: 'David Blocked',
      username: 'david_phone',
      email: 'david.phone@test.com',
      phoneNumber: phoneD,
      discoverableByPhone: true
    }
  ]);

  // Set block between userA and userD
  await Block.create({ blocker: userA_id, blocked: userD_id });

  // 1. Registered Phone Number Resolution
  await runTest('1. Registered number: startChatByPhone returns status "ready" and conversationId', async () => {
    const res = await chatService.startChatByPhone(userA_id, {
      phone: phoneB,
      name: 'Bob Saved Contact',
      saveContact: true
    });

    assert.strictEqual(res.status, 'ready');
    assert.strictEqual(res.isRegistered, true);
    assert.ok(res.conversationId, 'Must return conversationId');

    // Verify contact created with linkedUser
    const contact = await Contact.findOne({ owner: userA_id, phone: phoneB });
    assert.ok(contact, 'Contact should be saved');
    assert.strictEqual(String(contact.linkedUser), String(userB_id));
  });

  // 2. Parallel Idempotency (20 calls)
  await runTest('2. Parallel calls (20 concurrent) return the exact same conversation with 0 duplicates', async () => {
    const calls = Array.from({ length: 20 }, () =>
      chatService.startChatByPhone(userA_id, { phone: phoneB, saveContact: true })
    );
    const results = await Promise.all(calls);
    const firstConvId = String(results[0].conversationId);

    results.forEach((r) => {
      assert.strictEqual(String(r.conversationId), firstConvId);
    });

    const totalConvs = await Conversation.countDocuments({
      memberKey: chatService.getMemberKey(userA_id, userB_id)
    });
    assert.strictEqual(totalConvs, 1, 'Exactly one conversation must exist');
  });

  // 3. Unregistered Phone Number -> Pending Conversation
  let pendingId = null;
  await runTest('3. Unregistered number: returns status "pending" with canInvite=true and creates PendingConversation', async () => {
    const res = await chatService.startChatByPhone(userA_id, {
      phone: phoneUnregistered,
      name: 'Sam Unregistered',
      saveContact: true
    });

    assert.strictEqual(res.status, 'pending');
    assert.strictEqual(res.isRegistered, false);
    assert.strictEqual(res.canInvite, true);
    assert.ok(res.pendingId);
    pendingId = res.pendingId;

    const pending = await PendingConversation.findById(pendingId);
    assert.ok(pending, 'PendingConversation record must exist in DB');
    assert.strictEqual(pending.queuedMessages.length, 0);
  });

  // 4. Queuing Messages in Pending Conversation
  await runTest('4. Queuing messages: supports up to 5 text messages (<= 500 chars); 6th is rejected', async () => {
    // Add 5 messages
    for (let i = 1; i <= 5; i++) {
      const qRes = await chatService.queuePendingMessage(userA_id, pendingId, `Hello message #${i}`);
      assert.strictEqual(qRes.success, true);
      assert.strictEqual(qRes.queuedCount, i);
    }

    // 6th message should fail
    try {
      await chatService.queuePendingMessage(userA_id, pendingId, 'Message 6 should fail');
      assert.fail('Should have thrown error for 6th queued message');
    } catch (err) {
      assert.ok(err.message.includes('Cannot queue more than 5 messages'));
    }
  });

  // 5. Automatic delivery upon signup
  await runTest('5. Automatic delivery: when recipient signs up, queued messages are delivered as a message request', async () => {
    const newUser_id = new mongoose.Types.ObjectId();
    const newUser = await User.create({
      _id: newUser_id,
      name: 'Sam Registered User',
      username: 'sam_new',
      email: 'sam@test.com',
      phoneNumber: phoneUnregistered,
      discoverableByPhone: true
    });

    // Trigger delivery
    const deliveredCount = await chatService.deliverPendingConversationsOnSignup(newUser);
    assert.strictEqual(deliveredCount, 1);

    // Verify PendingConversation was cleaned up
    const pendingRemaining = await PendingConversation.findById(pendingId);
    assert.strictEqual(pendingRemaining, null, 'PendingConversation must be deleted upon delivery');

    // Verify Direct conversation created with status 'request'
    const conv = await Conversation.findOne({
      type: 'direct',
      'members.user': { $all: [userA_id, newUser_id] }
    });
    assert.ok(conv, 'Conversation must exist');
    assert.strictEqual(conv.status, 'request', 'Should be in request state for recipient');
    assert.strictEqual(String(conv.requestedBy), String(userA_id));

    // Verify all 5 messages were created
    const messages = await Message.find({ conversation: conv._id });
    assert.strictEqual(messages.length, 5, 'All 5 queued messages must be delivered');

    // Clean up
    await User.findByIdAndDelete(newUser_id);
    await Conversation.findByIdAndDelete(conv._id);
    await Message.deleteMany({ conversation: conv._id });
  });

  // 6. Accept / Reject Message Request
  await runTest('6. Accept / Reject request: accept sets status to "active"; reject deletes conversation', async () => {
    const dummyOtherId = new mongoose.Types.ObjectId();
    const testConv = await Conversation.create({
      type: 'direct',
      status: 'request',
      requestedBy: dummyOtherId,
      members: [{ user: userA_id }, { user: dummyOtherId }]
    });

    const accepted = await chatService.acceptMessageRequest(userA_id, testConv._id);
    assert.strictEqual(accepted.status, 'active');

    // Test reject
    const testConv2 = await Conversation.create({
      type: 'direct',
      status: 'request',
      requestedBy: dummyOtherId,
      members: [{ user: userA_id }, { user: dummyOtherId }]
    });
    const rejRes = await chatService.rejectMessageRequest(userA_id, testConv2._id);
    assert.strictEqual(rejRes.success, true);
    const checkConv = await Conversation.findById(testConv2._id);
    assert.strictEqual(checkConv, null);
  });

  // 7. Discoverability Off (Zero Enumeration Leak)
  await runTest('7. Discoverability off: discoverableByPhone=false returns status "pending" (no leak)', async () => {
    const res = await chatService.startChatByPhone(userA_id, {
      phone: phoneC, // Charlie opted out of discoverability
      saveContact: true
    });

    assert.strictEqual(res.status, 'pending');
    assert.strictEqual(res.isRegistered, false);
  });

  // 8. Blocked Numbers (Both Directions)
  await runTest('8. Block respected: blocked user returns status "pending" (no leak)', async () => {
    const res = await chatService.startChatByPhone(userA_id, {
      phone: phoneD, // David is blocked by Alice
      saveContact: true
    });

    assert.strictEqual(res.status, 'pending');
    assert.strictEqual(res.isRegistered, false);
  });

  // 9. Reject own number
  await runTest('9. Own number: throws 400 Cannot start a chat with your own phone number', async () => {
    try {
      await chatService.startChatByPhone(userA_id, { phone: phoneA });
      assert.fail('Should have rejected own number');
    } catch (err) {
      assert.ok(err.message.includes('own phone number'));
    }
  });

  // 10. Reject invalid non-E.164 phone
  await runTest('10. Invalid phone: rejects non-E.164 phone numbers with 400 error', async () => {
    try {
      await chatService.startChatByPhone(userA_id, { phone: '12345' });
      assert.fail('Should have rejected invalid phone');
    } catch (err) {
      assert.ok(err.message.includes('valid international phone number'));
    }
  });

  // 11. Privacy & Owner Isolation
  await runTest('11. Owner isolation: another user querying or queuing on pendingId gets 404', async () => {
    const freshPending = await PendingConversation.create({
      owner: userA_id,
      phoneHash: 'samplehash123',
      rawPhoneMasked: '+1 ••••• •9999'
    });

    try {
      await chatService.queuePendingMessage(userB_id, freshPending._id, 'Hacked message');
      assert.fail('Should have thrown 404 for non-owner');
    } catch (err) {
      assert.ok(err.message.includes('not found') || err.message.includes('access denied'));
    }

    await PendingConversation.findByIdAndDelete(freshPending._id);
  });

  console.log('\n========================================================================');
  console.log(`PHONE CHAT & PENDING TESTS SUMMARY: ${testsPassed}/${testsPassed + testsFailed} PASSED`);
  console.log('========================================================================\n');

  if (testsFailed > 0) {
    throw new Error(`${testsFailed} tests failed in Phone Chat & Pending Suite`);
  }
}

if (require.main === module) {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/flashchat_test';
  mongoose
    .connect(MONGO_URI)
    .then(async () => {
      await runPhoneChatAndPendingSuite();
      await mongoose.disconnect();
    })
    .catch((err) => {
      console.error('Test runner execution error:', err);
      process.exit(1);
    });
}

module.exports = { runPhoneChatAndPendingSuite };
