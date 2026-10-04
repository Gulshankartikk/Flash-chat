/**
 * Flash Chat - Release Workflow & Deployment Automation Suite (10-4b.6)
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

async function runReleaseWorkflowSuite() {
  console.log('\n\x1b[1m\x1b[36m========================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[36m🚢 FLASH CHAT RELEASE WORKFLOW & CI/CD PIPELINE SUITE (10-4b.6)\x1b[0m');
  console.log('\x1b[1m\x1b[36m========================================================================\x1b[0m\n');

  // =============================================================
  // 1. TAG & PACKAGE CONSISTENCY GATE
  // =============================================================
  console.log('\x1b[1m[1] Semver Tag & Package Consistency Gate\x1b[0m');

  runTest('1. Valid semver tag matches package.json versions and CHANGELOG top entry', () => {
    const validateReleaseTag = (tag, rootPkgVer, changelogText) => {
      const version = tag.replace(/^v/, '');
      if (!/^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$/.test(version)) {
        throw new Error('INVALID_SEMVER_TAG');
      }
      if (version !== rootPkgVer) {
        throw new Error(`TAG_PACKAGE_MISMATCH: Tag ${version} does not match package.json ${rootPkgVer}`);
      }
      if (!changelogText.includes(`## [${version}]`)) {
        throw new Error(`CHANGELOG_ENTRY_MISSING: Missing changelog section for ${version}`);
      }
      return { ok: true, version };
    };

    const rootPkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const changelog = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');

    const valid = validateReleaseTag('v1.1.0', rootPkg.version, changelog);
    assert.strictEqual(valid.ok, true);
    assert.strictEqual(valid.version, '1.1.0');

    // Failure drill: Invalid semver
    assert.throws(() => validateReleaseTag('invalid-tag-123', rootPkg.version, changelog), /INVALID_SEMVER_TAG/);
    // Failure drill: Version mismatch
    assert.throws(() => validateReleaseTag('v2.0.0', rootPkg.version, changelog), /TAG_PACKAGE_MISMATCH/);
  });

  // =============================================================
  // 2. TRIVY VULNERABILITY SCANNER GATE
  // =============================================================
  console.log('\n\x1b[1m[2] Vulnerability Scanning Gate (.trivyignore)\x1b[0m');

  runTest('1. Trivy gate fails on unallowlisted HIGH/CRITICAL vulnerabilities and passes on clean scans', () => {
    const evaluateVulnerabilities = (vulns, allowlistFileContent) => {
      const allowlist = new Set(
        allowlistFileContent
          .split('\n')
          .map(l => l.trim())
          .filter(l => l && !l.startsWith('#'))
          .map(l => l.split(' ')[0])
      );

      const unallowlisted = vulns.filter(v => (v.severity === 'HIGH' || v.severity === 'CRITICAL') && !allowlist.has(v.cve));
      if (unallowlisted.length > 0) {
        throw new Error(`TRIVY_SECURITY_GATE_FAILED: Found ${unallowlisted.length} unallowlisted high/critical vulnerabilities`);
      }
      return { passed: true };
    };

    const trivyignore = fs.readFileSync(path.join(__dirname, '..', '.trivyignore'), 'utf8');
    const cleanScan = [{ cve: 'CVE-2024-0000', severity: 'HIGH' }];
    assert.strictEqual(evaluateVulnerabilities(cleanScan, trivyignore).passed, true);

    const dirtyScan = [{ cve: 'CVE-2026-9999', severity: 'CRITICAL' }];
    assert.throws(() => evaluateVulnerabilities(dirtyScan, trivyignore), /TRIVY_SECURITY_GATE_FAILED/);
  });

  // =============================================================
  // 3. IMAGE DIGEST PROMOTION EQUALITY GATE
  // =============================================================
  console.log('\n\x1b[1m[3] Exact Image Digest Promotion Enforcement (Staging -> Production)\x1b[0m');

  runTest('1. Production deployment strictly requires identical digest verified in staging', () => {
    const verifyDigestPromotion = (stagingServerDigest, prodServerDigest) => {
      if (stagingServerDigest !== prodServerDigest) {
        throw new Error('DIGEST_MISMATCH: Production deployment attempted with unverified image digest!');
      }
      return { promoted: true };
    };

    const verifiedDigest = 'sha256:4f5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f';
    const matching = verifyDigestPromotion(verifiedDigest, verifiedDigest);
    assert.strictEqual(matching.promoted, true);

    const tamperedDigest = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
    assert.throws(() => verifyDigestPromotion(verifiedDigest, tamperedDigest), /DIGEST_MISMATCH/);
  });

  // =============================================================
  // 4. CHANGELOG RELEASE NOTES EXTRACTION
  // =============================================================
  console.log('\n\x1b[1m[4] Automated CHANGELOG Release Notes Extraction\x1b[0m');

  runTest('1. Extracts accurate release notes section for tag without leaking other versions', () => {
    const extractChangelogSection = (version, changelog) => {
      const regex = new RegExp(`## \\[${version}\\][\\s\\S]*?(?=## \\[|$)`, 'i');
      const match = changelog.match(regex);
      if (!match) throw new Error(`EMPTY_CHANGELOG_SECTION: No notes for version ${version}`);
      return match[0].trim();
    };

    const changelog = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
    const notes = extractChangelogSection('1.1.0', changelog);
    assert.ok(notes.includes('Manual Contacts Engine'));
    assert.ok(notes.includes('Chat with us'));
  });

  // =============================================================
  // SUMMARY
  // =============================================================
  console.log('\n======================================================');
  console.log(`\x1b[1mRelease Workflow Verification: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('======================================================\n');

  if (failed > 0) throw new Error('Release workflow test suite failed.');
}

runReleaseWorkflowSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});

module.exports = { runReleaseWorkflowSuite };
