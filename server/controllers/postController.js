const Post = require('../models/Post');
const Like = require('../models/Like');
const Save = require('../models/Save');
const Comment = require('../models/Comment');
const Follow = require('../models/Follow');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { extractHashtags, extractMentions } = require('../utils/textParser');
const { canViewUserContent } = require('../utils/privacyHelper');
const redisService = require('../services/redisService');
const logger = require('../utils/logger');

/**
 * Helper to enrich posts with isLiked and isSaved for the current user
 */
const enrichPosts = async (posts, userId) => {
  if (!posts || posts.length === 0) return [];
  const postIds = posts.map((p) => p._id);

  const [likes, saves] = await Promise.all([
    Like.find({
      user: userId,
      targetType: 'post',
      targetId: { $in: postIds }
    }).select('targetId'),
    Save.find({
      user: userId,
      targetType: 'post',
      targetId: { $in: postIds }
    }).select('targetId')
  ]);

  const likedSet = new Set(likes.map((l) => String(l.targetId)));
  const savedSet = new Set(saves.map((s) => String(s.targetId)));

  return posts.map((post) => {
    const p = post.toObject ? post.toObject() : { ...post };
    p.isLiked = likedSet.has(String(p._id));
    p.isSaved = savedSet.has(String(p._id));
    return p;
  });
};

/**
 * POST /api/posts - Create a new post
 */
const createPost = async (req, res, next) => {
  try {
    const { caption = '', media = [], location = '', allowComments = true } = req.body;

    if (!Array.isArray(media) || media.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one media item is required.' });
    }

    const hashtags = extractHashtags(caption);
    const mentions = await extractMentions(caption);

    const post = await Post.create({
      author: req.user._id,
      caption: caption.trim(),
      media,
      hashtags,
      mentions,
      location: location.trim(),
      allowComments
    });

    // Increment user post counter atomically
    await User.findByIdAndUpdate(req.user._id, { $inc: { postsCount: 1 } });

    // Send notifications to mentioned users
    if (mentions.length > 0) {
      for (const mentionedId of mentions) {
        if (String(mentionedId) !== String(req.user._id)) {
          const notif = await Notification.create({
            user: mentionedId,
            actor: req.user._id,
            type: 'mention',
            target: { kind: 'post', refId: post._id },
            message: 'mentioned you in a post.'
          });
          if (req.io) {
            req.io.to(`user:${mentionedId}`).emit('notification:new', notif);
          }
        }
      }
    }

    // Invalidate feed cache for this author in Redis
    try {
      await redisService.del(`feed:${req.user._id}`);
    } catch (err) {
      // Ignore cache invalidation error
    }

    const populatedPost = await Post.findById(post._id)
      .populate('author', '_id name username avatar isVerified')
      .populate('mentions', '_id name username');

    const [enriched] = await enrichPosts([populatedPost], req.user._id);

    return res.status(201).json({ success: true, data: enriched });
  } catch (err) {
    logger.error({ err: err.message }, 'Error in createPost');
    next(err);
  }
};

/**
 * GET /api/posts/feed - Feed of posts from followed users + own posts
 */
const getFeedPosts = async (req, res, next) => {
  try {
    const { cursor, limit = 10 } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 30);

    // Get all accepted followed user IDs
    const followDocs = await Follow.find({
      follower: req.user._id,
      status: 'accepted'
    }).select('following');

    const authorIds = [req.user._id, ...followDocs.map((f) => f.following)];

    const query = {
      author: { $in: authorIds },
      isArchived: false
    };

    if (cursor) {
      query._id = { $lt: cursor };
    }

    const posts = await Post.find(query)
      .sort({ _id: -1 })
      .limit(parsedLimit + 1)
      .populate('author', '_id name username avatar isVerified isOnline')
      .populate('mentions', '_id name username')
      .lean();

    const hasMore = posts.length > parsedLimit;
    const paginatedPosts = hasMore ? posts.slice(0, parsedLimit) : posts;
    const nextCursor = hasMore ? paginatedPosts[paginatedPosts.length - 1]._id : null;

    const enriched = await enrichPosts(paginatedPosts, req.user._id);

    return res.status(200).json({
      success: true,
      data: enriched,
      nextCursor,
      hasMore
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error in getFeedPosts');
    next(err);
  }
};

/**
 * GET /api/posts/:id - Single post details
 */
const getPostById = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', '_id name username avatar isVerified isPrivateAccount isPrivate')
      .populate('mentions', '_id name username');

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    // Check privacy
    const canView = await canViewUserContent(req.user._id, post.author._id);
    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'This post is from a private account.',
        isPrivate: true
      });
    }

    const [enriched] = await enrichPosts([post], req.user._id);

    return res.status(200).json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/posts/:id - Edit post caption
 */
const updatePost = async (req, res, next) => {
  try {
    const { caption } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    if (String(post.author) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only edit your own posts.' });
    }

    if (typeof caption === 'string') {
      post.caption = caption.trim();
      post.hashtags = extractHashtags(caption);
      post.mentions = await extractMentions(caption);
      await post.save();
    }

    const updated = await Post.findById(post._id)
      .populate('author', '_id name username avatar isVerified')
      .populate('mentions', '_id name username');

    const [enriched] = await enrichPosts([updated], req.user._id);

    return res.status(200).json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/posts/:id - Delete post
 */
const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    if (String(post.author) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only delete your own posts.' });
    }

    await Post.findByIdAndDelete(req.params.id);
    await Promise.all([
      Like.deleteMany({ targetType: 'post', targetId: post._id }),
      Save.deleteMany({ targetType: 'post', targetId: post._id }),
      Comment.deleteMany({ targetType: 'post', targetId: post._id }),
      User.findByIdAndUpdate(req.user._id, { $inc: { postsCount: -1 } })
    ]);

    return res.status(200).json({ success: true, message: 'Post deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/posts/:id/like - Like a post
 */
const likePost = async (req, res, next) => {
  try {
    const postId = req.params.id;
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    const existingLike = await Like.findOne({
      user: req.user._id,
      targetType: 'post',
      targetId: postId
    });

    if (existingLike) {
      return res.status(200).json({ success: true, isLiked: true, likesCount: post.likesCount });
    }

    await Like.create({
      user: req.user._id,
      targetType: 'post',
      targetId: postId
    });

    const updated = await Post.findByIdAndUpdate(
      postId,
      { $inc: { likesCount: 1 } },
      { new: true }
    );

    // Notify author if not own post
    if (String(post.author) !== String(req.user._id)) {
      const notif = await Notification.create({
        user: post.author,
        actor: req.user._id,
        type: 'like',
        target: { kind: 'post', refId: post._id },
        message: 'liked your post.'
      });
      if (req.io) {
        req.io.to(`user:${post.author}`).emit('notification:new', notif);
      }
    }

    return res.status(200).json({
      success: true,
      isLiked: true,
      likesCount: updated.likesCount
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/posts/:id/like - Unlike a post
 */
const unlikePost = async (req, res, next) => {
  try {
    const postId = req.params.id;
    const deleted = await Like.findOneAndDelete({
      user: req.user._id,
      targetType: 'post',
      targetId: postId
    });

    if (deleted) {
      const updated = await Post.findByIdAndUpdate(
        postId,
        { $inc: { likesCount: -1 } },
        { new: true }
      );
      return res.status(200).json({
        success: true,
        isLiked: false,
        likesCount: Math.max(0, updated?.likesCount || 0)
      });
    }

    const currentPost = await Post.findById(postId);
    return res.status(200).json({
      success: true,
      isLiked: false,
      likesCount: currentPost?.likesCount || 0
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/posts/:id/save - Bookmark a post
 */
const savePost = async (req, res, next) => {
  try {
    const postId = req.params.id;
    const { collectionName = 'All Posts' } = req.body;

    const existingSave = await Save.findOne({
      user: req.user._id,
      targetType: 'post',
      targetId: postId
    });

    if (!existingSave) {
      await Save.create({
        user: req.user._id,
        targetType: 'post',
        targetId: postId,
        collectionName
      });
      await Post.findByIdAndUpdate(postId, { $inc: { savesCount: 1 } });
    }

    return res.status(200).json({ success: true, isSaved: true });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/posts/:id/save - Remove post bookmark
 */
const unsavePost = async (req, res, next) => {
  try {
    const postId = req.params.id;
    const deleted = await Save.findOneAndDelete({
      user: req.user._id,
      targetType: 'post',
      targetId: postId
    });

    if (deleted) {
      await Post.findByIdAndUpdate(postId, { $inc: { savesCount: -1 } });
    }

    return res.status(200).json({ success: true, isSaved: false });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/:id/posts - Paginated list of user's posts
 */
const getUserPosts = async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    const { cursor, limit = 12 } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 30);

    const canView = await canViewUserContent(req.user._id, targetUserId);
    if (!canView) {
      return res.status(200).json({
        success: true,
        data: [],
        isPrivate: true,
        message: 'This account is private. Follow to view posts.'
      });
    }

    const query = { author: targetUserId, isArchived: false };
    if (cursor) {
      query._id = { $lt: cursor };
    }

    const posts = await Post.find(query)
      .sort({ _id: -1 })
      .limit(parsedLimit + 1)
      .populate('author', '_id name username avatar isVerified')
      .lean();

    const hasMore = posts.length > parsedLimit;
    const paginated = hasMore ? posts.slice(0, parsedLimit) : posts;
    const nextCursor = hasMore ? paginated[paginated.length - 1]._id : null;

    const enriched = await enrichPosts(paginated, req.user._id);

    return res.status(200).json({
      success: true,
      data: enriched,
      nextCursor,
      hasMore,
      isPrivate: false
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createPost,
  getFeedPosts,
  getPostById,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  savePost,
  unsavePost,
  getUserPosts
};
