/**
 * Flash Chat - Master Backend Test Suite Runner
 */

const { spawnSync } = require('child_process');
const path = require('path');

console.log('\n========================================================================');
console.log('🚀 FLASH CHAT COMPLETE BACKEND TEST SUITE (Step 10, Part 10-2)');
console.log('========================================================================\n');

const testSuites = [
  { name: '1. Project Static Integrity & Security Audit', file: 'tests/projectAudit.js' },
  { name: '2. Backend Unit Test Suite', file: 'tests/unit/unitTests.js' },
  { name: '3. Integration Suite: Auth, Users, Chats & Social', file: 'tests/integration/authUsersChatsSocial.test.js' },
  { name: '4. Integration Suite: Pocket Vault, AI, Push & Ops', file: 'tests/integration/pocketAiPushOps.test.js' },
  { name: '5. Integration Suite: Manual Contacts, Support Desk & Flash AI', file: 'tests/integration/contactsSupportFlashAi.test.js' },
  { name: '6. Flash AI Branding & Persona Static Scan', file: 'tests/unit/brandingAudit.test.js' },
  { name: '7. Realtime Sockets & WebRTC Signaling Suite', file: 'tests/sockets/socketAndSignaling.test.js' },
  { name: '8. Flash AI Defense & Prompt Wrapper Suite', file: 'tests/runAiTests.js' },
  { name: '9. Step 9A Security, Rate Limiting & Observability Suite', file: 'tests/backendSecurityPush.test.js' },
  { name: '10. Security, Privacy & Access Isolation Suite (B-3c.3)', file: 'tests/securityAndPrivacySuite.js' },
  { name: '11. Migration, Idempotency & Compatibility Suite (B-3c.4)', file: 'tests/migrationAndCompatSuite.js' },
  { name: '12. Phone-Based Chats & Pending Conversations Suite', file: 'tests/integration/phoneChatAndPendingSuite.test.js' },
  { name: '13. Multi-User Auth, Manual Search & Real-Time Chat Suite', file: '../scripts/verifyMultiUserChat.js' },
  { name: '14. Chat History Persistence & Reopening Verification Suite', file: '../scripts/verifyChatHistoryPersistence.js' }
];

let totalPassedSuites = 0;
let totalFailedSuites = 0;

for (const suite of testSuites) {
  console.log(`\n▶ Running: \x1b[1m${suite.name}\x1b[0m...`);
  const result = spawnSync('node', [path.join(__dirname, '..', suite.file)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' }
  });

  if (result.status === 0) {
    totalPassedSuites++;
  } else {
    totalFailedSuites++;
  }
}

console.log('\n========================================================================');
console.log('📊 FLASH CHAT BACKEND TEST RUN SUMMARY');
console.log('========================================================================');
console.log(`Total Suites Executed: ${testSuites.length}`);
console.log(`Suites Passed: \x1b[32m${totalPassedSuites}\x1b[0m`);
console.log(`Suites Failed: \x1b[31m${totalFailedSuites}\x1b[0m`);
console.log('========================================================================\n');

if (totalFailedSuites > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
