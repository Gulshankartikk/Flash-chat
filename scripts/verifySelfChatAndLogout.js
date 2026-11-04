const BASE_URL = process.env.VITE_API_URL || 'http://localhost:5000';

async function request(method, path, body = null, headers = {}) {
  const url = `${BASE_URL}${path}`;
  const reqHeaders = {
    'Content-Type': 'application/json',
    ...headers
  };
  const options = {
    method,
    headers: reqHeaders
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  let data = null;
  try {
    data = await res.json();
  } catch (_) {}
  return { status: res.status, data };
}

async function testSuite() {
  console.log('\n========================================================================');
  console.log('🧪 FLASH CHAT - VERIFY SELF-CHAT ("MESSAGE YOURSELF") & LOGOUT 401 FIX');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, name) {
    if (cond) {
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}`);
      failed++;
    }
  }

  const unique = Date.now();
  const userData = {
    name: 'Self Tester',
    username: `selftester_${unique}`,
    email: `self_${unique}@test.com`,
    phoneNumber: `+1999${String(unique).slice(-7)}`,
    password: 'Password123!'
  };

  // 1. Register User
  const regRes = await request('POST', '/api/auth/register', userData);
  assert(regRes.status === 201, 'User registered successfully');
  const token = regRes.data.accessToken || regRes.data.token;
  const user = regRes.data.user;
  const auth = { Authorization: `Bearer ${token}` };

  // 2. Direct chat with own user ID
  const directSelfRes = await request('POST', '/api/chats/direct', { userId: user._id }, auth);
  assert(directSelfRes.status === 200, 'POST /api/chats/direct with own userId returns 200');
  assert(directSelfRes.data.conversation?.isSelf === true, 'Self conversation marked isSelf: true');
  assert(directSelfRes.data.conversation?.displayName.includes('You'), 'Self conversation displayName is "You (Message yourself)"');
  const selfConvId = directSelfRes.data.conversation._id;

  // 3. User saves own phone number as a contact (Simulating user adding themselves or sync)
  const contactRes = await request('POST', '/api/contacts', {
    name: 'My Personal Number',
    phone: userData.phoneNumber
  }, auth);
  assert(contactRes.status === 201, 'User saved contact with own phone number');
  const contactId = contactRes.data.contact._id;

  // 4. Click chat on self contact
  const chatSelfContactRes = await request('POST', `/api/contacts/${contactId}/message`, null, auth);
  assert(chatSelfContactRes.status === 200, 'POST /api/contacts/:id/message with own contact returns 200 OK (no 400 error)');
  assert(String(chatSelfContactRes.data.conversation?._id) === String(selfConvId), 'Reused self-conversation for self contact');
  assert(chatSelfContactRes.data.conversation?.isSelf === true, 'Contact chat result isSelf: true');

  // 5. Send message into self chat (Message yourself / Note to self)
  const sendMsgRes = await request('POST', '/api/messages', {
    conversationId: selfConvId,
    text: 'Note to myself: verify backup and deploy'
  }, auth);
  assert(sendMsgRes.status === 201, 'Message sent to self conversation successfully');
  assert(sendMsgRes.data.message?.readBy?.length >= 1, 'Self message is immediately marked as read');

  // 6. Verify conversation list includes self chat with 0 unread count
  const listRes = await request('GET', '/api/chats', null, auth);
  const listedSelfConv = listRes.data.conversations?.find((c) => String(c._id) === String(selfConvId));
  assert(Boolean(listedSelfConv), 'Self conversation appears in GET /api/chats');
  assert(listedSelfConv?.unreadCount === 0, 'Self conversation has unreadCount = 0');
  assert(listedSelfConv?.displayName.includes('You'), 'Self conversation in list is "You (Message yourself)"');

  // 7. Verify Logout without token (does not throw 401)
  const noTokenLogoutRes = await request('POST', '/api/auth/logout');
  assert(noTokenLogoutRes.status === 200, 'POST /api/auth/logout with NO token returns 200 (never 401)');

  // 8. Verify Logout with invalid / expired token
  const badTokenLogoutRes = await request('POST', '/api/auth/logout', null, { Authorization: 'Bearer invalid.or.expired.token' });
  assert(badTokenLogoutRes.status === 200, 'POST /api/auth/logout with INVALID token returns 200 (never 401)');

  // 9. Verify standard authenticated logout
  const authLogoutRes = await request('POST', '/api/auth/logout', null, auth);
  assert(authLogoutRes.status === 200, 'POST /api/auth/logout with valid token returns 200');

  console.log('\n========================================================================');
  console.log(`SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('========================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

testSuite().catch((err) => {
  console.error('Fatal error in testSuite:', err);
  process.exit(1);
});
