/**
 * Free-text Sanitization Utility for Flash Chat
 * Strips dangerous HTML tags, script injection, and javascript: protocols.
 */

const stripHtml = (input, maxLength) => {
  if (typeof input !== 'string') return input;

  // Parse tags directly instead of trying to strip them with multi-character
  // regular expressions. This prevents malformed input from re-forming an
  // HTML tag after sanitization.
  const lowerInput = input.toLowerCase();
  let cleaned = '';
  let index = 0;
  while (index < input.length) {
    if (lowerInput.startsWith('<script', index) || lowerInput.startsWith('<style', index)) {
      const tagName = lowerInput.startsWith('<script', index) ? 'script' : 'style';
      const closingTag = lowerInput.indexOf(`</${tagName}`, index + tagName.length + 1);
      if (closingTag === -1) break;
      const closingEnd = input.indexOf('>', closingTag);
      index = closingEnd === -1 ? input.length : closingEnd + 1;
      continue;
    }

    if (input[index] === '<') {
      const tagEnd = input.indexOf('>', index + 1);
      index = tagEnd === -1 ? input.length : tagEnd + 1;
      continue;
    }

    cleaned += input[index];
    index += 1;
  }
  cleaned = cleaned.trim();

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
