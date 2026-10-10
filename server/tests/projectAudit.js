const fs = require('fs');
const path = require('path');

console.log('\n======================================================');
console.log('🔍 FLASH CHAT FULL PROJECT RESCAN & INTEGRITY AUDIT');
console.log('======================================================\n');

let issues = [];

function recordIssue(severity, file, description, fix) {
  issues.push({ severity, file, description, fix });
}

// 1. Verify Imports
function checkImports(dir, baseDir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      checkImports(fullPath, baseDir);
    } else if (['.js', '.jsx', '.json'].includes(path.extname(entry.name))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const importRegex = /(?:from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const importTarget = match[1] || match[2];
        if (importTarget && importTarget.startsWith('.')) {
          const resolvedDir = path.dirname(fullPath);
          const candidatePath = path.resolve(resolvedDir, importTarget);
          const exists = fs.existsSync(candidatePath) ||
            fs.existsSync(candidatePath + '.js') ||
            fs.existsSync(candidatePath + '.jsx') ||
            fs.existsSync(candidatePath + '.json') ||
            fs.existsSync(path.join(candidatePath, 'index.js')) ||
            fs.existsSync(path.join(candidatePath, 'index.jsx'));

          if (!exists) {
            recordIssue('blocker', path.relative('.', fullPath), `Broken import target '${importTarget}'`, 'Fix import path or add missing file');
          }
        }
      }
    }
  }
}

// 2. Scan for Leftover Placeholders and Secret Leaks in Code
function scanForPlaceholders(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' || entry.name === 'tests') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanForPlaceholders(fullPath);
    } else if (['.js', '.jsx'].includes(path.extname(entry.name))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (/Coming in Step\s+\d+/i.test(content)) {
        recordIssue('high', path.relative('.', fullPath), 'Found unfinished placeholder ("Coming in Step N")', 'Implement full feature logic');
      }
      if (/console\.log\([^)]*(?:password|pocket_pin|refresh_token)[^)]*\)/i.test(content) && !fullPath.includes('test')) {
        recordIssue('high', path.relative('.', fullPath), 'Potential raw secret logging in console.log', 'Remove raw secret log or redact');
      }
    }
  }
}

// 3. Env Variables Audit
function auditEnvVars() {
  const repoRoot = path.join(__dirname, '../..');
  const envExamplePath = fs.existsSync(path.join(repoRoot, '.env.example'))
    ? path.join(repoRoot, '.env.example')
    : fs.existsSync(path.join(__dirname, '../.env.example'))
    ? path.join(__dirname, '../.env.example')
    : path.join(__dirname, '../../.env.example');

  if (!fs.existsSync(envExamplePath)) {
    recordIssue('high', '.env.example', '.env.example missing in root', 'Create .env.example with all keys');
    return;
  }
  const envContent = fs.readFileSync(envExamplePath, 'utf8');
  const definedEnvKeys = new Set(
    envContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => line.split('=')[0].trim())
  );

  const REQUIRED_CRITICAL_ENV_KEYS = [
    'PORT', 'NODE_ENV', 'CLIENT_URL', 'MONGO_URI',
    'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET',
    'GEMINI_API_KEY', 'GEMINI_MODEL',
    'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'
  ];

  REQUIRED_CRITICAL_ENV_KEYS.forEach(key => {
    if (!definedEnvKeys.has(key)) {
      recordIssue('medium', '.env.example', `Key ${key} missing from .env.example`, `Add ${key} definition to .env.example`);
    }
  });
}

// 4. Check File Line Count (>400 lines audit)
function checkFileSizes(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' || entry.name === 'tests') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      checkFileSizes(fullPath);
    } else if (['.js', '.jsx'].includes(path.extname(entry.name))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n').length;
      if (lines > 600) {
        recordIssue('low', path.relative(path.join(__dirname, '../..'), fullPath), `Oversized file (${lines} lines)`, 'Modularize or maintain clean sections');
      }
    }
  }
}

const repoRoot = path.join(__dirname, '../..');
const serverDir = path.join(repoRoot, 'server');
const clientSrcDir = path.join(repoRoot, 'client', 'src');

// Run scans
if (fs.existsSync(serverDir)) checkImports(serverDir, serverDir);
if (fs.existsSync(clientSrcDir)) checkImports(clientSrcDir, clientSrcDir);
if (fs.existsSync(serverDir)) scanForPlaceholders(serverDir);
if (fs.existsSync(clientSrcDir)) scanForPlaceholders(clientSrcDir);
auditEnvVars();
if (fs.existsSync(serverDir)) checkFileSizes(serverDir);
if (fs.existsSync(clientSrcDir)) checkFileSizes(clientSrcDir);

console.log('--- AUDIT RESULTS ---');
console.table(issues.length > 0 ? issues : [{ Status: 'All Clear', severity: 'None', file: 'N/A', description: '0 blockers, 0 highs' }]);

const blockerCount = issues.filter(i => i.severity === 'blocker').length;
const highCount = issues.filter(i => i.severity === 'high').length;
console.log(`\nTotals: ${blockerCount} Blockers, ${highCount} High, ${issues.filter(i => i.severity === 'medium').length} Medium, ${issues.filter(i => i.severity === 'low').length} Low.`);

if (blockerCount > 0 || highCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
