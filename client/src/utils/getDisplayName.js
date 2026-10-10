import { maskPhoneNumber } from '../features/contacts/phoneUtils.js';

/**
 * Resolves the display name for a user/contact entity with strict owner-isolation.
 * Fallback order:
 *   1. contactName (Custom name saved by the owner)
 *   2. name / displayName (Public profile full name)
 *   3. @username (Username handle)
 *   4. rawPhoneMasked / masked phone (e.g. +91 98•••••210)
 *   5. Fallback string ('Flash User')
 *
 * @param {Object|null|undefined} entity - User, Participant or Contact object
 * @param {string} [fallback='Flash User'] - Default fallback string
 * @returns {string} - Resolved display name
 */
export function getDisplayName(entity, fallback = 'Flash User') {
  if (!entity || typeof entity !== 'object') {
    return fallback;
  }

  // 1. Owner's private saved contact name
  if (entity.contactName && typeof entity.contactName === 'string' && entity.contactName.trim()) {
    return entity.contactName.trim();
  }

  // 2. Public profile display name or name
  if (entity.name && typeof entity.name === 'string' && entity.name.trim()) {
    return entity.name.trim();
  }
  if (entity.displayName && typeof entity.displayName === 'string' && entity.displayName.trim()) {
    return entity.displayName.trim();
  }

  // 3. Username handle
  if (entity.username && typeof entity.username === 'string' && entity.username.trim()) {
    const rawUser = entity.username.trim();
    return rawUser.startsWith('@') ? rawUser : `@${rawUser}`;
  }

  // 4. Masked phone number if provided or raw phone
  if (entity.rawPhoneMasked && typeof entity.rawPhoneMasked === 'string' && entity.rawPhoneMasked.trim()) {
    return entity.rawPhoneMasked.trim();
  }
  if (entity.phoneMasked && typeof entity.phoneMasked === 'string' && entity.phoneMasked.trim()) {
    return entity.phoneMasked.trim();
  }
  if (entity.phone && typeof entity.phone === 'string' && entity.phone.trim()) {
    return maskPhoneNumber(entity.phone.trim());
  }

  return fallback;
}

export default getDisplayName;

