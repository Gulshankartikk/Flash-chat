/**
 * Free-text Sanitization Utility for Flash Chat
 * Strips dangerous HTML tags, script injection, and javascript: protocols.
 */

const stripHtml = (input, maxLength) => {
  if (typeof input !== 'string') return input;

  let cleaned = input
    // Remove <script> tags and contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove <iframe>, <object>, <embed>, <link>, <style>, <form>, <input>
    .replace(/<\/?(iframe|object|embed|link|style|form|input|button|svg|math)[^>]*>/gi, '')
    // Remove inline event handlers (e.g. onload=, onclick=, onerror=)
    .replace(/\s*on\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\s*on\w+\s*=\s*[^>\s]+/gi, '')
    // Remove javascript: and vbscript: URIs
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    // Remove data:text/html URIs
    .replace(/data\s*:\s*text\/html/gi, '')
    // Replace all remaining raw HTML tags
    .replace(/<[^>]*>/g, '')
    // Trim leading/trailing whitespace
    .trim();

  if (typeof maxLength === 'number' && maxLength > 0) {
    cleaned = cleaned.slice(0, maxLength);
  }

  return cleaned;
};

const sanitizeObject = (obj, fieldsToSanitize = []) => {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key of Object.keys(sanitized)) {
    if (fieldsToSanitize.length === 0 || fieldsToSanitize.includes(key)) {
      if (typeof sanitized[key] === 'string') {
        sanitized[key] = stripHtml(sanitized[key]);
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = sanitizeObject(sanitized[key], fieldsToSanitize);
      }
    }
  }

  return sanitized;
};

module.exports = {
  stripHtml,
  sanitizeText: stripHtml,
  sanitizeRichHtml: stripHtml,
  sanitizeObject
};
