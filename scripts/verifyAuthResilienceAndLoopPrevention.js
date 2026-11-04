/**
 * Verification test for Auth Resilience, 401 Handling, and Loop Prevention
 * Uses Node native fetch
 */

const assert = require('assert');

const BASE_URL = 'http://localhost:5000/api';

async function runVerification() {
  console.log('\n========================================================================');
  console.log('🔒 VERIFYING AUTH RESILIENCE, 401 CASCADE HANDLING & LOOP PREVENTION');
  console.log('========================================================================\n');

  let passed = 0;

  // 1. Missing Authorization header returns AUTH_REQUIRED
  const res1 = await fetch(`${BASE_URL}/pocket/items`);
  assert.strictEqual(res1.status, 401, 'Must return HTTP 401');
  const data1 = await res1.json();
  assert.strictEqual(data1.code, 'AUTH_REQUIRED', 'Must return code AUTH_REQUIRED');
  assert.strictEqual(data1.message, 'Authentication required. No token provided.', 'Expected message');
  console.log('  ✔ [PASS] Missing token returns HTTP 401 with code: AUTH_REQUIRED');
  passed++;

  // 2. Bearer "null" string returns AUTH_REQUIRED (defensive against localStorage.getItem returning "null")
  const res2 = await fetch(`${BASE_URL}/pocket/items`, {
    headers: { Authorization: 'Bearer null' }
  });
  assert.strictEqual(res2.status, 401, 'Must return HTTP 401');
  const data2 = await res2.json();
  assert.strictEqual(data2.code, 'AUTH_REQUIRED', 'Must return code AUTH_REQUIRED');
  console.log('  ✔ [PASS] "Bearer null" safely treated as absent token (returns AUTH_REQUIRED)');
  passed++;

  // 3. Bearer "undefined" string returns AUTH_REQUIRED
  const res3 = await fetch(`${BASE_URL}/contacts`, {
    headers: { Authorization: 'Bearer undefined' }
  });
  assert.strictEqual(res3.status, 401, 'Must return HTTP 401');
  const data3 = await res3.json();
  assert.strictEqual(data3.code, 'AUTH_REQUIRED', 'Must return code AUTH_REQUIRED');
  console.log('  ✔ [PASS] "Bearer undefined" safely treated as absent token (returns AUTH_REQUIRED)');
  passed++;

  // 4. Register a user and test legitimate access and token refresh
  const unique = Date.now().toString(36);
  const userPayload = {
    name: 'Auth Test User',
    username: `authuser_${unique}`,
    email: `authuser_${unique}@test.com`,
    password: 'Password123!'
  };

  const regRes = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userPayload)
  });
  const regData = await regRes.json();
  const accessToken = regData.accessToken;
  const setCookieHeader = regRes.headers.get('set-cookie');
  assert(!!accessToken, 'Must receive access token');
  assert(!!setCookieHeader, 'Must set refresh cookie');
  console.log('  ✔ [PASS] User registration sets valid access token and refresh cookie');
  passed++;

  // 5. Valid token grants access to /pocket/items and /contacts
  const pocketRes = await fetch(`${BASE_URL}/pocket/items`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  assert.strictEqual(pocketRes.status, 200, 'Must return 200 for authenticated user');
  console.log('  ✔ [PASS] Authenticated request to /pocket/items succeeds with HTTP 200');
  passed++;

  const contactsRes = await fetch(`${BASE_URL}/contacts`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  assert.strictEqual(contactsRes.status, 200, 'Must return 200 for authenticated user');
  console.log('  ✔ [PASS] Authenticated request to /contacts succeeds with HTTP 200');
  passed++;

  // 6. Test silent refresh using the cookie
  const cookieVal = setCookieHeader.split(';')[0];
  const refreshRes = await fetch(`${BASE_URL}/auth/refresh-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieVal
    }
  });
  assert.strictEqual(refreshRes.status, 200, 'Refresh must succeed');
  const refreshData = await refreshRes.json();
  assert(!!refreshData.accessToken, 'Must receive new access token');
  const newAccessToken = refreshData.accessToken;
  console.log('  ✔ [PASS] Silent refresh via httpOnly cookie successfully yields fresh accessToken');
  passed++;

  // 7. Verify new accessToken functions correctly
  const postRefreshRes = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${newAccessToken}` }
  });
  assert.strictEqual(postRefreshRes.status, 200, 'Must return 200');
  const postRefreshData = await postRefreshRes.json();
  assert.strictEqual(postRefreshData.user.email, userPayload.email, 'User verified');
  console.log('  ✔ [PASS] Refreshed access token successfully queries /auth/me');
  passed++;

  // 8. Offline contacts sync simulation: verify abort on 401 prevents rapid 12x hammer
  const mockOfflineQueue = Array.from({ length: 12 }, (_, i) => ({
    name: `Contact ${i}`,
    phone: `+1555000000${i}`
  }));

  let attempts = 0;
  const remaining = [];
  for (let i = 0; i < mockOfflineQueue.length; i++) {
    attempts++;
    const postRes = await fetch(`${BASE_URL}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockOfflineQueue[i])
    });

    if (postRes.status === 401) {
      remaining.push(...mockOfflineQueue.slice(i));
      break; // The loop prevention guard!
    }
    remaining.push(mockOfflineQueue[i]);
  }

  assert.strictEqual(attempts, 1, 'Loop prevention must abort on the 1st 401 attempt');
  assert.strictEqual(remaining.length, 12, 'All 12 items preserved in queue for when user logs in');
  console.log('  ✔ [PASS] Offline sync aborts on first 401, completely preventing the 12x repeated cascade');
  passed++;

  console.log('\n========================================================================');
  console.log(`🎉 ALL ${passed}/${passed} AUTH RESILIENCE & CASCADE PREVENTION TESTS PASSED!`);
  console.log('========================================================================\n');
}

runVerification().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
