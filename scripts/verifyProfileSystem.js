/**
 * scripts/verifyProfileSystem.js
 * End-to-End Profile System Verification Script for Flash Chat
 * Pure Node.js HTTP & Socket test suite
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
      if (typeof body === 'string') {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

function uploadMultipart(pathStr, filename, buffer, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathStr, BASE_URL);
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

    const pre = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`
    );
    const post = Buffer.from(`\r\n--${boundary}--\r\n`);
    const fullBody = Buffer.concat([pre, buffer, post]);

    const options = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length,
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
    req.write(fullBody);
    req.end();
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runProfileVerification() {
  console.log('\n========================================================================');
  console.log('⚡ FLASH CHAT - COMPLETE USER PROFILE SYSTEM VERIFICATION');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${message}`);
      passed++;
    } else {
      console.error(`  \x1b[31m❌ [FAIL]\x1b[0m ${message}`);
      failed++;
    }
  }

  const socketsToClose = [];

  try {
    const unique = Date.now().toString(36);

    const userAData = {
      name: 'Alice Springfield',
      username: `alice_${unique}`,
      email: `alice_${unique}@flashchat.test`,
      password: 'Password123!',
      phoneNumber: `+1415${Math.floor(1000000 + Math.random() * 9000000)}`
    };

    const userBData = {
      name: 'Bob Marley',
      username: `bob_${unique}`,
      email: `bob_${unique}@flashchat.test`,
      password: 'Password123!',
      phoneNumber: `+1415${Math.floor(1000000 + Math.random() * 9000000)}`
    };

    // 0. Register Alice & Bob
    const regA = await request('POST', '/api/auth/signup', userAData);
    assert(regA.status === 201 || regA.status === 200, 'Initial Setup: Alice registered successfully');
    const tokenA = regA.data.accessToken || regA.data.token;
    const authHeaderA = { Authorization: `Bearer ${tokenA}` };

    const regB = await request('POST', '/api/auth/signup', userBData);
    assert(regB.status === 201 || regB.status === 200, 'Initial Setup: Bob registered successfully');
    const tokenB = regB.data.accessToken || regB.data.token;
    const authHeaderB = { Authorization: `Bearer ${tokenB}` };

    console.log('\n\x1b[1m--- Section 1: User Profile Retrieval, Joined Date & Identity ---\x1b[0m');

    // 1. Alice fetches own profile
    const profileA = await request('GET', '/api/users/me', null, authHeaderA);
    assert(profileA.status === 200, 'Scenario 1: GET /api/users/me returns 200 OK');
    assert(profileA.data.user?.name === userAData.name, `Scenario 1: Name matches "${userAData.name}"`);
    assert(profileA.data.user?.username === userAData.username, `Scenario 1: Username matches "@${userAData.username}"`);
    assert(Boolean(profileA.data.user?.createdAt), 'Scenario 1: Account creation (createdAt) timestamp present for joined date');

    console.log('\n\x1b[1m--- Section 2: Edit Profile (Display Name, Bio/About & Preset Avatar) ---\x1b[0m');

    // 2. Alice updates name, bio, and avatar
    const updatedBio = 'Living life in the fast lane ⚡ Exploring Flash Chat!';
    const updatedAvatar = 'https://api.dicebear.com/7.x/bottts/svg?seed=Rocket';
    const updateRes = await request(
      'PATCH',
      '/api/users/me',
      {
        name: 'Alice S. (VIP)',
        bio: updatedBio,
        about: updatedBio,
        avatar: updatedAvatar
      },
      authHeaderA
    );
    assert(updateRes.status === 200, 'Scenario 2: PATCH /api/users/me returns 200 on valid update');
    assert(updateRes.data.user?.name === 'Alice S. (VIP)', 'Scenario 2: Display name updated to "Alice S. (VIP)"');
    assert(updateRes.data.user?.bio === updatedBio, 'Scenario 2: Bio/About updated and persisted');
    assert(updateRes.data.user?.avatar === updatedAvatar, 'Scenario 2: Preset avatar updated and persisted');

    console.log('\n\x1b[1m--- Section 3: Live Username Availability & Collision Prevention ---\x1b[0m');

    // 3a. Check availability for an untaken username
    const checkAvail = await request('GET', `/api/users/check-username/available_${unique}`, null, authHeaderA);
    assert(checkAvail.status === 200 && checkAvail.data?.available === true, 'Scenario 3a: check-username reports unused username as available');

    // 3b. Check availability for an existing username (Bob's username)
    const checkTaken = await request('GET', `/api/users/check-username/${userBData.username}`, null, authHeaderA);
    assert(checkTaken.status === 200 && checkTaken.data?.available === false, 'Scenario 3b: check-username reports Bob\'s username as taken');

    // 3c. Alice attempts to claim Bob's username -> rejected 400
    const claimRes = await request(
      'PATCH',
      '/api/users/me',
      { username: userBData.username },
      authHeaderA
    );
    assert(claimRes.status === 400, 'Scenario 3c: Attempt to claim already registered username is rejected with 400 error');
    assert(claimRes.data?.success === false, 'Scenario 3c: Success flag is false on collision');

    console.log('\n\x1b[1m--- Section 4: Phone Number Linking, E.164 Validation & Duplication Defense ---\x1b[0m');

    // 4a. Update phone number to valid new number
    const newPhone = `+1415${Math.floor(2000000 + Math.random() * 7000000)}`;
    const phoneRes = await request(
      'PATCH',
      '/api/users/me',
      { phoneNumber: newPhone },
      authHeaderA
    );
    assert(phoneRes.status === 200, 'Scenario 4a: Alice updates phone number to valid E.164 format');
    assert(phoneRes.data.user?.phoneNumber === newPhone, 'Scenario 4a: Phone number correctly persisted');

    // 4b. Alice attempts to claim Bob's phone number -> rejected 400
    const dupPhoneRes = await request(
      'PATCH',
      '/api/users/me',
      { phoneNumber: userBData.phoneNumber },
      authHeaderA
    );
    assert(dupPhoneRes.status === 400, 'Scenario 4b: Attempting to link another user\'s phone number is rejected with 400 error');

    console.log('\n\x1b[1m--- Section 5: WhatsApp & Instagram Privacy and Discoverability Settings ---\x1b[0m');

    // 5. Update privacy settings
    const privacyRes = await request(
      'PATCH',
      '/api/users/me',
      {
        privacy: {
          lastSeen: 'nobody',
          profilePhoto: 'contacts',
          readReceipts: false
        },
        isPrivateAccount: true,
        discoverableByPhone: false,
        discoverableByEmail: false
      },
      authHeaderA
    );
    assert(privacyRes.status === 200, 'Scenario 5: Privacy & discoverability settings saved successfully');
    assert(privacyRes.data.user?.privacy?.lastSeen === 'nobody', 'Scenario 5: Last seen visibility set to "nobody"');
    assert(privacyRes.data.user?.privacy?.profilePhoto === 'contacts', 'Scenario 5: Profile photo visibility set to "contacts"');
    assert(privacyRes.data.user?.privacy?.readReceipts === false, 'Scenario 5: Read receipts toggle set to false');
    assert(privacyRes.data.user?.isPrivateAccount === true, 'Scenario 5: Private Social Account flag set to true');
    assert(privacyRes.data.user?.discoverableByPhone === false, 'Scenario 5: Discoverable by phone set to false');
    assert(privacyRes.data.user?.discoverableByEmail === false, 'Scenario 5: Discoverable by email set to false');

    console.log('\n\x1b[1m--- Section 6: Public Profile View & Last-Seen Masking Verification ---\x1b[0m');

    // 6a. Bob views Alice's public profile -> since Alice set lastSeen to 'nobody', Bob cannot see her lastSeen or isOnline
    const publicA = await request('GET', `/api/users/${userAData.username}`, null, authHeaderB);
    assert(publicA.status === 200, 'Scenario 6a: Bob views Alice\'s public profile');
    assert(publicA.data.user?.name === 'Alice S. (VIP)', 'Scenario 6a: Alice\'s updated name is visible on public profile');
    assert(publicA.data.user?.lastSeen === undefined, 'Scenario 6a: Alice\'s lastSeen is securely masked for other users');
    assert(publicA.data.user?.isOnline === undefined, 'Scenario 6a: Alice\'s isOnline status is securely masked for other users');
    assert(publicA.data.user?.isPrivateAccount === true, 'Scenario 6a: Alice\'s private account status is displayed');

    // 6b. Alice views her own public profile -> sees all her info
    const publicABySelf = await request('GET', `/api/users/${userAData.username}`, null, authHeaderA);
    assert(publicABySelf.status === 200, 'Scenario 6b: Alice views own public profile successfully');

    console.log('\n\x1b[1m--- Section 7: Security & Unauthorized Edit Protection ---\x1b[0m');

    // 7a. Unauthenticated update attempt -> 401
    const unauthRes = await request('PATCH', '/api/users/me', { name: 'Compromised Name' });
    assert(unauthRes.status === 401, 'Scenario 7a: Unauthenticated update rejected with 401 Unauthorized');

    // 7b. Bob cannot alter Alice's account (User isolation via JWT)
    const bobEditRes = await request('PATCH', '/api/users/me', { name: 'Bob Updated Self' }, authHeaderB);
    assert(bobEditRes.status === 200, 'Scenario 7b: Bob updates his own profile');
    assert(bobEditRes.data.user?.name === 'Bob Updated Self', 'Scenario 7b: Bob\'s profile updated');

    const verifyAliceUntouched = await request('GET', '/api/users/me', null, authHeaderA);
    assert(verifyAliceUntouched.data.user?.name === 'Alice S. (VIP)', 'Scenario 7b: Alice\'s profile remained completely untouched by Bob');

    console.log('\n\x1b[1m--- Section 8: Profile Picture Upload Endpoint (POST /api/upload) ---\x1b[0m');

    // 8. Upload dummy image buffer
    const dummyImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    const uploadRes = await uploadMultipart('/api/upload', 'avatar.png', dummyImageBuffer, authHeaderA);
    assert(uploadRes.status === 200, 'Scenario 8: POST /api/upload accepts valid image and returns 200');
    assert(Boolean(uploadRes.data?.url), 'Scenario 8: Upload response contains hosted or fallback image URL');

    if (uploadRes.data?.url) {
      const applyAvatarRes = await request(
        'PATCH',
        '/api/users/me',
        { avatar: uploadRes.data.url },
        authHeaderA
      );
      assert(applyAvatarRes.status === 200, 'Scenario 8: Uploaded avatar URL persisted to Alice\'s user profile');
      assert(applyAvatarRes.data.user?.avatar === uploadRes.data.url, 'Scenario 8: User profile reflects uploaded avatar URL');
    }

    console.log('\n\x1b[1m--- Section 9: Real-Time Profile Synchronization via Socket.IO ---\x1b[0m');

    if (ioClient) {
      let socketReceivedEvent = false;
      const bobSocket = ioClient(BASE_URL, {
        auth: { token: tokenB },
        transports: ['websocket', 'polling']
      });
      socketsToClose.push(bobSocket);

      await new Promise((resolve) => {
        bobSocket.on('connect', () => {
          resolve();
        });
        setTimeout(resolve, 2000); // fallback if immediate
      });

      bobSocket.on('user:updated', (payload) => {
        if (payload.userId === regA.data.user._id || payload.userId === profileA.data.user._id) {
          socketReceivedEvent = true;
        }
      });

      // Alice updates display name
      await request(
        'PATCH',
        '/api/users/me',
        { name: 'Alice Realtime Live' },
        authHeaderA
      );

      // Wait 1.5s for socket event
      await sleep(1500);

      assert(socketReceivedEvent === true, 'Scenario 9: Socket.IO emitted "user:updated" event to Bob with Alice\'s latest name');
    } else {
      console.log('  ⚠ Socket.IO client library unavailable in test environment, skipping live socket assert');
    }

  } catch (error) {
    console.error('Fatal test error:', error);
    failed++;
  } finally {
    socketsToClose.forEach((s) => {
      try {
        s.disconnect();
      } catch (_) {}
    });
  }

  console.log('\n========================================================================');
  console.log(`PROFILE VERIFICATION SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runProfileVerification();
