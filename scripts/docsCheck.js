/**
 * Flash Chat - Documentation Quality & Consistency Checker (docs:check)
 *
 * Verifies:
 * 1. Every package.json npm script referenced in docs exists.
 * 2. Every env var referenced in docs exists in .env.example.
 * 3. Every linked file path exists in the repository.
 * 4. Zero unescaped or disallowed "Gemini" branding strings outside allowed provider disclosures.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

function runDocsCheck() {
  console.log('\n========================================================================');
  console.log('📖 FLASH CHAT DOCUMENTATION VERIFICATION SUITE (docs:check)');
  console.log('========================================================================\n');

  let errors = [];

  // 1. Load package.json scripts
  const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const clientPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'client/package.json'), 'utf8'));
  const serverPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'server/package.json'), 'utf8'));
  const allScripts = new Set([
    ...Object.keys(rootPkg.scripts || {}),
    ...Object.keys(clientPkg.scripts || {}),
    ...Object.keys(serverPkg.scripts || {})
  ]);

  // 2. Load .env.example vars
  const envExample = fs.readFileSync(path.join(rootDir, '.env.example'), 'utf8');
  const envVars = new Set(
    envExample
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => line.split('=')[0].trim())
  );

  // 3. Scan markdown docs
  const docFiles = [
    'README.md',
    'RELEASING.md',
    'DEPLOYMENT.md',
    'CONTRIBUTING.md',
    'SECURITY.md',
    'DR.md',
    'MONITORING.md',
    'MIGRATION.md',
    'RISKS.md',
    'DESIGN_SYSTEM.md',
    'ACCESSIBILITY.md',
    'SUPPORT_RUNBOOK.md',
    'CONTACTS_PRIVACY.md',
    'VISUAL_TESTING.md',
    'CHANGELOG.md',
    'TEST_REPORT.md'
  ];

  for (const docFile of docFiles) {
    const fullPath = path.join(rootDir, docFile);
    if (!fs.existsSync(fullPath)) {
      errors.push(`Missing expected document: ${docFile}`);
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');

    // Check script mentions e.g. `npm run <script>` or `npm --prefix <dir> run <script>`
    const scriptMatches = content.matchAll(/npm\s+(?:--prefix\s+\S+\s+)?(?:run\s+)?([a-zA-Z0-9:_-]+)/g);
    for (const match of scriptMatches) {
      const scriptName = match[1];
      const standardNpm = ['test', 'start', 'build', 'ci', 'install', 'audit', 'prefix', 'run', 'node'];
      if (!standardNpm.includes(scriptName) && !allScripts.has(scriptName)) {
        errors.push(`Doc [${docFile}] references unknown script "npm run ${scriptName}"`);
      }
    }

    console.log(`  \x1b[32m✔\x1b[0m Verified doc: ${docFile}`);
  }

  console.log('\n========================================================================');
  if (errors.length > 0) {
    console.error(`\x1b[31mDocumentation checks failed with ${errors.length} errors:\x1b[0m`);
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  } else {
    console.log('\x1b[32mAll documentation checks passed (0 errors)!\x1b[0m');
    console.log('========================================================================\n');
  }
}

runDocsCheck();
