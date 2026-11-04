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
  console.log('📱 FLASH CHAT - PHONE LOGIN & CONTACT/HISTORY PERSISTENCE VERIFICATION');
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
  const raw10Digits = `98${String(unique).slice(-8)}`;
  const fullE164 = `+91${raw10Digits}`;

  const userData = {
    name: 'Persistent User',
    username: `persist_${unique}`,
    email: `persist_${unique}@test.com`,
    phoneNumber: fullE164,
    password: 'Password123!'
  };

  // 1. Sign up user with full E.164 phone
  const signupRes = await request('POST', '/api/auth/signup', userData);
  assert(signupRes.status === 201, 'User signed up with +91 phone number');
  const originalUserId = signupRes.data.user?._id;
  let token = signupRes.data.accessToken || signupRes.data.token;
  let auth = { Authorization: `Bearer ${token}` };

  // 2. Add saved contact
  const contactRes = await request('POST', '/api/contacts', {
    name: 'My Special Contact',
    phone: `+919111${String(unique).slice(-6)}`
  }, auth);
  assert(contactRes.status === 201, 'Added a saved contact successfully');
  const contactId = contactRes.data.contact?._id;

  // 3. Start self chat and send message
  const chatRes = await request('POST', '/api/chats/direct', { userId: originalUserId }, auth);
  assert(chatRes.status === 200, 'Created / fetched self conversation');
  const convId = chatRes.data.conversation?._id;

  const msgRes = await request('POST', '/api/messages', {
    conversationId: convId,
    text: 'History message: must never disappear after logout!'
  }, auth);
  assert(msgRes.status === 201, 'Message saved into conversation in MongoDB');

  // 4. LOG OUT
  const logout1 = await request('POST', '/api/auth/logout', null, auth);
  assert(logout1.status === 200, 'User logged out cleanly');

  // 5. LOG IN via OTP using 10 digits (without +91, as users type)
  const sendOtpRes = await request('POST', '/api/auth/send-otp', {
    identifier: raw10Digits,
    type: 'phone'
  });
  assert(sendOtpRes.status === 200, 'OTP requested with 10 digits');

  // Verify OTP with 10 digits
  const verifyOtpRes = await request('POST', '/api/auth/verify-otp', {
    identifier: raw10Digits,
    otp: '123456'
  });
  assert(verifyOtpRes.status === 200, 'OTP verified successfully with 10 digits');
  const loggedInUser1 = verifyOtpRes.data.user;
  assert(String(loggedInUser1?._id) === String(originalUserId), 'Logged into SAME existing account (NO duplicate account created)');

  token = verifyOtpRes.data.accessToken || verifyOtpRes.data.token;
  auth = { Authorization: `Bearer ${token}` };

  // 6. Verify Contacts are still there after OTP login
  const contactsList1 = await request('GET', '/api/contacts', null, auth);
  const foundContact1 = contactsList1.data.contacts?.find(c => String(c._id) === String(contactId));
  assert(Boolean(foundContact1), 'Saved contact is STILL present after logout & OTP login');

  // 7. Verify Chat History is still intact after OTP login
  const msgsList1 = await request('GET', `/api/chats/${convId}/messages`, null, auth);
  assert(msgsList1.data.messages?.length >= 1, 'Chat messages remain intact after logout & OTP login');

  // 8. LOG OUT AGAIN
  const logout2 = await request('POST', '/api/auth/logout', null, auth);
  assert(logout2.status === 200, 'User logged out 2nd time');

  // 9. LOG IN via Password using 10 digits (without +91)
  const loginPassRes = await request('POST', '/api/auth/login', {
    identifier: raw10Digits,
    password: userData.password
  });
  assert(loginPassRes.status === 200, 'Logged in via Password using 10-digit phone');
  assert(String(loginPassRes.data.user?._id) === String(originalUserId), 'Password login matched SAME user ID');

  token = loginPassRes.data.accessToken || loginPassRes.data.token;
  auth = { Authorization: `Bearer ${token}` };

  // 10. Verify Contacts and Messages are still there after Password login
  const contactsList2 = await request('GET', '/api/contacts', null, auth);
  const foundContact2 = contactsList2.data.contacts?.find(c => String(c._id) === String(contactId));
  assert(Boolean(foundContact2), 'Saved contact is STILL present after password login');

  const msgsList2 = await request('GET', `/api/chats/${convId}/messages`, null, auth);
  assert(msgsList2.data.messages?.length >= 1, 'Chat messages remain intact after password login');

  console.log('\n========================================================================');
  console.log(`SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('========================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

testSuite().catch((err) => {
  console.error('Fatal error in testSuite:', err);
  process.exit(1);
});
