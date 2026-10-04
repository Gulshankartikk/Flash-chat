/**
 * Resolves the display name for a user/contact entity with strict owner-isolation.
 * Fallback order:
 *   1. contactName (Custom name saved by the owner)
 *   2. name / displayName (Public profile full name)
 *   3. @username (Username handle)
 *   4. Fallback string ('Flash User')
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

  return fallback;
}

export default getDisplayName;
