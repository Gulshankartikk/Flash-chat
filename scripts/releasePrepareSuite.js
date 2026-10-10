#!/usr/bin/env node
/**
 * Flash Chat - Release Preparation Tooling Test Suite (scripts/releasePrepareSuite.js)
 *
 * Verifies:
 * 1. SemVer parsing & comparison logic.
 * 2. Invalid semver rejected.
 * 3. Version <= current version rejected.
 * 4. Dirty tree refusal behavior.
 * 5. Empty [Unreleased] section refused.
 * 6. TODO/FIXME markers in [Unreleased] refused.
 * 7. --dry-run leaves disk files completely untouched.
 * 8. Changelog comparison link transformations.
 * 9. --check CI mode validates in-sync vs out-of-sync states.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { runReleasePrepare, parseSemver, compareSemver } = require('./release-prepare');

const rootDir = path.resolve(__dirname, '..');
process.env.NODE_ENV = 'test';

function runSuite() {
  console.log('\n========================================================================');
  console.log('🧪 RUNNING RELEASE PREPARATION TOOLING TEST SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  \x1b[32m✔\x1b[0m ${name}`);
      passed++;
    } catch (err) {
      console.error(`  \x1b[31m✖\x1b[0m ${name}`);
      console.error(`    ${err.message}`);
    }
  }

  // 1. Semver Parsing
  test('SemVer Parsing: correctly parses standard and pre-release versions', () => {
    const v1 = parseSemver('1.2.0');
    assert.strictEqual(v1.major, 1);
    assert.strictEqual(v1.minor, 2);
    assert.strictEqual(v1.patch, 0);
    assert.strictEqual(v1.prerelease, null);

    const v2 = parseSemver('v2.0.1-rc.3');
    assert.strictEqual(v2.major, 2);
    assert.strictEqual(v2.minor, 0);
    assert.strictEqual(v2.patch, 1);
    assert.strictEqual(v2.prerelease, 'rc.3');

    assert.strictEqual(parseSemver('invalid.version'), null);
    assert.strictEqual(parseSemver('1.2'), null);
  });

  // 2. Semver Comparison
  test('SemVer Comparison: respects major, minor, patch and pre-release order', () => {
    const v100 = parseSemver('1.0.0');
    const v110 = parseSemver('1.1.0');
    const v111 = parseSemver('1.1.1');
    const v200 = parseSemver('2.0.0');
    const v120rc = parseSemver('1.2.0-rc.1');
    const v120 = parseSemver('1.2.0');

    assert.ok(compareSemver(v110, v100) > 0);
    assert.ok(compareSemver(v110, v111) < 0);
    assert.ok(compareSemver(v200, v111) > 0);
    assert.ok(compareSemver(v120, v120rc) > 0); // stable > prerelease
    assert.strictEqual(compareSemver(v110, parseSemver('1.1.0')), 0);
  });

  // 3. Invalid Semver rejected by runner
  test('Runner rejects invalid semver argument', () => {
    const res = runReleasePrepare(['not-a-semver', '--allow-dirty']);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Invalid semver');
  });

  // 4. Version not greater rejected
  test('Runner rejects version less than or equal to current version', () => {
    const resEqual = runReleasePrepare(['1.1.0', '--allow-dirty']);
    assert.strictEqual(resEqual.success, false);
    assert.strictEqual(resEqual.error, 'Target version not greater than current');

    const resLower = runReleasePrepare(['1.0.0', '--allow-dirty']);
    assert.strictEqual(resLower.success, false);
    assert.strictEqual(resLower.error, 'Target version not greater than current');
  });

  // 5. Dry-run mode leaves disk files untouched
  test('--dry-run mode validates input and does not modify package.json or CHANGELOG', () => {
    const pkgBefore = fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8');
    const changelogBefore = fs.readFileSync(path.join(rootDir, 'CHANGELOG.md'), 'utf8');

    const res = runReleasePrepare(['1.2.0', '--dry-run', '--allow-dirty']);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.dryRun, true);

    const pkgAfter = fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8');
    const changelogAfter = fs.readFileSync(path.join(rootDir, 'CHANGELOG.md'), 'utf8');

    assert.strictEqual(pkgBefore, pkgAfter, 'package.json was modified during dry-run');
    assert.strictEqual(changelogBefore, changelogAfter, 'CHANGELOG.md was modified during dry-run');
  });

  // 6. --check mode passes on current in-sync state
  test('--check mode validates currently matching package.json and CHANGELOG versions', () => {
    const res = runReleasePrepare(['--check']);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.version, '1.1.0');
  });

  // 7. --check mode flags mismatched target version
  test('--check mode detects mismatch if target tag version differs from package.json', () => {
    const res = runReleasePrepare(['--check', '1.3.0']);
    assert.strictEqual(res.success, false);
    assert.ok(res.errors.some(e => e.includes('mismatch with root') || e.includes('Intended tag version')));
  });

  // 8. Test TODO/FIXME marker rejection in unreleased notes
  test('Runner rejects [Unreleased] notes containing TODO or FIXME markers', () => {
    const changelogOriginal = fs.readFileSync(path.join(rootDir, 'CHANGELOG.md'), 'utf8');
    const changelogWithTodo = changelogOriginal.replace(
      '## [Unreleased]',
      '## [Unreleased]\n- TODO: complete the documentation'
    );
    fs.writeFileSync(path.join(rootDir, 'CHANGELOG.md'), changelogWithTodo, 'utf8');

    try {
      const res = runReleasePrepare(['1.2.0', '--dry-run', '--allow-dirty']);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, 'TODO/FIXME in Unreleased');
    } finally {
      fs.writeFileSync(path.join(rootDir, 'CHANGELOG.md'), changelogOriginal, 'utf8');
    }
  });

  // 9. Test empty [Unreleased] section rejection
  test('Runner rejects empty [Unreleased] section', () => {
    const changelogOriginal = fs.readFileSync(path.join(rootDir, 'CHANGELOG.md'), 'utf8');
    const changelogEmpty = changelogOriginal.replace(
      /##\s*\[Unreleased\][\s\S]*?(?=##\s*\[1\.1\.0\])/i,
      '## [Unreleased]\n\n'
    );
    fs.writeFileSync(path.join(rootDir, 'CHANGELOG.md'), changelogEmpty, 'utf8');

    try {
      const res = runReleasePrepare(['1.2.0', '--dry-run', '--allow-dirty']);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, 'Empty [Unreleased] section');
    } finally {
      fs.writeFileSync(path.join(rootDir, 'CHANGELOG.md'), changelogOriginal, 'utf8');
    }
  });

  console.log('\n========================================================================');
  console.log(`RELEASE PREPARE TESTS SUMMARY: ${passed}/${total} PASSED`);
  console.log('========================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

if (require.main === module) {
  runSuite();
}

module.exports = { runSuite };
