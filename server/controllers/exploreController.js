const Post = require('../models/Post');
const Reel = require('../models/Reel');
const User = require('../models/User');
const { getBlockedUserIds } = require('../utils/privacyHelper');
const redisService = require('../services/redisService');
const logger = require('../utils/logger');

/**
 * GET /api/explore - Trending posts & reels (cached in Redis for 60s)
 */
const getExplore = async (req, res, next) => {
  try {
    const { cursor, limit = 18 } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 18, 1), 36);

    const cacheKey = `explore:trending:${cursor || 'init'}:${parsedLimit}`;
    const cachedData = await redisService.get(cacheKey);

    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        return res.status(200).json(parsed);
      } catch (e) {
        // Fall through on JSON parse error
      }
    }

    const blockedIds = await getBlockedUserIds(req.user._id);

    // Get non-private public user IDs
    const publicUsers = await User.find({
      isPrivateAccount: { $ne: true },
      isPrivate: { $ne: true },
      _id: { $nin: blockedIds }
    }).select('_id');

    const publicUserIds = publicUsers.map((u) => u._id);

    // 7 days window
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const query = {
      author: { $in: publicUserIds },
      isArchived: false,
      createdAt: { $gte: sevenDaysAgo }
    };

    if (cursor) {
      query._id = { $lt: cursor };
    }

    const posts = await Post.find(query)
      .sort({ likesCount: -1, _id: -1 })
      .limit(parsedLimit + 1)
      .populate('author', '_id name username avatar isVerified')
      .lean();

    const hasMore = posts.length > parsedLimit;
    const paginated = hasMore ? posts.slice(0, parsedLimit) : posts;
    const nextCursor = hasMore ? paginated[paginated.length - 1]._id : null;

    const responsePayload = {
      success: true,
      data: paginated,
      nextCursor,
      hasMore
    };

    // Cache in Redis for 60 seconds
    await redisService.set(cacheKey, responsePayload, 'EX', 60);

    return res.status(200).json(responsePayload);
  } catch (err) {
    logger.error({ err: err.message }, 'Error in getExplore');
    next(err);
  }
};

/**
 * GET /api/hashtags/:tag - Posts with hashtag and tag count
 */
const getHashtagPosts = async (req, res, next) => {
  try {
    const rawTag = req.params.tag.toLowerCase().replace(/^#/, '');
    const { cursor, limit = 18 } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 18, 1), 36);

    const blockedIds = await getBlockedUserIds(req.user._id);

    const publicUsers = await User.find({
      isPrivateAccount: { $ne: true },
      isPrivate: { $ne: true },
      _id: { $nin: blockedIds }
    }).select('_id');

    const publicUserIds = publicUsers.map((u) => u._id);

    const query = {
      hashtags: rawTag,
      author: { $in: publicUserIds },
      isArchived: false
    };

    if (cursor) {
      query._id = { $lt: cursor };
    }

    const [posts, totalCount] = await Promise.all([
      Post.find(query)
        .sort({ _id: -1 })
        .limit(parsedLimit + 1)
        .populate('author', '_id name username avatar isVerified')
        .lean(),
      Post.countDocuments({ hashtags: rawTag, author: { $in: publicUserIds }, isArchived: false })
    ]);

    const hasMore = posts.length > parsedLimit;
    const paginated = hasMore ? posts.slice(0, parsedLimit) : posts;
    const nextCursor = hasMore ? paginated[paginated.length - 1]._id : null;

    return res.status(200).json({
      success: true,
      tag: rawTag,
      postsCount: totalCount,
      data: paginated,
      nextCursor,
      hasMore
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/search?q=&type=users|tags|posts
 */
const searchSocial = async (req, res, next) => {
  try {
    const { q = '', type = 'users' } = req.query;
    const queryStr = q.trim();

    if (!queryStr) {
      return res.status(200).json({ success: true, data: [] });
    }

    const blockedIds = await getBlockedUserIds(req.user._id);

    if (type === 'users') {
      const users = await User.find({
        $or: [
          { username: { $regex: queryStr, $options: 'i' } },
          { name: { $regex: queryStr, $options: 'i' } }
        ],
        _id: { $nin: blockedIds }
      })
        .limit(20)
        .select('_id name username avatar bio isVerified isPrivateAccount followersCount')
        .lean();

      return res.status(200).json({ success: true, data: users });
    }

    if (type === 'tags') {
      const cleanTag = queryStr.toLowerCase().replace(/^#/, '');
      const postsWithTag = await Post.aggregate([
        { $match: { hashtags: { $regex: `^${cleanTag}`, $options: 'i' }, isArchived: false } },
        { $unwind: '$hashtags' },
        { $match: { hashtags: { $regex: `^${cleanTag}`, $options: 'i' } } },
        { $group: { _id: '$hashtags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
        { $project: { _id: 0, tag: '$_id', count: 1 } }
      ]);

      return res.status(200).json({ success: true, data: postsWithTag });
    }

    if (type === 'posts') {
      const publicUsers = await User.find({
        isPrivateAccount: { $ne: true },
        isPrivate: { $ne: true },
        _id: { $nin: blockedIds }
      }).select('_id');

      const publicUserIds = publicUsers.map((u) => u._id);

      const posts = await Post.find({
        $text: { $search: queryStr },
        author: { $in: publicUserIds },
        isArchived: false
      })
        .sort({ score: { $meta: 'textScore' } })
        .limit(20)
        .populate('author', '_id name username avatar isVerified')
        .lean();

      return res.status(200).json({ success: true, data: posts });
    }

    return res.status(400).json({ success: false, message: 'Invalid search type.' });
  } catch (err) {
    logger.error({ err: err.message }, 'Error in searchSocial');
    next(err);
  }
};

module.exports = {
  getExplore,
  getHashtagPosts,
  searchSocial
};
