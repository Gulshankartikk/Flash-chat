const Follow = require('../models/Follow');
const User = require('../models/User');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

/**
 * POST /api/follow/:userId - Follow a user (or request to follow if private)
 */
const followUser = async (req, res, next) => {
  try {
    const followerId = req.user._id;
    const targetUserId = req.params.userId;

    if (String(followerId) === String(targetUserId)) {
      return res.status(400).json({ success: false, message: 'You cannot follow yourself.' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Check existing follow relationship
    let follow = await Follow.findOne({ follower: followerId, following: targetUserId });
    if (follow) {
      return res.status(200).json({
        success: true,
        message: follow.status === 'accepted' ? 'Already following' : 'Follow request already sent',
        data: follow
      });
    }

    const isPrivate = targetUser.isPrivateAccount || targetUser.isPrivate;
    const status = isPrivate ? 'pending' : 'accepted';

    follow = await Follow.create({
      follower: followerId,
      following: targetUserId,
      status
    });

    if (status === 'accepted') {
      // Increment follower/following counts atomically
      await User.findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } });
      await User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: 1 } });

      // Create notification
      const notif = await Notification.create({
        user: targetUserId,
        actor: followerId,
        type: 'follow',
        target: { kind: 'user', refId: followerId },
        message: 'started following you.'
      });

      if (req.io) {
        req.io.to(`user:${targetUserId}`).emit('notification:new', notif);
      }
    } else {
      // Pending request notification
      const notif = await Notification.create({
        user: targetUserId,
        actor: followerId,
        type: 'follow_request',
        target: { kind: 'user', refId: followerId },
        message: 'requested to follow you.'
      });

      if (req.io) {
        req.io.to(`user:${targetUserId}`).emit('notification:new', notif);
      }
    }

    return res.status(201).json({
      success: true,
      message: status === 'accepted' ? 'Followed successfully' : 'Follow request sent',
      data: follow
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error in followUser');
    next(err);
  }
};

/**
 * DELETE /api/follow/:userId - Unfollow a user or cancel pending request
 */
const unfollowUser = async (req, res, next) => {
  try {
    const followerId = req.user._id;
    const targetUserId = req.params.userId;

    const follow = await Follow.findOneAndDelete({
      follower: followerId,
      following: targetUserId
    });

    if (!follow) {
      return res.status(404).json({ success: false, message: 'Follow relationship not found.' });
    }

    if (follow.status === 'accepted') {
      await User.findByIdAndUpdate(followerId, { $inc: { followingCount: -1 } });
      await User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: -1 } });
    }

    return res.status(200).json({ success: true, message: 'Unfollowed successfully' });
  } catch (err) {
    logger.error({ err: err.message }, 'Error in unfollowUser');
    next(err);
  }
};

/**
 * GET /api/follow/requests - Pending follow requests received by current user
 */
const getPendingRequests = async (req, res, next) => {
  try {
    const requests = await Follow.find({
      following: req.user._id,
      status: 'pending'
    })
      .sort({ createdAt: -1 })
      .populate('follower', '_id name username avatar isVerified bio')
      .lean();

    return res.status(200).json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/follow/requests/:id/accept - Accept a follow request
 */
const acceptFollowRequest = async (req, res, next) => {
  try {
    const follow = await Follow.findOne({
      _id: req.params.id,
      following: req.user._id,
      status: 'pending'
    });

    if (!follow) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    follow.status = 'accepted';
    await follow.save();

    await User.findByIdAndUpdate(follow.follower, { $inc: { followingCount: 1 } });
    await User.findByIdAndUpdate(follow.following, { $inc: { followersCount: 1 } });

    // Notify the requester that their request was accepted
    const notif = await Notification.create({
      user: follow.follower,
      actor: req.user._id,
      type: 'follow_accepted',
      target: { kind: 'user', refId: req.user._id },
      message: 'accepted your follow request.'
    });

    if (req.io) {
      req.io.to(`user:${follow.follower}`).emit('notification:new', notif);
    }

    return res.status(200).json({ success: true, message: 'Request accepted', data: follow });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/follow/requests/:id/reject - Reject a follow request
 */
const rejectFollowRequest = async (req, res, next) => {
  try {
    const follow = await Follow.findOneAndDelete({
      _id: req.params.id,
      following: req.user._id,
      status: 'pending'
    });

    if (!follow) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    return res.status(200).json({ success: true, message: 'Request rejected' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/:id/followers - Paginated list of followers
 */
const getFollowers = async (req, res, next) => {
  try {
    const { cursor, limit = 30 } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
    const query = { following: req.params.id, status: 'accepted' };

    if (cursor) {
      query._id = { $lt: cursor };
    }

    const followers = await Follow.find(query)
      .sort({ _id: -1 })
      .limit(parsedLimit + 1)
      .populate('follower', '_id name username avatar isVerified bio isOnline')
      .lean();

    const hasMore = followers.length > parsedLimit;
    const paginated = hasMore ? followers.slice(0, parsedLimit) : followers;
    const nextCursor = hasMore ? paginated[paginated.length - 1]._id : null;

    return res.status(200).json({
      success: true,
      data: paginated.map((f) => f.follower),
      nextCursor,
      hasMore
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/:id/following - Paginated list of following
 */
const getFollowing = async (req, res, next) => {
  try {
    const { cursor, limit = 30 } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
    const query = { follower: req.params.id, status: 'accepted' };

    if (cursor) {
      query._id = { $lt: cursor };
    }

    const following = await Follow.find(query)
      .sort({ _id: -1 })
      .limit(parsedLimit + 1)
      .populate('following', '_id name username avatar isVerified bio isOnline')
      .lean();

    const hasMore = following.length > parsedLimit;
    const paginated = hasMore ? following.slice(0, parsedLimit) : following;
    const nextCursor = hasMore ? paginated[paginated.length - 1]._id : null;

    return res.status(200).json({
      success: true,
      data: paginated.map((f) => f.following),
      nextCursor,
      hasMore
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  followUser,
  unfollowUser,
  getPendingRequests,
  acceptFollowRequest,
  rejectFollowRequest,
  getFollowers,
  getFollowing
};
