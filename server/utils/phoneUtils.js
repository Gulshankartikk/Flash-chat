/**
 * Phone Number Normalization and Flexible Query Utility
 * Ensures consistent international format (+91 default) and enables
 * resilient user lookups regardless of whether the number was entered
 * with or without leading zero, spaces, hyphens, or country code.
 */

function normalizePhone(rawPhone, defaultCountry = '+91') {
  if (!rawPhone || typeof rawPhone !== 'string') return '';
  const cleaned = rawPhone.replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return `${defaultCountry}${cleaned.slice(1)}`;
  }
  if (cleaned.length === 10) {
    return `${defaultCountry}${cleaned}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+${cleaned}`;
  }
  return `+${cleaned}`;
}

function buildPhoneSearchQuery(rawPhone) {
  if (!rawPhone) return { phoneNumber: '__NONE__' };
  const digits = String(rawPhone).replace(/\D/g, '');
  if (!digits || digits.length < 7) {
    return { phoneNumber: String(rawPhone).trim() };
  }
  const last10 = digits.slice(-10);
  const candidates = [
    String(rawPhone).trim(),
    `+${digits}`,
    digits,
    `+91${last10}`,
    `91${last10}`,
    `+1${last10}`,
    `0${last10}`,
    last10
  ];
  const uniqueCandidates = [...new Set(candidates.filter(Boolean))];
  return {
    $or: [
      { phoneNumber: { $in: uniqueCandidates } },
      { phoneNumber: new RegExp(`${last10}$`) }
    ]
  };
}

module.exports = {
  normalizePhone,
  buildPhoneSearchQuery
};
