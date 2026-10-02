const Follow = require('../models/Follow');
const Block = require('../models/Block');
const User = require('../models/User');

/**
 * Get all blocked user IDs for a given user (both directions: users I blocked, and users who blocked me)
 */
const getBlockedUserIds = async (userId) => {
  if (!userId) return [];
  const blocks = await Block.find({
    $or: [{ blocker: userId }, { blocked: userId }]
  }).select('blocker blocked');

  const blockedIds = new Set();
  blocks.forEach((b) => {
    if (String(b.blocker) === String(userId)) blockedIds.add(String(b.blocked));
    if (String(b.blocked) === String(userId)) blockedIds.add(String(b.blocker));
  });

  return Array.from(blockedIds);
};

/**
 * Check if viewerId is allowed to view targetUserId's profile, posts, reels, or stories
 */
const canViewUser = async (viewerId, targetUserId) => {
  if (!targetUserId || !viewerId) return false;

  // Viewing own content
  if (String(viewerId) === String(targetUserId)) {
    return true;
  }

  // Check if blocked in either direction
  const isBlocked = await Block.findOne({
    $or: [
      { blocker: viewerId, blocked: targetUserId },
      { blocker: targetUserId, blocked: viewerId }
    ]
  }).select('_id');

  if (isBlocked) return false;

  const targetUser = await User.findById(targetUserId).select('isPrivateAccount isPrivate').lean();
  if (!targetUser) return false;

  const isPrivate = targetUser.isPrivateAccount || targetUser.isPrivate;
  if (!isPrivate) {
    return true;
  }

  // Check if viewer is an accepted follower
  const follow = await Follow.findOne({
    follower: viewerId,
    following: targetUserId,
    status: 'accepted'
  }).select('_id');

  return !!follow;
};

// Alias for backwards compatibility
const canViewUserContent = canViewUser;

/**
 * Build MongoDB query filter for accessible authors (excluding blocked users and private accounts not followed)
 */
const visibleAuthorsFilter = async (viewerId) => {
  const blockedIds = await getBlockedUserIds(viewerId);

  // Accepted following IDs
  const acceptedFollows = await Follow.find({
    follower: viewerId,
    status: 'accepted'
  }).select('following');
  const followedIds = acceptedFollows.map((f) => f.following);

  // Public account IDs
  const publicUsers = await User.find({
    isPrivateAccount: { $ne: true },
    isPrivate: { $ne: true },
    _id: { $nin: blockedIds }
  }).select('_id');
  const publicUserIds = publicUsers.map((u) => u._id);

  const allowedAuthorIds = Array.from(
    new Set([String(viewerId), ...followedIds.map(String), ...publicUserIds.map(String)])
  ).filter((id) => !blockedIds.includes(id));

  return {
    author: { $in: allowedAuthorIds }
  };
};

module.exports = {
  canViewUser,
  canViewUserContent,
  getBlockedUserIds,
  visibleAuthorsFilter
};
