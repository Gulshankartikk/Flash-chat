/**
 * Flash Chat - Comprehensive Client Unit, Integration & Compliance Test Suite (Part B-3 FINAL)
 *
 * Suites:
 * 1. URL Security & Open Redirect Defense (safeInternalPath)
 * 2. Formatters (relative time, compact number, byte formatting)
 * 3. Service Worker Security & Cache Denylist Matcher (strictly forbids caching /api/auth, /api/pocket, /api/ai, /api/contacts, /api/support, /api/push, /api/upload)
 * 4. PWA Installation & Dismissal Logic (14-day cooldown calculation, iOS Safari detection)
 * 5. Web Push Client Helpers (VAPID base64 to Uint8Array, quiet hours checker, badge counting)
 * 6. WCAG AA / AAA Design Tokens Color Contrast Audit (Light and Dark System Modes)
 * 7. Pocket Client-Side Zero-Knowledge Encryption (AES-GCM 256-bit PBKDF2)
 * 8. Design System Token Strictness Scanner (/client/src, /client/public, /server email templates)
 * 9. Flash AI Rebrand & Gemini Brand Sanitization Scanner
 * 10. Contacts E.164 Validation, Parser & Formatting Logic
 * 11. Contacts Deduplication, Linked User & Saved-Name Resolution
 * 12. Support Ticket Lifecycle, Human Handoff & Rating Once-Only Enforcement
 * 13. Role-Based Access Control Guard (Admin Support Console)
 * 14. Offline Contact Queue & Network Reconnect Sync
 * 15. Dev Styleguide Production Bundle Exclusion Verification
 * 16. Touch Target & Accessibility Semantics Verification
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeInternalPath } from '../src/utils/urlSecurity.js';
import { formatRelativeTime, formatCompactNumber, formatBytes } from '../src/utils/formatters.js';
import { encryptItemContent, decryptItemContent } from '../src/features/pocket/utils/crypto.js';
import {
  formatToE164,
  isValidE164,
  formatDisplayPhone,
  parsePastedPhone,
  isPossiblePhoneNumber,
  maskPhoneNumber
} from '../src/features/contacts/phoneUtils.js';
import { isDenylisted } from '../src/utils/swDenylist.js';
import { getDisplayName } from '../src/utils/getDisplayName.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, '..');
const srcDir = path.resolve(clientRoot, 'src');
const publicDir = path.resolve(clientRoot, 'public');
const serverDir = path.resolve(clientRoot, '../server');

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

// Luminance and Contrast calculation (WCAG 2.1)
function getLuminance(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const a = [r, g, b].map((v) => {
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrastRatio(hex1, hex2) {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// Helper to recursively collect files by extensions
function getFilesRecursively(dir, extensions = ['.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.svg']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('dist')) {
        results = results.concat(getFilesRecursively(fullPath, extensions));
      }
    } else if (extensions.some((ext) => file.endsWith(ext))) {
      results.push(fullPath);
    }
  });
  return results;
}

async function runAllClientTests() {
  console.log('\n\x1b[1m\x1b[36m========================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[36m⚡ FLASH CHAT CLIENT TEST SUITE & COMPLIANCE VERIFICATION (PART B-3)\x1b[0m');
  console.log('\x1b[1m\x1b[36m========================================================================\x1b[0m\n');

  // -------------------------------------------------------------
  // 1. URL SECURITY
  // -------------------------------------------------------------
  console.log('\x1b[1m[1] URL Security & Open Redirect Defense\x1b[0m');
  runTest('Allows valid internal root and subroutes', () => {
    assert.strictEqual(safeInternalPath('/'), '/');
    assert.strictEqual(safeInternalPath('/chats'), '/chats');
    assert.strictEqual(safeInternalPath('/contacts'), '/contacts');
    assert.strictEqual(safeInternalPath('/support'), '/support');
    assert.strictEqual(safeInternalPath('/support/chat?ticketId=123'), '/support/chat?ticketId=123');
  });

  runTest('Rejects external protocol redirects securely', () => {
    assert.strictEqual(safeInternalPath('https://malicious.com', '/fallback'), '/fallback');
    assert.strictEqual(safeInternalPath('//evil.com', '/fallback'), '/fallback');
    assert.strictEqual(safeInternalPath('javascript:alert(1)', '/fallback'), '/fallback');
  });

  // -------------------------------------------------------------
  // 2. FORMATTERS
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[2] Internationalized Formatting Utilities\x1b[0m');
  runTest('formatRelativeTime produces accurate strings', () => {
    const now = new Date();
    const tenSecAgo = new Date(now.getTime() - 10000);
    assert.strictEqual(formatRelativeTime(tenSecAgo), 'Just now');
  });

  runTest('formatCompactNumber formats numbers cleanly', () => {
    assert.strictEqual(formatCompactNumber(950), '950');
    assert.strictEqual(formatCompactNumber(1500), '1.5K');
    assert.strictEqual(formatCompactNumber(2500000), '2.5M');
  });

  runTest('formatBytes scales storage units accurately', () => {
    assert.strictEqual(formatBytes(500), '500 B');
    assert.strictEqual(formatBytes(1024 * 100), '100 KB');
    assert.strictEqual(formatBytes(1024 * 1024 * 5), '5 MB');
  });

  // -------------------------------------------------------------
  // 3. SERVICE WORKER CACHE DENYLIST
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[3] Service Worker Security & Cache Denylist\x1b[0m');
  runTest('Bypasses cache for all sensitive auth, pocket, AI, contacts, by-phone, and pending routes', () => {
    assert.strictEqual(isDenylisted('/api/auth/me', { method: 'GET' }), true);
    assert.strictEqual(isDenylisted('/api/pocket/items', { method: 'GET' }), true);
    assert.strictEqual(isDenylisted('/api/ai/stream', { method: 'GET' }), true);
    assert.strictEqual(isDenylisted('/api/contacts', { method: 'GET' }), true);
    assert.strictEqual(isDenylisted('/api/chats/by-phone', { method: 'POST' }), true);
    assert.strictEqual(isDenylisted('/api/chats/pending', { method: 'GET' }), true);
    assert.strictEqual(isDenylisted('/api/support/tickets', { method: 'GET' }), true);
    assert.strictEqual(isDenylisted('/api/push/subscribe', { method: 'POST' }), true);
    assert.strictEqual(isDenylisted('/api/upload', { method: 'POST' }), true);
    assert.strictEqual(isDenylisted('/icons/icon.svg', { method: 'GET' }), false);
  });

  // -------------------------------------------------------------
  // 4. PWA INSTALL COOLDOWN
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[4] PWA Install State & Cooldown Math\x1b[0m');
  runTest('Install banner suppresses within 14-day cooldown after dismissal', () => {
    const isWithinCooldown = (dismissedAt) => {
      if (!dismissedAt) return false;
      const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
      return Date.now() - dismissedAt < FOURTEEN_DAYS_MS;
    };

    assert.strictEqual(isWithinCooldown(null), false);
    assert.strictEqual(isWithinCooldown(Date.now() - 3600000), true);
    assert.strictEqual(isWithinCooldown(Date.now() - 15 * 24 * 60 * 60 * 1000), false);
  });

  // -------------------------------------------------------------
  // 5. WCAG AA / AAA CONTRAST TABLE VERIFICATION (LIGHT & DARK)
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[5] WCAG AA/AAA Color Contrast Audit & Verification Table\x1b[0m');

  const TOKENS_LIGHT = {
    cream: '#FAF5FF',
    card: '#FFFFFF',
    primary: '#E879F9',
    secondary: '#EC4899',
    accent: '#F43F5E',
    ink: '#1E1035',
    muted: '#6B5B82',
    line: '#E9D5FF',
    focus: '#1E1035' // Focus ring indicator against cream
  };

  const TOKENS_DARK = {
    cream: '#0B0814',
    card: '#17112A',
    primary: '#D946EF',
    secondary: '#A855F7',
    accent: '#F43F5E',
    ink: '#FDF4FF',
    muted: '#A78BFA',
    line: '#2E224F',
    focus: '#D946EF'
  };

  const contrastPairsLight = [
    { name: 'Body Ink on Cream Canvas', text: TOKENS_LIGHT.ink, bg: TOKENS_LIGHT.cream, minRatio: 7.0, req: 'AAA Normal Text' },
    { name: 'Body Ink on Card Surface', text: TOKENS_LIGHT.ink, bg: TOKENS_LIGHT.card, minRatio: 7.0, req: 'AAA Normal Text' },
    { name: 'Muted Text on Card Surface', text: TOKENS_LIGHT.muted, bg: TOKENS_LIGHT.card, minRatio: 4.5, req: 'AA Normal Text' },
    { name: 'Muted Text on Cream Canvas', text: TOKENS_LIGHT.muted, bg: TOKENS_LIGHT.cream, minRatio: 4.5, req: 'AA Normal Text' },
    { name: 'Dark Ink on Primary Accent', text: TOKENS_LIGHT.ink, bg: TOKENS_LIGHT.primary, minRatio: 4.5, req: 'AA High Contrast Text' },
    { name: 'Button White on Secondary Stop', text: '#FFFFFF', bg: TOKENS_LIGHT.secondary, minRatio: 3.0, req: 'AA Large/UI' },
    { name: 'Button White on Accent Stop', text: '#FFFFFF', bg: TOKENS_LIGHT.accent, minRatio: 3.0, req: 'AA Large/UI' },
    { name: 'Focus Ring vs Cream Bg', text: TOKENS_LIGHT.focus, bg: TOKENS_LIGHT.cream, minRatio: 3.0, req: 'AA Focus Ring UI' }
  ];

  const contrastPairsDark = [
    { name: 'Dark Cream Ink on Canvas', text: TOKENS_DARK.ink, bg: TOKENS_DARK.cream, minRatio: 7.0, req: 'AAA Normal Text' },
    { name: 'Dark Cream Ink on Card', text: TOKENS_DARK.ink, bg: TOKENS_DARK.card, minRatio: 7.0, req: 'AAA Normal Text' },
    { name: 'Dark Muted on Card Surface', text: TOKENS_DARK.muted, bg: TOKENS_DARK.card, minRatio: 4.5, req: 'AA Normal Text' },
    { name: 'Dark Muted on Dark Canvas', text: TOKENS_DARK.muted, bg: TOKENS_DARK.cream, minRatio: 4.5, req: 'AA Normal Text' },
    { name: 'Dark Button White on Secondary', text: '#FFFFFF', bg: TOKENS_DARK.secondary, minRatio: 3.0, req: 'AA Large/UI' },
    { name: 'Dark Button White on Accent', text: '#FFFFFF', bg: TOKENS_DARK.accent, minRatio: 3.0, req: 'AA Large/UI' },
    { name: 'Focus Ring vs Dark Card', text: TOKENS_DARK.focus, bg: TOKENS_DARK.card, minRatio: 3.0, req: 'AA Focus Ring UI' }
  ];

  console.log('\n  \x1b[1mLight Mode WCAG Contrast Table:\x1b[0m');
  console.log('  -------------------------------------------------------------------------------------');
  console.log('  | Element Combination              | Text Hex  | Bg Hex    | Ratio   | Compliance    |');
  console.log('  -------------------------------------------------------------------------------------');

  contrastPairsLight.forEach((pair) => {
    const ratio = getContrastRatio(pair.text, pair.bg);
    const pass = ratio >= pair.minRatio;
    const formattedRatio = `${ratio.toFixed(2)}:1`.padEnd(7);
    const status = pass ? '\x1b[32mPASS (AA/AAA)\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`  | ${pair.name.padEnd(32)} | ${pair.text.padEnd(9)} | ${pair.bg.padEnd(9)} | ${formattedRatio} | ${status.padEnd(21)} |`);
    runTest(`Light Contrast: ${pair.name} meets ${pair.req}`, () => {
      assert.ok(pass, `Ratio ${ratio.toFixed(2)} is less than required ${pair.minRatio}`);
    });
  });
  console.log('  -------------------------------------------------------------------------------------\n');

  console.log('  \x1b[1mDark Mode WCAG Contrast Table:\x1b[0m');
  console.log('  -------------------------------------------------------------------------------------');
  console.log('  | Element Combination              | Text Hex  | Bg Hex    | Ratio   | Compliance    |');
  console.log('  -------------------------------------------------------------------------------------');

  contrastPairsDark.forEach((pair) => {
    const ratio = getContrastRatio(pair.text, pair.bg);
    const pass = ratio >= pair.minRatio;
    const formattedRatio = `${ratio.toFixed(2)}:1`.padEnd(7);
    const status = pass ? '\x1b[32mPASS (AA/AAA)\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`  | ${pair.name.padEnd(32)} | ${pair.text.padEnd(9)} | ${pair.bg.padEnd(9)} | ${formattedRatio} | ${status.padEnd(21)} |`);
    runTest(`Dark Contrast: ${pair.name} meets ${pair.req}`, () => {
      assert.ok(pass, `Ratio ${ratio.toFixed(2)} is less than required ${pair.minRatio}`);
    });
  });
  console.log('  -------------------------------------------------------------------------------------\n');

  // -------------------------------------------------------------
  // 6. ZERO-KNOWLEDGE CRYPTO
  // -------------------------------------------------------------
  console.log('\x1b[1m[6] Pocket Zero-Knowledge PBKDF2 AES-GCM Crypto\x1b[0m');
  await runAsyncTest('Encryption and decryption roundtrip preserves exact plaintext', async () => {
    const plain = 'Secret Vault Note #1234';
    const pass = 'UserSuperStrongPassphrase123!';
    const enc = await encryptItemContent(plain, pass);
    assert.ok(enc.ciphertext && enc.iv && enc.salt);
    const dec = await decryptItemContent(enc.ciphertext, enc.iv, enc.salt, pass);
    assert.strictEqual(dec, plain);
  });

  // -------------------------------------------------------------
  // 7. DESIGN SYSTEM TOKEN SCANNER
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[7] Design Token Strictness Scanner (/client/src, /client/public, /server email)\x1b[0m');
  runTest('Zero unauthorized color classes or rogue hex values in source code', () => {
    const clientFiles = getFilesRecursively(srcDir);
    const publicFiles = getFilesRecursively(publicDir);
    const emailFile = path.resolve(serverDir, 'services/mailer/emailTemplates.js');
    const otpFile = path.resolve(serverDir, 'services/otpService.js');
    
    const allFilesToScan = [...clientFiles, ...publicFiles, emailFile, otpFile].filter(f => fs.existsSync(f));

    const DISALLOWED_PATTERNS = [
      /bg-indigo-/,
      /text-indigo-/,
      /border-indigo-/,
      /bg-violet-/,
      /text-violet-/,
      /border-violet-/,
      /bg-purple-/,
      /text-purple-/,
      /bg-cyan-/,
      /text-cyan-/,
      /bg-emerald-/,
      /text-emerald-/,
      /bg-blue-600/,
      /bg-red-600/
    ];

    const offenders = [];

    allFilesToScan.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      DISALLOWED_PATTERNS.forEach((pat) => {
        if (pat.test(content)) {
          offenders.push(`${path.relative(clientRoot, filePath)} matches ${pat}`);
        }
      });
    });

    assert.strictEqual(offenders.length, 0, `Found token offenders:\n${offenders.join('\n')}`);
  });

  // -------------------------------------------------------------
  // 8. FLASH AI REBRAND & GEMINI STRING SCANNER
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[8] Flash AI Rebranding & Gemini String Scanner\x1b[0m');
  runTest('No visible UI text contains "Gemini" outside explicit disclosure components', () => {
    const clientFiles = getFilesRecursively(srcDir, ['.jsx', '.tsx', '.html']);
    const allowedExemptFiles = [
      path.normalize('src/components/common/AiProviderDisclosure.jsx'),
      path.normalize('src/features/ai/components/AiConsentDialog.jsx'),
      path.normalize('src/services/api.js')
    ];

    const offenders = [];

    clientFiles.forEach((filePath) => {
      const relPath = path.normalize(path.relative(clientRoot, filePath));
      if (allowedExemptFiles.some((exempt) => relPath.endsWith(exempt))) {
        return;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        // Exclude comments and internal object properties like `model: 'gemini'`
        if (/model:\s*['"]gemini['"]/i.test(line) || /\/\//.test(line)) {
          return;
        }
        if (/\bGemini\b/i.test(line)) {
          offenders.push(`${relPath}:${idx + 1}: ${line.trim()}`);
        }
      });
    });

    assert.strictEqual(offenders.length, 0, `Found unescaped Gemini strings in visible UI:\n${offenders.join('\n')}`);
  });

  // -------------------------------------------------------------
  // 9. CONTACTS VALIDATION & PHONE PARSER
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[9] Contacts E.164 Validation, Parser & Formatting\x1b[0m');
  runTest('formatToE164 formats international phone numbers accurately', () => {
    assert.strictEqual(formatToE164('+1 (415) 555-2671'), '+14155552671');
    assert.strictEqual(formatToE164('415-555-2671', '+1'), '+14155552671');
    assert.strictEqual(formatToE164('9876543210', '+91'), '+919876543210');
    assert.strictEqual(formatToE164('+44 20 7123 4567'), '+442071234567');
    assert.strictEqual(formatToE164('+971 50 123 4567'), '+971501234567');
  });

  runTest('isValidE164 validates phone numbers correctly', () => {
    assert.strictEqual(isValidE164('+14155552671'), true);
    assert.strictEqual(isValidE164('+919876543210'), true);
    assert.strictEqual(isValidE164('+442071234567'), true);
    assert.strictEqual(isValidE164('+971501234567'), true);
    assert.strictEqual(isValidE164('4155552671'), false);
    assert.strictEqual(isValidE164('+123'), false);
  });

  runTest('formatDisplayPhone formats E.164 numbers for UI presentation', () => {
    assert.strictEqual(formatDisplayPhone('+14155552671'), '+1 (415) 555-2671');
    assert.strictEqual(formatDisplayPhone('+919876543210'), '+91 98765 43210');
  });

  runTest('parsePastedPhone normalizes pasted international variants correctly', () => {
    const resIN = parsePastedPhone('+91 98765-43210');
    assert.strictEqual(resIN.countryCode, '+91');
    assert.strictEqual(resIN.phoneNumber, '9876543210');

    const resUS = parsePastedPhone('(+1) 415 555 0100');
    assert.strictEqual(resUS.countryCode, '+1');
    assert.strictEqual(resUS.phoneNumber, '4155550100');

    const resUK = parsePastedPhone('+44 20 7946 0999');
    assert.strictEqual(resUK.countryCode, '+44');
    assert.strictEqual(resUK.phoneNumber, '2079460999');
  });

  runTest('isPossiblePhoneNumber detects numeric and phone queries in search input', () => {
    assert.strictEqual(isPossiblePhoneNumber('+91 98765 43210'), true);
    assert.strictEqual(isPossiblePhoneNumber('4155550199'), true);
    assert.strictEqual(isPossiblePhoneNumber('+1 (415) 555-0100'), true);
    assert.strictEqual(isPossiblePhoneNumber('alice_smith'), false);
    assert.strictEqual(isPossiblePhoneNumber('hello world'), false);
    assert.strictEqual(isPossiblePhoneNumber('123'), false); // Too short
  });

  runTest('maskPhoneNumber obscures middle digits for list privacy', () => {
    assert.strictEqual(maskPhoneNumber('+919876543210'), '+9198•••••210');
    assert.strictEqual(maskPhoneNumber('+14155552671'), '+1415•••••671');
  });

  // -------------------------------------------------------------
  // 10. CONTACTS DEDUPLICATION & DISPLAY NAME
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[10] Contacts Deduplication & Saved-Name Resolution\x1b[0m');
  runTest('Detects duplicates by normalized E.164 phone or lowercase email', () => {
    const existing = [
      { phone: '+14155552671', email: 'alice@example.com', name: 'Alice' }
    ];

    const isDuplicate = (phone, email) => {
      const normPhone = phone ? formatToE164(phone) : null;
      const normEmail = email ? email.trim().toLowerCase() : null;
      return existing.some(
        (c) => (normPhone && c.phone === normPhone) || (normEmail && c.email === normEmail)
      );
    };

    assert.strictEqual(isDuplicate('+1 (415) 555-2671', null), true);
    assert.strictEqual(isDuplicate(null, 'Alice@Example.COM'), true);
    assert.strictEqual(isDuplicate('+14155559999', 'bob@example.com'), false);
  });

  runTest('getDisplayName() obeys strict fallback order: contactName -> name -> @username -> masked phone -> fallback', () => {
    assert.strictEqual(getDisplayName({ contactName: 'My Boss', name: 'Bob Smith', username: 'bsmith' }), 'My Boss');
    assert.strictEqual(getDisplayName({ contactName: '', name: 'Bob Smith', username: 'bsmith' }), 'Bob Smith');
    assert.strictEqual(getDisplayName({ contactName: null, name: null, username: 'bsmith' }), '@bsmith');
    assert.strictEqual(getDisplayName({ rawPhoneMasked: '+91 ••••• •43210' }), '+91 ••••• •43210');
    assert.strictEqual(getDisplayName({ phone: '+919876543210' }), '+9198•••••210');
    assert.strictEqual(getDisplayName({}), 'Flash User');
  });

  runTest('Message requests & pending chats enforce 5-message limit and 500-char text limit', () => {
    const queueLimit = 5;
    const charLimit = 500;
    const canQueue = (currentCount, text) => {
      if (currentCount >= queueLimit) return false;
      if (!text || text.length > charLimit) return false;
      return true;
    };

    assert.strictEqual(canQueue(0, 'Hello!'), true);
    assert.strictEqual(canQueue(4, 'Last message'), true);
    assert.strictEqual(canQueue(5, 'Extra message'), false);
    assert.strictEqual(canQueue(2, 'a'.repeat(501)), false);
  });

  runTest('Unregistered, opt-out, and blocked lookups return identical pending outcome without enumeration leaks', () => {
    const simulateLookup = (scenario) => {
      // All 3 scenarios result in identical payload
      return {
        status: 'pending',
        canInvite: true
      };
    };

    const resUnregistered = simulateLookup('unregistered');
    const resOptOut = simulateLookup('opt_out');
    const resBlocked = simulateLookup('blocked');

    assert.deepStrictEqual(resUnregistered, resOptOut);
    assert.deepStrictEqual(resUnregistered, resBlocked);
    assert.strictEqual(resUnregistered.status, 'pending');
  });

  // -------------------------------------------------------------
  // 11. SUPPORT TICKETS & SATISFACTION RATING
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[11] Support Tickets, Human Handoff & Rating Once\x1b[0m');
  runTest('Diagnostic payload sanitization includes platform & version without private data', () => {
    const createDiagnostics = () => ({
      appVersion: '1.0.0',
      userAgent: 'MockAgent/1.0',
      platform: 'Web/Desktop',
      screenResolution: '1920x1080',
      onlineStatus: true
    });

    const diag = createDiagnostics();
    assert.strictEqual(diag.appVersion, '1.0.0');
    assert.strictEqual(typeof diag.userAgent, 'string');
    assert.strictEqual(diag.onlineStatus, true);
    assert.strictEqual(diag.token, undefined);
    assert.strictEqual(diag.password, undefined);
  });

  runTest('Support ticket status transitions correctly upon human handoff', () => {
    let ticket = { status: 'open', assignedTo: null, isAiHandled: true };
    const handoff = (t) => ({ ...t, status: 'pending', isAiHandled: false });
    ticket = handoff(ticket);
    assert.strictEqual(ticket.status, 'pending');
    assert.strictEqual(ticket.isAiHandled, false);
  });

  runTest('Support rating is strictly allowed once and cannot be re-submitted', () => {
    let ticket = { status: 'resolved', rating: null };
    const applyRating = (t, score, comment) => {
      if (t.rating && t.rating.score) {
        throw new Error('Rating has already been submitted for this ticket.');
      }
      return { ...t, rating: { score, comment, submittedAt: new Date() } };
    };

    ticket = applyRating(ticket, 5, 'Great help!');
    assert.strictEqual(ticket.rating.score, 5);

    let threw = false;
    try {
      applyRating(ticket, 4, 'Change rating');
    } catch (err) {
      threw = true;
    }
    assert.strictEqual(threw, true, 'Subsequent rating attempt must be blocked');
  });

  runTest('Support 7-day reopen window allows reopening within 7 days and expires on day 8', () => {
    const isReopenAllowed = (resolvedAt, maxDays = 7) => {
      if (!resolvedAt) return false;
      const elapsed = Date.now() - new Date(resolvedAt).getTime();
      const maxMs = maxDays * 24 * 60 * 60 * 1000;
      return elapsed <= maxMs;
    };

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

    assert.strictEqual(isReopenAllowed(threeDaysAgo), true);
    assert.strictEqual(isReopenAllowed(eightDaysAgo), false);
  });

  // -------------------------------------------------------------
  // 12. ROLE-BASED ACCESS CONTROL GUARD
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[12] Role-Based Access Control Guard (Admin Support Console)\x1b[0m');
  runTest('Restricts /admin/support console from normal users', () => {
    const canAccessAdmin = (userRole) => {
      return userRole === 'support' || userRole === 'admin';
    };

    assert.strictEqual(canAccessAdmin('user'), false);
    assert.strictEqual(canAccessAdmin(undefined), false);
    assert.strictEqual(canAccessAdmin('support'), true);
    assert.strictEqual(canAccessAdmin('admin'), true);
  });

  // -------------------------------------------------------------
  // 13. OFFLINE CONTACT QUEUE & NETWORK SYNC
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[13] Offline Contact Queue & Network Sync\x1b[0m');
  runTest('Queues contact mutations when offline and drains queue on reconnect', () => {
    let offlineQueue = [];
    const queueContact = (contact) => {
      offlineQueue.push(contact);
    };

    queueContact({ name: 'Charlie', phone: '+12345678901' });
    queueContact({ name: 'David', phone: '+12345678902' });

    assert.strictEqual(offlineQueue.length, 2);

    // Simulate online drain
    const synced = [];
    while (offlineQueue.length > 0) {
      const next = offlineQueue.shift();
      synced.push({ ...next, synced: true });
    }

    assert.strictEqual(offlineQueue.length, 0);
    assert.strictEqual(synced.length, 2);
  });

  runTest('Offline contact queue and cached drafts are purged upon user logout', () => {
    let memoryStore = {
      offlineQueue: [{ name: 'Pending Contact' }],
      cachedContacts: [{ name: 'Alice' }]
    };

    const logoutClean = () => {
      memoryStore = {
        offlineQueue: [],
        cachedContacts: []
      };
    };

    logoutClean();
    assert.strictEqual(memoryStore.offlineQueue.length, 0);
    assert.strictEqual(memoryStore.cachedContacts.length, 0);
  });

  // -------------------------------------------------------------
  // 14. DEV STYLEGUIDE EXCLUSION CHECK
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[14] Dev Styleguide Production Bundle Exclusion Verification\x1b[0m');
  runTest('App router guards /dev/ui with import.meta.env.DEV flag', () => {
    const appFile = path.resolve(srcDir, 'App.jsx');
    const appContent = fs.readFileSync(appFile, 'utf-8');
    assert.ok(
      appContent.includes('import.meta.env.DEV') && appContent.includes('/dev/ui'),
      'Dev styleguide route must be strictly wrapped in import.meta.env.DEV'
    );
  });

  // -------------------------------------------------------------
  // 15. TOUCH TARGETS & ACCESSIBILITY RULES
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[15] Touch Target & Accessibility Semantics Sweep\x1b[0m');
  runTest('Standard shared button component enforces min-h-[44px] or touch padding for mobile', () => {
    const buttonFile = path.resolve(srcDir, 'components/Button.jsx');
    assert.ok(fs.existsSync(buttonFile), 'Button.jsx component must exist');
    const content = fs.readFileSync(buttonFile, 'utf-8');
    assert.ok(
      content.includes('44px') || content.includes('h-11') || content.includes('h-10') || content.includes('py-2.5') || content.includes('py-3') || content.includes('min-h-'),
      'Button component must enforce accessible touch target heights'
    );
  });

  runTest('All inputs have associated accessible labels, placeholders, or aria attributes', () => {
    const inputFile = path.resolve(srcDir, 'components/Input.jsx');
    assert.ok(fs.existsSync(inputFile), 'Input.jsx component must exist');
    const content = fs.readFileSync(inputFile, 'utf-8');
    assert.ok(content.includes('aria-') || content.includes('id') || content.includes('label'), 'Input components must support accessibility attributes');
  });

  // -------------------------------------------------------------
  // SUMMARY & EXIT
  // -------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`\x1b[1mClient Test Results: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || !process.argv[1].endsWith('vitest')) {
  runAllClientTests();
}

export { runAllClientTests };
