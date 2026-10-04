/**
 * Flash Chat Backend Integration Test Suite
 * Contacts Management, Support Help Desk & Flash AI Branding
 */

const assert = require('assert');
const { SYSTEM_INJECTION_DEFENSE, PROMPT_TEMPLATES } = require('../../services/ai/prompts');
const { AI_PROVIDER_DISCLOSURE } = require('../../controllers/aiController');
const contactService = require('../../services/contactService');
const supportService = require('../../services/supportService');
const chatService = require('../../services/chatService');
const Contact = require('../../models/Contact');
const ContactInvite = require('../../models/ContactInvite');
const SupportTicket = require('../../models/SupportTicket');
const SupportFaq = require('../../models/SupportFaq');
const SupportCannedReply = require('../../models/SupportCannedReply');
const Conversation = require('../../models/Conversation');
const Message = require('../../models/Message');
const User = require('../../models/User');
const Block = require('../../models/Block');
const { generateMongoId, createUserFactory } = require('../helpers/factories');

async function runContactsSupportFlashAiTests() {
  console.log('\n\x1b[1m\x1b[36m===================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[36m🤝 INTEGRATION SUITE: CONTACTS, SUPPORT DESK & FLASH AI BRANDING\x1b[0m');
  console.log('\x1b[1m\x1b[36m===================================================================\x1b[0m\n');

  let passed = 0;
  let failed = 0;

  function recordPass(desc) {
    console.log(`  \x1b[32m✔\x1b[0m ${desc}`);
    passed++;
  }

  function recordFail(desc, err) {
    console.error(`  \x1b[31m✖\x1b[0m ${desc}`);
    console.error(`    \x1b[31mError: ${err.message}\x1b[0m`);
    failed++;
  }

  // ===========================================================================
  // SECTION 1: FLASH AI BRANDING & PERSONA DISCLOSURES
  // ===========================================================================
  console.log('\x1b[1m[1] Flash AI Persona, Branding & Disclosure Checks\x1b[0m');

  try {
    assert.ok(
      SYSTEM_INJECTION_DEFENSE.includes('You are Flash AI'),
      'Prompt defense persona must explicitly name Flash AI'
    );
    assert.ok(
      !SYSTEM_INJECTION_DEFENSE.includes('You are Gemini'),
      'Prompt defense persona must not refer to self as Gemini'
    );
    recordPass('Flash AI system persona is properly configured with injection defense');
  } catch (err) {
    recordFail('Flash AI system persona check failed', err);
  }

  try {
    assert.ok(typeof AI_PROVIDER_DISCLOSURE === 'string', 'Disclosure constant must exist');
    assert.ok(
      AI_PROVIDER_DISCLOSURE.includes('Flash AI is powered by Google Gemini'),
      'Disclosure must clearly state underlying engine'
    );
    recordPass('Honest Google Gemini provider disclosure constant is verified');
  } catch (err) {
    recordFail('AI provider disclosure check failed', err);
  }

  try {
    const aiBot = await chatService.getOrCreateAiBotUser();
    assert.strictEqual(aiBot.name, 'Flash AI');
    assert.strictEqual(aiBot.username, 'flash_ai');
    assert.strictEqual(aiBot.isVerified, true);
    recordPass('Flash AI virtual user is initialized with correct identity and verified badge');
  } catch (err) {
    recordFail('Flash AI virtual user check failed', err);
  }

  // ===========================================================================
  // SECTION 2: MANUAL CONTACTS GRAPH & MATCHING
  // ===========================================================================
  console.log('\n\x1b[1m[2] Manual Contacts Engine, Privacy & Owner Isolation\x1b[0m');

  const ownerA = generateMongoId();
  const ownerB = generateMongoId();
  const regUser1 = generateMongoId();
  const regUser2 = generateMongoId();

  // Seed test registered users in MongoDB
  try {
    try {
      await Contact.collection.drop();
    } catch (dropErr) {}
    await User.deleteMany({
      $or: [
        { _id: { $in: [ownerA, ownerB, regUser1, regUser2] } },
        { username: { $in: ['alice_wonder', 'bob_stealth', 'blocked_user', 'customer_dave', 'agent_sarah'] } },
        { email: { $in: ['alice@example.com', 'bob@example.com', 'dave@example.com', 'sarah@flashchat.internal'] } },
        { phoneNumber: { $in: ['+14155552671', '+14155552672', '+14155559876'] } }
      ]
    });
    await Contact.syncIndexes();
    await ContactInvite.deleteMany({ sender: { $in: [ownerA, ownerB] } });

    await User.create([
      {
        _id: regUser1,
        username: 'alice_wonder',
        name: 'Alice Wonder',
        phoneNumber: '+14155552671',
        email: 'alice@example.com',
        discoverableByPhone: true,
        discoverableByEmail: true,
        isOnboarded: true
      },
      {
        _id: regUser2,
        username: 'bob_stealth',
        name: 'Bob Stealth',
        phoneNumber: '+14155552672',
        email: 'bob@example.com',
        discoverableByPhone: false, // Opted out of discoverability
        discoverableByEmail: false,
        isOnboarded: true
      }
    ]);
  } catch (e) {
    console.error('Setup error in contactsSupportFlashAi:', e);
  }

  // 2.1 Validation: name & phone/email required, sanitization
  try {
    let thrown = false;
    try {
      await contactService.createContact(ownerA, { name: '', phone: '+14155559999' });
    } catch (e) {
      thrown = true;
      assert.strictEqual(e.statusCode, 400);
    }
    assert.ok(thrown, 'Empty name must be rejected');

    thrown = false;
    try {
      await contactService.createContact(ownerA, { name: 'John Doe', phone: '', email: '' });
    } catch (e) {
      thrown = true;
      assert.strictEqual(e.statusCode, 400);
    }
    assert.ok(thrown, 'Missing both phone and email must be rejected');

    // Create valid contact with script tag in name
    const sanitizedContact = await contactService.createContact(ownerA, {
      name: 'Charlie <script>alert("xss")</script>',
      phone: '+14155551111',
      note: 'Best friend <script>evil()</script>'
    });
    assert.strictEqual(sanitizedContact.name, 'Charlie');
    assert.strictEqual(sanitizedContact.note, 'Best friend');
    recordPass('Contact input validation and XSS sanitization enforced');
  } catch (err) {
    recordFail('Contact validation test failed', err);
  }

  // 2.2 Duplicate phone/email returns 409 for same owner, allowed across different owners
  try {
    let thrown = false;
    try {
      await contactService.createContact(ownerA, {
        name: 'Charlie Duplicate',
        phone: '+14155551111'
      });
    } catch (e) {
      thrown = true;
      assert.strictEqual(e.statusCode, 409);
    }
    assert.ok(thrown, 'Duplicate phone for same owner must return 409 Conflict');

    // Owner B can save the same phone without conflict
    const contactOwnerB = await contactService.createContact(ownerB, {
      name: 'Charlie Friend',
      phone: '+14155551111'
    });
    assert.ok(contactOwnerB._id, 'Owner B should successfully save contact with same phone');
    recordPass('Duplicate contact conflict (409) isolated per owner');
  } catch (err) {
    recordFail('Duplicate contact test failed', err);
  }

  // 2.3 LinkedUser matching on registered users & respect discoverability opt-out
  try {
    // Adding Alice (opted-in) -> should link
    const linkedAlice = await contactService.createContact(ownerA, {
      name: 'Alice Colleague',
      phone: '+14155552671'
    });
    assert.ok(linkedAlice.linkedUser, 'Should link Alice as registered user');
    assert.strictEqual(String(linkedAlice.linkedUser._id || linkedAlice.linkedUser), String(regUser1));

    // Adding Bob (opted-out) -> should NOT link
    const unlinkedBob = await contactService.createContact(ownerA, {
      name: 'Bob Secret',
      phone: '+14155552672'
    });
    assert.strictEqual(unlinkedBob.linkedUser, null, 'Opted-out user must not be linked');
    recordPass('Registered user auto-linking and discoverability opt-out verified');
  } catch (err) {
    recordFail('User linking & privacy test failed', err);
  }

  // 2.4 Block respect: If blocker relationship exists, no linking
  try {
    const blockedUserId = generateMongoId();
    await User.deleteMany({ phoneNumber: '+14155559876' });
    await User.create({
      _id: blockedUserId,
      username: 'blocked_user',
      name: 'Blocked User',
      phoneNumber: '+14155559876',
      isOnboarded: true
    });

    await Block.create({ blocker: ownerA, blocked: blockedUserId });

    const blockedContact = await contactService.createContact(ownerA, {
      name: 'Former Friend',
      phone: '+14155559876'
    });
    assert.strictEqual(blockedContact.linkedUser, null, 'Blocked user must not be linked');
    recordPass('Blocked user relationship blocks contact graph linking');
  } catch (err) {
    recordFail('Block contact test failed', err);
  }

  // 2.5 Owner-only route isolation (404 for other owners)
  try {
    const contactOfA = await contactService.createContact(ownerA, {
      name: 'Secret Contact',
      phone: '+14155553333'
    });

    let thrown = false;
    try {
      await contactService.getContactById(ownerB, contactOfA._id);
    } catch (e) {
      thrown = true;
      assert.strictEqual(e.statusCode, 404);
    }
    assert.ok(thrown, 'User B must receive 404 accessing User A contact');

    thrown = false;
    try {
      await contactService.updateContact(ownerB, contactOfA._id, { name: 'Hacked Name' });
    } catch (e) {
      thrown = true;
      assert.strictEqual(e.statusCode, 404);
    }
    assert.ok(thrown, 'User B must receive 404 modifying User A contact');

    thrown = false;
    try {
      await contactService.deleteContact(ownerB, contactOfA._id);
    } catch (e) {
      thrown = true;
      assert.strictEqual(e.statusCode, 404);
    }
    assert.ok(thrown, 'User B must receive 404 deleting User A contact');
    recordPass('Strict owner-only isolation (404) on all contact operations');
  } catch (err) {
    recordFail('Owner isolation test failed', err);
  }

  // 2.6 Bulk import per-row result tracking
  try {
    const bulkPayload = [
      { name: 'Bulk One', phone: '+14155557701' },
      { name: 'Bulk Two', phone: '+14155557702' },
      { name: '', phone: '+14155557703' }, // Invalid missing name
      { name: 'Bulk Four', phone: '+14155557701' } // Duplicate phone
    ];

    const bulkResult = await contactService.bulkImport(ownerA, bulkPayload);
    assert.strictEqual(bulkResult.totalReceived, 4);
    assert.strictEqual(bulkResult.importedCount, 2);
    assert.strictEqual(bulkResult.failedCount, 2);
    assert.strictEqual(bulkResult.failed[0].row, 3);
    assert.strictEqual(bulkResult.failed[1].row, 4);
    recordPass('Bulk import processes batch with granular per-row error tracking');
  } catch (err) {
    recordFail('Bulk import test failed', err);
  }

  // 2.7 Invite rate limit (10/day) & 7-day cooldown deduplication
  try {
    const unregisteredContact = await contactService.createContact(ownerA, {
      name: 'Unregistered Pal',
      phone: '+14155558899'
    });

    // 1st invite succeeds
    const invite1 = await contactService.inviteContact(ownerA, unregisteredContact._id);
    assert.strictEqual(invite1.success, true);

    // Immediate 2nd invite within 7 days fails with 429
    let thrown = false;
    try {
      await contactService.inviteContact(ownerA, unregisteredContact._id);
    } catch (e) {
      thrown = true;
      assert.strictEqual(e.statusCode, 429);
      assert.ok(e.message.includes('7 days'));
    }
    assert.ok(thrown, 'Duplicate invite within 7 days must be rejected');
    recordPass('Contact invite 7-day cooldown deduplication verified');
  } catch (err) {
    recordFail('Invite cooldown test failed', err);
  }

  // ===========================================================================
  // SECTION 3: "CHAT WITH US" SUPPORT SYSTEM & AGENT TRIAGE
  // ===========================================================================
  console.log('\n\x1b[1m[3] "Chat with us" Support System, AI First-Response & Triage\x1b[0m');

  const customerId = generateMongoId();
  const agentId = generateMongoId();

  try {
    await User.deleteMany({ _id: { $in: [customerId, agentId] } });
    await SupportTicket.deleteMany({ user: customerId });

    await User.create([
      {
        _id: customerId,
        username: 'customer_dave',
        name: 'Dave Customer',
        email: 'dave@example.com',
        role: 'user',
        isOnboarded: true
      },
      {
        _id: agentId,
        username: 'agent_sarah',
        name: 'Sarah Agent',
        email: 'sarah@flashchat.internal',
        role: 'support',
        isOnboarded: true
      }
    ]);
  } catch (e) {}

  let createdTicket = null;

  // 3.1 Ticket creation, support conversation generation & Flash AI automated response
  try {
    createdTicket = await supportService.createTicket(customerId, {
      subject: 'How do I encrypt my Pocket notes?',
      category: 'feature',
      message: 'I want to know if my notes in Pocket are encrypted with zero knowledge.'
    });

    assert.ok(createdTicket._id, 'Ticket must be created');
    assert.strictEqual(createdTicket.status, 'open');
    assert.strictEqual(createdTicket.category, 'feature');

    // Verify support conversation was created
    const supportConv = await Conversation.findById(createdTicket.conversation);
    assert.ok(supportConv, 'Support conversation must exist');
    assert.strictEqual(supportConv.type, 'support');

    // Verify messages: user initial message + Flash AI automated reply
    const messages = await Message.find({ conversation: supportConv._id }).sort({ createdAt: 1 });
    assert.strictEqual(messages.length, 2);
    assert.strictEqual(messages[0].type, 'text');
    assert.strictEqual(messages[1].type, 'ai');
    assert.ok(
      messages[1].text.includes('Flash') || messages[1].text.includes('Help'),
      'AI first response should provide helpful context'
    );
    recordPass('Support ticket creates support conversation with automated Flash AI first response');
  } catch (err) {
    recordFail('Ticket creation test failed', err);
  }

  // 3.2 Submitting while ticket is open appends to open ticket (one open ticket per user)
  try {
    const secondCall = await supportService.createTicket(customerId, {
      subject: 'Follow up on Pocket encryption',
      category: 'feature',
      message: 'Also, can anyone else reset my PIN?'
    });

    assert.strictEqual(String(secondCall._id), String(createdTicket._id), 'Should reuse open ticket');
    recordPass('Single open support ticket constraint verified');
  } catch (err) {
    recordFail('Single open ticket test failed', err);
  }

  // 3.3 Customer cannot view other users' tickets (404)
  try {
    const otherUser = generateMongoId();
    let thrown = false;
    try {
      await supportService.getTicketDetail(createdTicket._id, otherUser);
    } catch (e) {
      thrown = true;
      assert.strictEqual(e.statusCode, 404);
    }
    assert.ok(thrown, 'User cannot view another users support ticket');
    recordPass('Customer ticket access isolation (404) enforced');
  } catch (err) {
    recordFail('Ticket access isolation test failed', err);
  }

  // 3.4 Human handoff request
  try {
    const handoff = await supportService.requestHumanHandoff(createdTicket._id, customerId);
    assert.strictEqual(handoff.status, 'pending');

    const updated = await SupportTicket.findById(createdTicket._id);
    assert.strictEqual(updated.status, 'pending');
    recordPass('Human agent handoff transitions ticket status to pending');
  } catch (err) {
    recordFail('Human handoff test failed', err);
  }

  // 3.5 Agent reply and ticket status transition
  try {
    const agentMsg = await supportService.agentReply(agentId, createdTicket._id, {
      text: 'Hello Dave, I am Sarah from Flash Support. Your Pocket notes are encrypted with client-side AES-256-GCM.'
    });

    assert.ok(agentMsg._id, 'Agent message must be created');
    assert.strictEqual(String(agentMsg.sender?._id || agentMsg.sender), String(agentId));
    recordPass('Support agent reply delivered through support conversation');
  } catch (err) {
    recordFail('Agent reply test failed', err);
  }

  // 3.6 Resolving and rating ticket (only once on resolved ticket)
  try {
    // Close ticket
    const closeRes = await supportService.closeTicket(createdTicket._id, customerId);
    assert.strictEqual(closeRes.success, true);
    assert.strictEqual(closeRes.ticket.status, 'resolved');

    // 1st rating succeeds
    const ratingRes = await supportService.rateTicket(createdTicket._id, customerId, {
      rating: 5,
      comment: 'Excellent, clear explanation!'
    });
    assert.strictEqual(ratingRes.success, true);
    assert.strictEqual(ratingRes.rating, 5);

    // 2nd rating rejected
    let thrown = false;
    try {
      await supportService.rateTicket(createdTicket._id, customerId, {
        rating: 4,
        comment: 'Changing my mind'
      });
    } catch (e) {
      thrown = true;
      assert.strictEqual(e.statusCode, 400);
    }
    assert.ok(thrown, 'Second rating submission must be rejected');
    recordPass('Ticket resolution and single-submission 1-5 star rating verified');
  } catch (err) {
    recordFail('Ticket rating test failed', err);
  }

  // 3.7 Support Policy & Canned replies
  try {
    const policy = supportService.getSupportPolicy();
    assert.ok(policy.averageResponseTime);
    assert.ok(policy.privacyStatement.includes('zero access to your private chats'));
    recordPass('Support privacy policy and SLA metrics verified');
  } catch (err) {
    recordFail('Support policy test failed', err);
  }

  console.log('\n======================================================');
  console.log(`Contacts & Support Suite: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  const mongoose = require('mongoose');
  const config = require('../../config/env');

  mongoose.connect(config.MONGO_URI).then(async () => {
    try {
      await runContactsSupportFlashAiTests();
      await mongoose.disconnect();
      process.exit(0);
    } catch (e) {
      console.error(e);
      await mongoose.disconnect();
      process.exit(1);
    }
  });
}

module.exports = runContactsSupportFlashAiTests;
