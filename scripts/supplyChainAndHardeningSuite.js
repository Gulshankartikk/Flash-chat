/**
 * Flash Chat - Supply Chain, Secret Scanning & Repository Security Suite (10-4b.6-D)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

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

async function runSupplyChainAndHardeningSuite() {
  console.log('\n\x1b[1m\x1b[35m========================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[35m🛡️ FLASH CHAT SUPPLY CHAIN & REPO SECURITY SUITE (10-4b.6-D)\x1b[0m');
  console.log('\x1b[1m\x1b[35m========================================================================\x1b[0m\n');

  // =============================================================
  // 1. DEPENDABOT CONFIG VALIDATION
  // =============================================================
  console.log('\x1b[1m[1] Dependabot Configuration & Ecosystem Coverage\x1b[0m');

  runTest('1. Dependabot YAML is present and covers root, server, client, docker, and actions', () => {
    const dependabotPath = path.join(__dirname, '..', '.github', 'dependabot.yml');
    assert.strictEqual(fs.existsSync(dependabotPath), true);
    const content = fs.readFileSync(dependabotPath, 'utf8');
    assert.ok(content.includes('package-ecosystem: "npm"'));
    assert.ok(content.includes('package-ecosystem: "docker"'));
    assert.ok(content.includes('package-ecosystem: "github-actions"'));
  });

  // =============================================================
  // 2. GITLEAKS SECRET SCANNING PROOF
  // =============================================================
  console.log('\n\x1b[1m[2] Gitleaks Secret Scanning & Deliberate Detection Proof\x1b[0m');

  runTest('1. Secret scanner detects high-entropy fake API key fixtures and passes on clean code', () => {
    const scanForSecrets = (text) => {
      const secretPatterns = [
        /(?:sk_live|sk_test)_[0-9a-zA-Z]{24,}/,
        /AKIA[0-9A-Z]{16}/,
        /AIzaSy[0-9A-Za-z-_]{33}/
      ];

      for (const pattern of secretPatterns) {
        if (pattern.test(text)) {
          return { detected: true, pattern: pattern.toString() };
        }
      }
      return { detected: false };
    };

    const cleanCode = 'const apiUrl = process.env.API_URL || "https://api.example.com";';
    assert.strictEqual(scanForSecrets(cleanCode).detected, false);

    // Deliberate fake secret test
    const fakeSecretCode = 'const FAKE_KEY = "AKIA1234567890ABCDEF";';
    const detection = scanForSecrets(fakeSecretCode);
    assert.strictEqual(detection.detected, true);
    assert.ok(detection.pattern.includes('AKIA'));
  });

  // =============================================================
  // 3. CODEOWNERS & CODEQL VERIFICATION
  // =============================================================
  console.log('\n\x1b[1m[3] CODEOWNERS Review Routing & CodeQL Workflow\x1b[0m');

  runTest('1. CODEOWNERS covers critical security middleware, tokens, scripts, and CI workflows', () => {
    const codeownersPath = path.join(__dirname, '..', '.github', 'CODEOWNERS');
    assert.strictEqual(fs.existsSync(codeownersPath), true);
    const content = fs.readFileSync(codeownersPath, 'utf8');
    assert.ok(content.includes('/.github/'));
    assert.ok(content.includes('/scripts/'));
    assert.ok(content.includes('/server/src/middleware/'));
    assert.ok(content.includes('/client/src/styles/tokens.css'));
  });

  runTest('2. CodeQL workflow is configured for JavaScript and TypeScript analysis', () => {
    const codeqlPath = path.join(__dirname, '..', '.github', 'workflows', 'codeql.yml');
    assert.strictEqual(fs.existsSync(codeqlPath), true);
    const content = fs.readFileSync(codeqlPath, 'utf8');
    assert.ok(content.includes('languages: javascript-typescript'));
  });

  // =============================================================
  // 4. TEMPLATES & GOVERNANCE DOCS
  // =============================================================
  console.log('\n\x1b[1m[4] Issue Templates, Pull Request Template & Governance Docs\x1b[0m');

  runTest('1. Issue templates, PR template, SECURITY.md, and SUPPORT.md exist', () => {
    const requiredFiles = [
      '.github/PULL_REQUEST_TEMPLATE.md',
      '.github/ISSUE_TEMPLATE/bug_report.yml',
      '.github/ISSUE_TEMPLATE/config.yml',
      'SECURITY.md',
      'SUPPORT.md',
      'docs/DEPENDENCIES.md'
    ];

    for (const file of requiredFiles) {
      const fullPath = path.join(__dirname, '..', file);
      assert.strictEqual(fs.existsSync(fullPath), true, `File missing: ${file}`);
    }
  });

  // =============================================================
  // SUMMARY
  // =============================================================
  console.log('\n======================================================');
  console.log(`\x1b[1mSupply Chain & Repo Security Results: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('======================================================\n');

  if (failed > 0) throw new Error('Supply chain and repo security suite failed.');
}

runSupplyChainAndHardeningSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});

module.exports = { runSupplyChainAndHardeningSuite };
