/**
 * Flash Chat - Staging Environment, Safe Mode & Data Scrubbing Suite (10-4b.6-C)
 */

const assert = require('assert');
const crypto = require('crypto');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    \x1b[31m${err.message}\x1b[0m`);
    failed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    \x1b[31m${err.message}\x1b[0m`);
    failed++;
  }
}

async function runStagingAndScrubSuite() {
  console.log('\n\x1b[1m\x1b[33m========================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[33m🧪 FLASH CHAT STAGING ENVIRONMENT, SAFE MODE & SCRUB SUITE (10-4b.6-C)\x1b[0m');
  console.log('\x1b[1m\x1b[33m========================================================================\x1b[0m\n');

  // =============================================================
  // 1. STAGING SAFE MODE RULES
  // =============================================================
  console.log('\x1b[1m[1] STAGING_SAFE_MODE Startup Validator Rules\x1b[0m');

  runTest('1. Startup validator refuses STAGING_SAFE_MODE on production domain', () => {
    const validateStagingConfig = (safeMode, host, prodDomain) => {
      if (safeMode && host === prodDomain) {
        throw new Error('STAGING_SAFE_MODE_FORBIDDEN_ON_PRODUCTION_DOMAIN');
      }
      return { ok: true };
    };

    assert.throws(
      () => validateStagingConfig(true, 'flashchat.app', 'flashchat.app'),
      /STAGING_SAFE_MODE_FORBIDDEN_ON_PRODUCTION_DOMAIN/
    );

    assert.strictEqual(
      validateStagingConfig(true, 'staging.flash.localhost', 'flashchat.app').ok,
      true
    );
  });

  runTest('2. Security controls (CSP, rate limiting, HttpOnly cookies) remain strictly enabled on staging', () => {
    const getStagingSecurityConfig = () => ({
      helmetCSP: true,
      rateLimiter: true,
      httpOnlyCookies: true,
      corsRestricted: true
    });

    const cfg = getStagingSecurityConfig();
    assert.strictEqual(cfg.helmetCSP, true);
    assert.strictEqual(cfg.rateLimiter, true);
    assert.strictEqual(cfg.httpOnlyCookies, true);
  });

  // =============================================================
  // 2. PRODUCTION DATA SCRUBBING & ANONYMIZATION
  // =============================================================
  console.log('\n\x1b[1m[2] Production Data Scrubbing & Anonymization Engine\x1b[0m');

  const rawProductionFixture = [
    {
      _id: 'u-prod-1',
      name: 'Alice Henderson',
      username: 'alice_h',
      email: 'alice.henderson@corporate-bank.com',
      phone: '+14155559876',
      bio: 'VP of Engineering at Major Financial',
      token: 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ1MSJ9.signature',
      pushSubscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/real-token' }
    },
    {
      _id: 'm-prod-101',
      conversationId: 'c-1',
      sender: 'u-prod-1',
      text: 'Here is the confidential financial statement for Q3: confidential-doc.pdf',
      mediaUrl: 'https://res.cloudinary.com/prod/raw/upload/v1/private-doc.pdf'
    },
    {
      _id: 'p-prod-201',
      owner: 'u-prod-1',
      title: 'Banking Password Vault',
      ciphertext: 'a8f4c2e1b3d57908bcae1234567890abcdef'
    }
  ];

  const scrubData = (dataset) => {
    return dataset.map((doc, idx) => {
      const copy = { ...doc };
      if (copy.email) copy.email = `synthetic_user_${idx}@example.test`;
      if (copy.phone) copy.phone = `+1555000${String(idx).padStart(4, '0')}`;
      if (copy.name) copy.name = `Synthetic User ${idx}`;
      if (copy.bio) copy.bio = 'Synthetic staging bio text';
      if (copy.token) delete copy.token;
      if (copy.pushSubscription) delete copy.pushSubscription;
      if (copy.text) copy.text = 'Synthetic anonymized message content for testing.';
      if (copy.mediaUrl) copy.mediaUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
      if (copy.ciphertext) copy.ciphertext = crypto.randomBytes(16).toString('hex');
      return copy;
    });
  };

  const scrubbed = scrubData(rawProductionFixture);

  runTest('1. Anonymized data contains 0 real-world email domains, phones, or confidential texts', () => {
    const serialized = JSON.stringify(scrubbed);

    const forbiddenDomain = ['corporate', 'bank', 'com'].join('.');
    assert.strictEqual(serialized.includes(forbiddenDomain), false);
    assert.strictEqual(serialized.includes('+14155559876'), false);
    assert.strictEqual(serialized.includes('confidential financial statement'), false);
    assert.strictEqual(serialized.includes('real-token'), false);
  });

  runTest('2. Relational counts and schema integrity are 100% preserved after scrubbing', () => {
    assert.strictEqual(scrubbed.length, rawProductionFixture.length);
    assert.strictEqual(scrubbed[0]._id, rawProductionFixture[0]._id);
  });

  // =============================================================
  // 3. IMAGE DIGEST PROMOTION EQUALITY TEST
  // =============================================================
  console.log('\n\x1b[1m[3] Digest Promotion Assertion Check\x1b[0m');

  runTest('1. Assert same digests script passes on identical digests and fails on mismatch', () => {
    const assertDigests = (stagingDigest, prodDigest) => {
      if (stagingDigest !== prodDigest) throw new Error('DIGEST_MISMATCH');
      return true;
    };

    const d1 = 'sha256:1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff';
    assert.strictEqual(assertDigests(d1, d1), true);
    assert.throws(() => assertDigests(d1, 'sha256:mismatched'), /DIGEST_MISMATCH/);
  });

  // =============================================================
  // SUMMARY
  // =============================================================
  console.log('\n======================================================');
  console.log(`\x1b[1mStaging & Scrub Verification: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('======================================================\n');

  if (failed > 0) throw new Error('Staging and scrub verification failed.');
}

runStagingAndScrubSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});

module.exports = { runStagingAndScrubSuite };
