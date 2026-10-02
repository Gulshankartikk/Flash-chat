const User = require('../models/User');

/**
 * Extract lowercase hashtags from text (#photo -> 'photo')
 */
const extractHashtags = (text) => {
  if (!text || typeof text !== 'string') return [];
  const regex = /#([a-zA-Z0-9_\u0080-\uFFFF]+)/g;
  const matches = text.match(regex);
  if (!matches) return [];
  return Array.from(new Set(matches.map((tag) => tag.slice(1).toLowerCase())));
};

/**
 * Extract mentions from text (@username -> user._id array)
 */
const extractMentions = async (text) => {
  if (!text || typeof text !== 'string') return [];
  const regex = /@([a-zA-Z0-9_.]+)/g;
  const matches = text.match(regex);
  if (!matches) return [];

  const usernames = Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase())));
  if (usernames.length === 0) return [];

  try {
    const users = await User.find({ username: { $in: usernames } }).select('_id');
    return users.map((u) => u._id);
  } catch (err) {
    return [];
  }
};

module.exports = {
  extractHashtags,
  extractMentions
};
