const Reel = require('../models/Reel');
const Like = require('../models/Like');
const Save = require('../models/Save');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { extractHashtags, extractMentions } = require('../utils/textParser');
const { canViewUser, visibleAuthorsFilter } = require('../utils/privacyHelper');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Enrich reels with isLiked and isSaved for current user
 */
const enrichReels = async (reels, userId) => {
  if (!reels || reels.length === 0) return [];
  const reelIds = reels.map((r) => r._id);

  const [likes, saves] = await Promise.all([
    Like.find({
      user: userId,
      targetType: 'reel',
      targetId: { $in: reelIds }
    }).select('targetId'),
    Save.find({
      user: userId,
      targetType: 'reel',
      targetId: { $in: reelIds }
    }).select('targetId')
  ]);

  const likedSet = new Set(likes.map((l) => String(l.targetId)));
  const savedSet = new Set(saves.map((s) => String(s.targetId)));

  return reels.map((reel) => {
    const r = reel.toObject ? reel.toObject() : { ...reel };
    r.isLiked = likedSet.has(String(r._id));
    r.isSaved = savedSet.has(String(r._id));
    const videoUrl = r.video?.url || r.media?.url || '';
    const thumb = r.thumbnail || r.media?.thumbnail || r.video?.thumbnail || videoUrl;
    if (!r.media) {
      r.media = {
        url: videoUrl,
        type: 'video',
        thumbnail: thumb,
        width: r.video?.width || 1080,
        height: r.video?.height || 1920,
        duration: r.video?.duration || 0
      };
    }
    if (!r.video) {
      r.video = {
        url: videoUrl,
        publicId: r.media?.publicId || '',
        thumbnail: thumb,
        width: r.media?.width || 1080,
        height: r.media?.height || 1920,
        duration: r.media?.duration || 0
      };
    }
    return r;
  });
};

/**
 * POST /api/reels - Create a new reel
 */
const createReel = async (req, res, next) => {
  try {
    const {
      video,
      media,
      videoUrl,
      thumbnail = '',
      caption = '',
      audioName = 'Original Audio'
    } = req.body;

    // Support both video and media object, or string videoUrl
    const rawVideo = video || media || (videoUrl ? { url: videoUrl } : null);
    const videoObj = typeof rawVideo === 'string'
      ? { url: rawVideo }
      : (rawVideo && typeof rawVideo === 'object' ? { ...rawVideo } : null);

    const videoUrlResolved = videoObj?.url || (typeof rawVideo === 'string' ? rawVideo : null);

    if (!videoUrlResolved) {
      return res.status(400).json({ success: false, message: 'Reel video URL is required.' });
    }

    const resolvedThumbnail =
      thumbnail ||
      videoObj.thumbnail ||
      (typeof videoUrlResolved === 'string' ? videoUrlResolved.replace(/\.[^/.]+$/, '.jpg') : '');

    const normalizedVideo = {
      url: videoUrlResolved,
      publicId: videoObj.publicId || '',
      duration: videoObj.duration || 0,
      width: videoObj.width || 1080,
      height: videoObj.height || 1920
    };

    const normalizedMedia = {
      url: videoUrlResolved,
      type: 'video',
      thumbnail: resolvedThumbnail,
      duration: videoObj.duration || 0,
      width: videoObj.width || 1080,
      height: videoObj.height || 1920
    };

    const hashtags = extractHashtags(caption);
    const mentions = await extractMentions(caption);

    const reel = await Reel.create({
      author: req.user._id,
      video: normalizedVideo,
      media: normalizedMedia,
      thumbnail: resolvedThumbnail,
      caption: caption.trim(),
      audioName: audioName.trim() || 'Original Audio',
      hashtags,
      mentions
    });

    // Increment user posts/reels count
    await User.findByIdAndUpdate(req.user._id, { $inc: { postsCount: 1 } });

    // Notify mentions
    for (const mentionId of mentions) {
      await notificationService.createNotification(
        {
          user: mentionId,
          actor: req.user._id,
          type: 'mention',
          target: { kind: 'reel', refId: reel._id },
          message: 'mentioned you in a reel.'
        },
        req.io
      );
    }

    const populated = await Reel.findById(reel._id)
      .populate('author', '_id name username avatar isVerified')
      .populate('mentions', '_id name username');

    const [enriched] = await enrichReels([populated], req.user._id);

    return res.status(201).json({ success: true, data: enriched });
  } catch (err) {
    logger.error({ err: err.message }, 'Error in createReel');
    next(err);
  }
};

/**
 * GET /api/reels/feed - Infinite vertical reels feed
 */
const getReelsFeed = async (req, res, next) => {
  try {
    const { cursor, limit = 10 } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 30);

    // Apply privacy filter: public accounts + accounts the viewer follows
    const authorsFilter = await visibleAuthorsFilter(req.user._id);
    const query = { ...authorsFilter };

    if (cursor) {
      query._id = { $lt: cursor };
    }

    const reels = await Reel.find(query)
      .sort({ _id: -1 })
      .limit(parsedLimit + 1)
      .populate('author', '_id name username avatar isVerified isOnline')
      .lean();

    const hasMore = reels.length > parsedLimit;
    const paginated = hasMore ? reels.slice(0, parsedLimit) : reels;
    const nextCursor = hasMore ? paginated[paginated.length - 1]._id : null;

    const enriched = await enrichReels(paginated, req.user._id);

    return res.status(200).json({
      success: true,
      data: enriched,
      nextCursor,
      hasMore
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error in getReelsFeed');
    next(err);
  }
};

/**
 * GET /api/reels/:id - Single reel inspection
 */
const getReelById = async (req, res, next) => {
  try {
    const reel = await Reel.findById(req.params.id)
      .populate('author', '_id name username avatar isVerified isPrivateAccount isPrivate')
      .populate('mentions', '_id name username');

    if (!reel) {
      return res.status(404).json({ success: false, message: 'Reel not found.' });
    }

    const canView = await canViewUser(req.user._id, reel.author._id);
    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'This reel is from a private account.',
        isPrivate: true
      });
    }

    const [enriched] = await enrichReels([reel], req.user._id);

    return res.status(200).json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/reels/:id/like
 */
const likeReel = async (req, res, next) => {
  try {
    const reelId = req.params.id;
    const reel = await Reel.findById(reelId);
    if (!reel) return res.status(404).json({ success: false, message: 'Reel not found.' });

    const existingLike = await Like.findOne({
      user: req.user._id,
      targetType: 'reel',
      targetId: reelId
    });

    if (existingLike) {
      return res.status(200).json({ success: true, isLiked: true, likesCount: reel.likesCount });
    }

    await Like.create({
      user: req.user._id,
      targetType: 'reel',
      targetId: reelId
    });

    const updated = await Reel.findByIdAndUpdate(reelId, { $inc: { likesCount: 1 } }, { new: true });

    await notificationService.createNotification(
      {
        user: reel.author,
        actor: req.user._id,
        type: 'like',
        target: { kind: 'reel', refId: reelId },
        message: 'liked your reel.'
      },
      req.io
    );

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
 * DELETE /api/reels/:id/like
 */
const unlikeReel = async (req, res, next) => {
  try {
    const reelId = req.params.id;
    const deleted = await Like.findOneAndDelete({
      user: req.user._id,
      targetType: 'reel',
      targetId: reelId
    });

    if (deleted) {
      const updated = await Reel.findByIdAndUpdate(reelId, { $inc: { likesCount: -1 } }, { new: true });

      await notificationService.deleteNotification(
        {
          user: updated?.author,
          actor: req.user._id,
          type: 'like',
          target: { refId: reelId }
        },
        req.io
      );

      return res.status(200).json({
        success: true,
        isLiked: false,
        likesCount: Math.max(0, updated?.likesCount || 0)
      });
    }

    const current = await Reel.findById(reelId);
    return res.status(200).json({
      success: true,
      isLiked: false,
      likesCount: current?.likesCount || 0
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/reels/:id/save
 */
const saveReel = async (req, res, next) => {
  try {
    const reelId = req.params.id;
    const existing = await Save.findOne({ user: req.user._id, targetType: 'reel', targetId: reelId });

    if (!existing) {
      await Save.create({ user: req.user._id, targetType: 'reel', targetId: reelId });
    }
    return res.status(200).json({ success: true, isSaved: true });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/reels/:id/save
 */
const unsaveReel = async (req, res, next) => {
  try {
    const reelId = req.params.id;
    await Save.findOneAndDelete({ user: req.user._id, targetType: 'reel', targetId: reelId });
    return res.status(200).json({ success: true, isSaved: false });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/reels/:id/view - Register video view
 */
const registerView = async (req, res, next) => {
  try {
    await Reel.findByIdAndUpdate(req.params.id, { $inc: { viewsCount: 1 } });
    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/:id/reels - User's reels
 */
const getUserReels = async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    const { cursor, limit = 12 } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 30);

    const canView = await canViewUser(req.user._id, targetUserId);
    if (!canView) {
      return res.status(200).json({
        success: true,
        data: [],
        isPrivate: true,
        message: 'This account is private.'
      });
    }

    const query = { author: targetUserId };
    if (cursor) query._id = { $lt: cursor };

    const reels = await Reel.find(query)
      .sort({ _id: -1 })
      .limit(parsedLimit + 1)
      .populate('author', '_id name username avatar isVerified')
      .lean();

    const hasMore = reels.length > parsedLimit;
    const paginated = hasMore ? reels.slice(0, parsedLimit) : reels;
    const nextCursor = hasMore ? paginated[paginated.length - 1]._id : null;

    const enriched = await enrichReels(paginated, req.user._id);

    return res.status(200).json({
      success: true,
      data: enriched,
      nextCursor,
      hasMore
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/reels/:id - Delete own reel
 */
const deleteReel = async (req, res, next) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) {
      return res.status(404).json({ success: false, message: 'Reel not found.' });
    }
    if (String(reel.author) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only delete your own reels.' });
    }
    await Reel.findByIdAndDelete(req.params.id);
    await User.findByIdAndUpdate(req.user._id, { $inc: { postsCount: -1 } });
    return res.status(200).json({ success: true, message: 'Reel deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createReel,
  deleteReel,
  getReelsFeed,
  getReelById,
  likeReel,
  unlikeReel,
  saveReel,
  unsaveReel,
  registerView,
  getUserReels
};
