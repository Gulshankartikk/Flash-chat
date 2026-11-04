#!/usr/bin/env node
/**
 * Flash Chat - Release Preparation Tooling (scripts/release-prepare.js)
 *
 * Validates readiness, updates version numbers in package.json files,
 * transforms CHANGELOG.md [Unreleased] to a versioned release,
 * updates compare links, and runs consistency gates.
 *
 * Usage:
 *   node scripts/release-prepare.js <version> [--dry-run] [--check] [--allow-dirty] [--skip-checks]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const REPO_URL = 'https://github.com/Gulshankartikk/Flash-chat';

// Parse semver string: major.minor.patch[-prerelease]
function parseSemver(vStr) {
  if (!vStr || typeof vStr !== 'string') return null;
  const clean = vStr.trim().replace(/^v/, '');
  const match = clean.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return {
    raw: clean,
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null
  };
}

// Compare two parsed semvers (returns >0 if a > b, <0 if a < b, 0 if equal)
function compareSemver(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (a.prerelease === null && b.prerelease !== null) return 1; // 1.0.0 > 1.0.0-rc.1
  if (a.prerelease !== null && b.prerelease === null) return -1;
  if (a.prerelease && b.prerelease) {
    return a.prerelease.localeCompare(b.prerelease);
  }
  return 0;
}

function getGitBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function isGitDirty() {
  try {
    const status = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf8' }).trim();
    return status.length > 0;
  } catch {
    return false;
  }
}

function runReleasePrepare(args = process.argv.slice(2)) {
  const isDryRun = args.includes('--dry-run');
  const isCheckMode = args.includes('--check');
  const allowDirty = args.includes('--allow-dirty');
  const skipChecks = args.includes('--skip-checks');
  
  const versionArg = args.find(a => !a.startsWith('--'));

  console.log('\n========================================================================');
  console.log('🚀 FLASH CHAT RELEASE PREPARATION & CONSISTENCY SUITE');
  console.log('========================================================================\n');

  // Read current package.json
  const rootPkgPath = path.join(rootDir, 'package.json');
  const serverPkgPath = path.join(rootDir, 'server/package.json');
  const clientPkgPath = path.join(rootDir, 'client/package.json');
  const changelogPath = path.join(rootDir, 'CHANGELOG.md');

  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
  const serverPkg = JSON.parse(fs.readFileSync(serverPkgPath, 'utf8'));
  const clientPkg = JSON.parse(fs.readFileSync(clientPkgPath, 'utf8'));

  const currentVersionStr = rootPkg.version;
  const currentSemver = parseSemver(currentVersionStr);

  console.log(`📌 Current project version: v${currentVersionStr}`);

  // --- CHECK MODE (CI Gate) ---
  if (isCheckMode) {
    console.log('🔍 Running in --check (CI verification) mode...\n');
    let checkErrors = [];

    // 1. Check version equality across packages
    if (serverPkg.version !== currentVersionStr) {
      checkErrors.push(`server/package.json version (${serverPkg.version}) mismatch with root (${currentVersionStr})`);
    }
    if (clientPkg.version !== currentVersionStr) {
      checkErrors.push(`client/package.json version (${clientPkg.version}) mismatch with root (${currentVersionStr})`);
    }

    // 2. If target version passed, verify it matches
    if (versionArg) {
      const targetClean = versionArg.replace(/^v/, '');
      if (currentVersionStr !== targetClean) {
        checkErrors.push(`Intended tag version (${targetClean}) does not match package.json version (${currentVersionStr})`);
      }
    }

    // 3. Verify CHANGELOG has entry for currentVersionStr
    const changelog = fs.readFileSync(changelogPath, 'utf8');
    const versionHeaderRegex = new RegExp(`##\\s*\\[${currentVersionStr.replace('.', '\\.')}\\]`, 'i');
    if (!versionHeaderRegex.test(changelog)) {
      checkErrors.push(`CHANGELOG.md is missing release entry for ## [${currentVersionStr}]`);
    }

    if (checkErrors.length > 0) {
      console.error('❌ CI Release Consistency Check FAILED:');
      checkErrors.forEach(err => console.error(`  - ${err}`));
      if (process.env.NODE_ENV !== 'test') process.exit(1);
      return { success: false, errors: checkErrors };
    }

    console.log('✅ CI Release Consistency Check PASSED: Versions & Changelog are in sync!');
    return { success: true, version: currentVersionStr };
  }

  // --- PREPARATION MODE ---
  if (!versionArg) {
    console.error('❌ Error: Target version is required. Example: npm run release:prepare -- 1.2.0');
    if (process.env.NODE_ENV !== 'test') process.exit(1);
    return { success: false, error: 'Missing target version' };
  }

  const targetSemver = parseSemver(versionArg);
  if (!targetSemver) {
    console.error(`❌ Error: "${versionArg}" is not a valid Semantic Version (e.g. 1.2.0, 1.2.0-rc.1)`);
    if (process.env.NODE_ENV !== 'test') process.exit(1);
    return { success: false, error: 'Invalid semver' };
  }

  // Check version > current
  if (compareSemver(targetSemver, currentSemver) <= 0) {
    console.error(`❌ Error: Target version (${targetSemver.raw}) must be greater than current version (${currentSemver.raw})`);
    if (process.env.NODE_ENV !== 'test') process.exit(1);
    return { success: false, error: 'Target version not greater than current' };
  }

  // Check git branch
  const branch = getGitBranch();
  const allowedBranches = ['main', 'master', 'release', 'hotfix'];
  const isAllowedBranch = allowedBranches.some(b => branch === b || branch.startsWith('release/') || branch.startsWith('hotfix/'));
  if (!isAllowedBranch && branch !== 'HEAD' && !allowDirty) {
    console.warn(`⚠️ Warning: Current branch "${branch}" is not main or a release/hotfix branch.`);
  }

  // Check git dirty tree
  if (isGitDirty() && !allowDirty) {
    console.error('❌ Error: Working tree contains uncommitted changes. Commit or stash them before preparing a release.');
    if (process.env.NODE_ENV !== 'test') process.exit(1);
    return { success: false, error: 'Git tree is dirty' };
  }

  // Read and validate CHANGELOG
  const changelogContent = fs.readFileSync(changelogPath, 'utf8');
  const unreleasedMatch = changelogContent.match(/##\s*\[Unreleased\]([\s\S]*?)(?=##\s*\[|\n\[Unreleased\]:|$)/i);

  if (!unreleasedMatch) {
    console.error('❌ Error: CHANGELOG.md does not have an "## [Unreleased]" section.');
    if (process.env.NODE_ENV !== 'test') process.exit(1);
    return { success: false, error: 'Missing [Unreleased] in CHANGELOG.md' };
  }

  const unreleasedBody = unreleasedMatch[1].trim();
  if (!unreleasedBody || unreleasedBody.length < 10) {
    console.error('❌ Error: CHANGELOG.md "## [Unreleased]" section is empty! Please describe your changes before releasing.');
    if (process.env.NODE_ENV !== 'test') process.exit(1);
    return { success: false, error: 'Empty [Unreleased] section' };
  }

  if (/TODO|FIXME/i.test(unreleasedBody)) {
    console.error('❌ Error: CHANGELOG.md "## [Unreleased]" section contains unresolved TODO or FIXME markers.');
    if (process.env.NODE_ENV !== 'test') process.exit(1);
    return { success: false, error: 'TODO/FIXME in Unreleased' };
  }

  console.log(`✅ Git status clean and [Unreleased] notes validated (${unreleasedBody.split('\n').length} lines).`);

  const today = new Date().toISOString().slice(0, 10);
  const newReleaseHeader = `## [${targetSemver.raw}] - ${today}\n\n${unreleasedBody}\n`;

  // Build transformed CHANGELOG
  let updatedChangelog = changelogContent.replace(
    /##\s*\[Unreleased\][\s\S]*?(?=##\s*\[)/i,
    `## [Unreleased]\n\n${newReleaseHeader}\n`
  );

  // Update compare links at the bottom
  // Format:
  // [Unreleased]: https://github.com/Gulshankartikk/Flash-chat/compare/v1.2.0...HEAD
  // [1.2.0]: https://github.com/Gulshankartikk/Flash-chat/compare/v1.1.0...v1.2.0
  const unreleasedLinkRegex = /\[Unreleased\]:\s*https:\/\/github\.com\/[^\/]+\/[^\/]+\/compare\/[^\s]+/;
  const newUnreleasedLink = `[Unreleased]: ${REPO_URL}/compare/v${targetSemver.raw}...HEAD`;
  const newVersionLink = `[${targetSemver.raw}]: ${REPO_URL}/compare/v${currentVersionStr}...v${targetSemver.raw}`;

  if (unreleasedLinkRegex.test(updatedChangelog)) {
    updatedChangelog = updatedChangelog.replace(
      unreleasedLinkRegex,
      `${newUnreleasedLink}\n${newVersionLink}`
    );
  } else {
    updatedChangelog += `\n\n${newUnreleasedLink}\n${newVersionLink}\n`;
  }

  console.log(`\n📦 Prepared version bump: v${currentVersionStr} ➔ v${targetSemver.raw}`);

  if (isDryRun) {
    console.log('\n--- [DRY RUN DIFF PREVIEW] ---');
    console.log(`\n[package.json / server/package.json / client/package.json]`);
    console.log(`- "version": "${currentVersionStr}"`);
    console.log(`+ "version": "${targetSemver.raw}"`);
    console.log(`\n[CHANGELOG.md]`);
    console.log(`+ ## [${targetSemver.raw}] - ${today}`);
    console.log(unreleasedBody);
    console.log(`+ ${newUnreleasedLink}`);
    console.log(`+ ${newVersionLink}`);
    console.log('\n--- [END OF DRY RUN DIFF] ---\n');
    console.log('ℹ️ Dry run completed. No files were modified on disk.');
    return { success: true, dryRun: true, targetVersion: targetSemver.raw };
  }

  // Apply Changes to Disk
  rootPkg.version = targetSemver.raw;
  serverPkg.version = targetSemver.raw;
  clientPkg.version = targetSemver.raw;

  fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n', 'utf8');
  fs.writeFileSync(serverPkgPath, JSON.stringify(serverPkg, null, 2) + '\n', 'utf8');
  fs.writeFileSync(clientPkgPath, JSON.stringify(clientPkg, null, 2) + '\n', 'utf8');
  fs.writeFileSync(changelogPath, updatedChangelog, 'utf8');

  // Update lockfiles if they exist
  const rootLockPath = path.join(rootDir, 'package-lock.json');
  if (fs.existsSync(rootLockPath)) {
    try {
      const lock = JSON.parse(fs.readFileSync(rootLockPath, 'utf8'));
      lock.version = targetSemver.raw;
      if (lock.packages && lock.packages['']) {
        lock.packages[''].version = targetSemver.raw;
      }
      fs.writeFileSync(rootLockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8');
    } catch {}
  }

  console.log('✔ Updated root, server, and client package.json versions');
  console.log('✔ Transformed CHANGELOG.md [Unreleased] to release notes');

  // Run Consistency Gates (unless skipped)
  if (!skipChecks) {
    console.log('\n🛡️ Running pre-release quality checks...');
    try {
      execSync('npm run docs:check', { cwd: rootDir, stdio: 'inherit' });
      execSync('npm --prefix client run lint:tokens', { cwd: rootDir, stdio: 'inherit' });
      execSync('npm --prefix client run lint:brand', { cwd: rootDir, stdio: 'inherit' });
      console.log('✔ All quality linters and documentation checks passed.');
    } catch (e) {
      console.error('❌ Quality check failed during release preparation!');
      if (process.env.NODE_ENV !== 'test') process.exit(1);
      return { success: false, error: 'Quality check failed' };
    }
  }

  console.log('\n========================================================================');
  console.log(`🎉 RELEASE v${targetSemver.raw} PREPARED SUCCESSFULLY!`);
  console.log('========================================================================');
  console.log('\nNext steps (NEVER auto-committed; review and run manually):');
  console.log(`  1. Review changes:        git diff`);
  console.log(`  2. Stage files:           git add package.json server/package.json client/package.json package-lock.json CHANGELOG.md`);
  console.log(`  3. Commit release:        git commit -m "chore(release): v${targetSemver.raw}"`);
  console.log(`  4. Create annotated tag:  git tag -a v${targetSemver.raw} -m "Release v${targetSemver.raw}"`);
  console.log(`  5. Push to GitHub:        git push origin main --tags`);
  console.log('========================================================================\n');

  return { success: true, targetVersion: targetSemver.raw };
}

if (require.main === module) {
  runReleasePrepare();
}

module.exports = {
  runReleasePrepare,
  parseSemver,
  compareSemver
};
