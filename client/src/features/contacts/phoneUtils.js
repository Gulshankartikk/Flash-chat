/**
 * Phone formatting and E.164 utilities for Flash Chat Contacts.
 * Lightweight, zero-dependency, and safe for international E.164 numbers.
 */

export const COUNTRY_CODES = [
  { code: '+1', country: 'US / CA', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
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
 * Format raw input to standard E.164 (+[1-9][0-9]{6,14})
 */
export function formatToE164(phone, defaultCountryCode = '+1') {
  if (!phone || typeof phone !== 'string') return '';
  const cleaned = phone.trim().replace(/[\s\-()]/g, '');
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
