/**
 * Flash AI Branding & String Audit Test
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { SYSTEM_INJECTION_DEFENSE } = require('../../services/ai/prompts');
const { AI_PROVIDER_DISCLOSURE } = require('../../controllers/aiController');

function runBrandingAuditTests() {
  console.log('\n\x1b[1m\x1b[36m===================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[36m⚡ FLASH AI BRANDING & PERSONA STATIC SCAN SUITE\x1b[0m');
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

  // 1. Check prompt defense persona
  try {
    assert.ok(
      SYSTEM_INJECTION_DEFENSE.includes('You are Flash AI'),
      'SYSTEM_INJECTION_DEFENSE persona must be Flash AI'
    );
    recordPass('AI System prompt persona is set to "Flash AI"');
  } catch (err) {
    recordFail('System persona check failed', err);
  }

  // 2. Check provider disclosure constant
  try {
    assert.strictEqual(
      AI_PROVIDER_DISCLOSURE,
      'Flash AI is powered by Google Gemini. Selected content is processed by Google to generate results.'
    );
    recordPass('AI_PROVIDER_DISCLOSURE constant conforms to transparency requirements');
  } catch (err) {
    recordFail('Provider disclosure check failed', err);
  }

  // 3. Scan user-facing response files to ensure no unbranded "Gemini AI" leaks into user text
  try {
    const filesToScan = [
      path.join(__dirname, '../../controllers/aiController.js'),
      path.join(__dirname, '../../services/ai/prompts.js'),
      path.join(__dirname, '../../services/supportService.js'),
      path.join(__dirname, '../../controllers/supportController.js'),
      path.join(__dirname, '../../controllers/contactController.js')
    ];

    for (const filePath of filesToScan) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        // Search for user-facing string occurrences of "Gemini AI"
        const matches = content.match(/['"`][^'"`]*\bGemini\s+AI\b[^'"`]*['"`]/gi);
        assert.ok(!matches || matches.length === 0, `File ${path.basename(filePath)} contains unbranded "Gemini AI": ${matches}`);
      }
    }
    recordPass('All user-facing controllers and services strictly use "Flash AI"');
  } catch (err) {
    recordFail('User-facing strings check failed', err);
  }

  console.log('\n======================================================');
  console.log(`Branding Audit Results: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runBrandingAuditTests();
}

module.exports = runBrandingAuditTests;
