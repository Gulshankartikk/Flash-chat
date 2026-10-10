/**
 * Phone formatting, validation and masking utilities for Flash Chat Contacts.
 * Lightweight, zero-dependency, and compliant with international E.164 numbers.
 */

export const COUNTRY_CODES = [
  { code: '+1', country: 'United States / Canada', flag: '🇺🇸' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+55', country: 'Brazil', flag: '🇧🇷' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+41', country: 'Switzerland', flag: '🇨🇭' }
];

/**
 * Get default country code from browser locale
 */
export function getDefaultCountryCode() {
  if (typeof navigator === 'undefined' || !navigator.language) return '+1';
  const lang = navigator.language.toLowerCase();
  if (lang.includes('in') || lang.includes('hi')) return '+91';
  if (lang.includes('gb') || lang.includes('uk')) return '+44';
  if (lang.includes('au')) return '+61';
  if (lang.includes('de')) return '+49';
  if (lang.includes('fr')) return '+33';
  if (lang.includes('ae')) return '+971';
  return '+1';
}

/**
 * Format raw input to standard E.164 (+[1-9][0-9]{6,14})
 */
export function formatToE164(phone, defaultCountryCode = '+1') {
  if (!phone || typeof phone !== 'string') return '';
  const cleaned = phone.trim().replace(/[\s\-().]/g, '');
  if (!cleaned) return '';

  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  const prefix = defaultCountryCode.startsWith('+') ? defaultCountryCode : `+${defaultCountryCode}`;
  return `${prefix}${cleaned.replace(/^0+/, '')}`;
}

/**
 * Validate whether a string conforms to E.164
 */
export function isValidE164(phone) {
  if (!phone || typeof phone !== 'string') return false;
  return /^\+[1-9]\d{6,14}$/.test(phone.trim());
}

/**
 * Detect whether an arbitrary search string looks like a phone number
 */
export function isPossiblePhoneNumber(query) {
  if (!query || typeof query !== 'string') return false;
  const digits = query.replace(/\D/g, '');
  if (digits.length >= 7 && digits.length <= 15) {
    // Check if starts with +, digits, or parentheses
    return /^[+0-9()\s\-.]+$/.test(query.trim());
  }
  return false;
}

/**
 * Parse pasted phone string and extract country code & local digits
 */
export function parsePastedPhone(pastedText) {
  if (!pastedText || typeof pastedText !== 'string') return null;
  const clean = pastedText.trim().replace(/[\s\-().]/g, '');
  for (const c of COUNTRY_CODES) {
    if (clean.startsWith(c.code)) {
      return {
        countryCode: c.code,
        phoneNumber: clean.slice(c.code.length)
      };
    }
  }
  if (clean.startsWith('+')) {
    return {
      countryCode: '+1',
      phoneNumber: clean.slice(1)
    };
  }
  return {
    countryCode: getDefaultCountryCode(),
    phoneNumber: clean.replace(/^0+/, '')
  };
}

/**
 * Mask middle digits of phone number for privacy in UI lists (e.g. +91 98••• ••210)
 */
export function maskPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const clean = phone.trim();
  if (clean.length < 8) return clean;
  const prefix = clean.slice(0, 5);
  const suffix = clean.slice(-3);
  return `${prefix}•••••${suffix}`;
}

/**
 * Pretty-print an E.164 phone string
 */
export function formatDisplayPhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const trimmed = phone.trim();
  if (trimmed.startsWith('+1') && trimmed.length === 12) {
    return `+1 (${trimmed.slice(2, 5)}) ${trimmed.slice(5, 8)}-${trimmed.slice(8)}`;
  }
  if (trimmed.startsWith('+91') && trimmed.length === 13) {
    return `+91 ${trimmed.slice(3, 8)} ${trimmed.slice(8)}`;
  }
  if (trimmed.startsWith('+44') && trimmed.length >= 12) {
    return `+44 ${trimmed.slice(3, 7)} ${trimmed.slice(7)}`;
  }
  return trimmed;
}
