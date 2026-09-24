/**
 * AI Security Guardrails & Safety Sanitization
 */

// Filter sensitive patterns or injection attempts
const INJECTION_PATTERNS = [
  /ignore previous instructions/i,
  /system prompt override/i,
  /leak private key/i,
  /display all user passwords/i,
];

function sanitizePrompt(text) {
  if (!text || typeof text !== "string") return "";
  let clean = text.trim();
  // Strip control chars
  clean = clean.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(clean)) {
      console.warn(`[AI Guardrail] Flagged potentially malicious prompt input.`);
      clean = clean.replace(pattern, "[redacted]");
    }
  }

  return clean;
}

function estimateTokenCount(text) {
  if (!text) return 0;
  // Rule of thumb: ~4 characters per token in English
  return Math.ceil(text.length / 4);
}

module.exports = {
  sanitizePrompt,
  estimateTokenCount,
};
