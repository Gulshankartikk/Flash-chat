/**
 * scripts/verifyReelsFix.js
 * Test suite to verify Reel creation with both { media } and { video } payloads,
 * feed retrieval, like/view interactions, and deletion.
 */

const http = require('http');

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

async function run() {
  console.log('\n========================================================================');
  console.log('⚡ FLASH CHAT - REEL CREATION & API VERIFICATION');
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

  try {
    const unique = Date.now().toString(36);
    const user = {
      name: 'Reel Creator',
      username: `reel_${unique}`,
      email: `reel_${unique}@flashchat.test`,
      password: 'Password123!'
    };

    // 1. Sign up user
    const reg = await request('POST', '/api/auth/signup', user);
    assert(reg.status === 201 || reg.status === 200, 'User registered successfully');
    const token = reg.data.accessToken || reg.data.token;
    const authHeader = { Authorization: `Bearer ${token}` };

    // 2. Create Reel sending { media: { url: '...' } } (the exact format sent by CreateSocialModal)
    const mediaPayload = {
      media: {
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        type: 'video',
        thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
        width: 1080,
        height: 1920,
        duration: 15
      },
      caption: 'Testing reel creation via media object #FlashReel',
      audioName: 'Original Audio - Flash Chat'
    };

    const resMedia = await request('POST', '/api/reels', mediaPayload, authHeader);
    assert(resMedia.status === 201, 'Scenario 1: POST /api/reels with { media } payload returns 201 Created');
    assert(resMedia.data.success === true, 'Scenario 1: Response success is true');
    assert(resMedia.data.data?.video?.url === mediaPayload.media.url, 'Scenario 1: reel.video.url is populated correctly');
    assert(resMedia.data.data?.media?.url === mediaPayload.media.url, 'Scenario 1: reel.media.url is populated correctly for frontend');
    const createdReelId = resMedia.data.data?._id;

    // 3. Create Reel sending { video: { url: '...' } } (backward compatibility)
    const videoPayload = {
      video: {
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        duration: 10
      },
      caption: 'Testing reel creation via video object #LegacyCompatibility'
    };

    const resVideo = await request('POST', '/api/reels', videoPayload, authHeader);
    assert(resVideo.status === 201, 'Scenario 2: POST /api/reels with { video } payload returns 201 Created');
    assert(resVideo.data.data?.video?.url === videoPayload.video.url, 'Scenario 2: reel.video.url populated');
    assert(resVideo.data.data?.media?.url === videoPayload.video.url, 'Scenario 2: reel.media.url populated');

    // 4. Fetch Reels feed
    const feedRes = await request('GET', '/api/reels/feed', null, authHeader);
    assert(feedRes.status === 200, 'Scenario 3: GET /api/reels/feed returns 200 OK');
    const found = feedRes.data.data?.find((r) => r._id === createdReelId);
    assert(Boolean(found), 'Scenario 3: Created reel appears in the reels feed');
    assert(Boolean(found?.media?.url), 'Scenario 3: Feed reel contains media.url');
    assert(Boolean(found?.video?.url), 'Scenario 3: Feed reel contains video.url');

    // 5. Like reel
    const likeRes = await request('POST', `/api/reels/${createdReelId}/like`, null, authHeader);
    assert(likeRes.status === 200 && likeRes.data?.isLiked === true, 'Scenario 4: POST /api/reels/:id/like successfully likes reel');

    // 6. Register view
    const viewRes = await request('POST', `/api/reels/${createdReelId}/view`, null, authHeader);
    assert(viewRes.status === 200 && viewRes.data?.success === true, 'Scenario 5: POST /api/reels/:id/view registers view count');

    // 7. Delete reel
    const deleteRes = await request('DELETE', `/api/reels/${createdReelId}`, null, authHeader);
    assert(deleteRes.status === 200 && deleteRes.data?.success === true, 'Scenario 6: DELETE /api/reels/:id deletes own reel successfully');

    // 8. Error case: Missing video URL
    const invalidRes = await request('POST', '/api/reels', { caption: 'No video provided' }, authHeader);
    assert(invalidRes.status === 400, 'Scenario 7: POST /api/reels without video returns 400 Bad Request');
    assert(invalidRes.data?.message === 'Reel video URL is required.', 'Scenario 7: Returns descriptive validation error message');

  } catch (err) {
    console.error('Test run failed:', err);
    failed++;
  }

  console.log('\n========================================================================');
  console.log(`REELS VERIFICATION SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run();
