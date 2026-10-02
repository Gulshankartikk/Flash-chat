const Comment = require('../models/Comment');
const Post = require('../models/Post');
const Reel = require('../models/Reel');
const Like = require('../models/Like');
const notificationService = require('../services/notificationService');
const { extractMentions } = require('../utils/textParser');
const logger = require('../utils/logger');

// Strip HTML tags and sanitize
const sanitizeText = (str) => {
  if (!str) return '';
  return String(str).replace(/<[^>]*>?/gm, '').trim();
};

/**
 * Helper to enrich comments with isLiked state for current user
 */
const enrichComments = async (comments, userId) => {
  if (!comments || comments.length === 0) return [];
  const commentIds = comments.map((c) => c._id);

  const likes = await Like.find({
    user: userId,
    targetType: 'comment',
    targetId: { $in: commentIds }
  }).select('targetId');

  const likedSet = new Set(likes.map((l) => String(l.targetId)));

  return comments.map((c) => {
    const item = c.toObject ? c.toObject() : { ...c };
    item.isLiked = likedSet.has(String(item._id));
    return item;
  });
};

/**
 * GET comments for a post or reel (top-level comments only)
 */
const getTargetComments = async (req, res, next) => {
  try {
    const { targetType, targetId } = req.params;
    const { cursor, limit = 20 } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const query = {
      targetType: targetType === 'reels' ? 'reel' : 'post',
      targetId,
      parent: null // Top-level comments only
    };

    if (cursor) {
      query._id = { $lt: cursor };
    }

    const comments = await Comment.find(query)
      .sort({ _id: -1 })
      .limit(parsedLimit + 1)
      .populate('author', '_id name username avatar isVerified')
      .lean();

    const hasMore = comments.length > parsedLimit;
    const paginated = hasMore ? comments.slice(0, parsedLimit) : comments;
    const nextCursor = hasMore ? paginated[paginated.length - 1]._id : null;

    // Attach reply count for each top-level comment
    for (const c of paginated) {
      c.repliesCount = await Comment.countDocuments({ parent: c._id });
    }

    const enriched = await enrichComments(paginated, req.user._id);

    return res.status(200).json({
      success: true,
      data: enriched,
      nextCursor,
      hasMore
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error in getTargetComments');
    next(err);
  }
};

/**
 * GET replies for a comment
 */
const getCommentReplies = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cursor, limit = 20 } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const query = { parent: id };
    if (cursor) {
      query._id = { $gt: cursor }; // Chronological order for replies
    }

    const replies = await Comment.find(query)
      .sort({ _id: 1 })
      .limit(parsedLimit + 1)
      .populate('author', '_id name username avatar isVerified')
      .lean();

    const hasMore = replies.length > parsedLimit;
    const paginated = hasMore ? replies.slice(0, parsedLimit) : replies;
    const nextCursor = hasMore ? paginated[paginated.length - 1]._id : null;

    const enriched = await enrichComments(paginated, req.user._id);

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
 * POST comment or reply on post / reel
 */
const createComment = async (req, res, next) => {
  try {
    const { targetType, targetId } = req.params;
    const { text, parentId } = req.body;
    const cleanText = sanitizeText(text);

    if (!cleanText || cleanText.length === 0) {
      return res.status(400).json({ success: false, message: 'Comment text is required.' });
    }
    if (cleanText.length > 500) {
      return res.status(400).json({ success: false, message: 'Comment cannot exceed 500 characters.' });
    }

    const isReel = targetType === 'reels';
    const targetModel = isReel ? Reel : Post;
    const targetDoc = await targetModel.findById(targetId);

    if (!targetDoc) {
      return res.status(404).json({ success: false, message: 'Content not found.' });
    }

    if (!isReel && targetDoc.allowComments === false) {
      return res.status(403).json({ success: false, message: 'Comments are disabled for this post.' });
    }

    // If parentId provided, ensure only 1 level nesting
    let actualParentId = null;
    let parentComment = null;
    if (parentId) {
      parentComment = await Comment.findById(parentId);
      if (parentComment) {
        // Enforce 1 level: if parent already has a parent, attach to the top parent
        actualParentId = parentComment.parent ? parentComment.parent : parentComment._id;
      }
    }

    const mentions = await extractMentions(cleanText);

    const comment = await Comment.create({
      author: req.user._id,
      targetType: isReel ? 'reel' : 'post',
      targetId,
      text: cleanText,
      parent: actualParentId,
      mentions
    });

    // Atomic increment commentsCount
    await targetModel.findByIdAndUpdate(targetId, { $inc: { commentsCount: 1 } });

    // Notifications
    if (actualParentId && parentComment) {
      // Reply notification to parent comment author
      await notificationService.createNotification(
        {
          user: parentComment.author,
          actor: req.user._id,
          type: 'reply',
          target: { kind: 'comment', refId: comment._id },
          message: `replied: "${cleanText.slice(0, 50)}"`
        },
        req.io
      );
    } else {
      // Comment notification to content author
      await notificationService.createNotification(
        {
          user: targetDoc.author,
          actor: req.user._id,
          type: 'comment',
          target: { kind: isReel ? 'reel' : 'post', refId: targetDoc._id },
          message: `commented: "${cleanText.slice(0, 50)}"`
        },
        req.io
      );
    }

    // Mention notifications
    for (const mentionId of mentions) {
      await notificationService.createNotification(
        {
          user: mentionId,
          actor: req.user._id,
          type: 'mention',
          target: { kind: isReel ? 'reel' : 'post', refId: targetDoc._id },
          message: `mentioned you in a comment.`
        },
        req.io
      );
    }

    const populated = await Comment.findById(comment._id)
      .populate('author', '_id name username avatar isVerified')
      .lean();

    populated.isLiked = false;
    populated.repliesCount = 0;

    return res.status(201).json({ success: true, data: populated });
  } catch (err) {
    logger.error({ err: err.message }, 'Error in createComment');
    next(err);
  }
};

/**
 * DELETE comment (by author OR post/reel owner)
 */
const deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found.' });
    }

    const targetModel = comment.targetType === 'reel' ? Reel : Post;
    const targetDoc = await targetModel.findById(comment.targetId);

    const isCommentAuthor = String(comment.author) === String(req.user._id);
    const isTargetOwner = targetDoc && String(targetDoc.author) === String(req.user._id);

    if (!isCommentAuthor && !isTargetOwner) {
      return res.status(403).json({ success: false, message: 'Permission denied.' });
    }

    // Count replies that will be deleted
    const repliesCount = await Comment.countDocuments({ parent: comment._id });
    const totalDeleted = 1 + repliesCount;

    await Comment.deleteMany({ $or: [{ _id: comment._id }, { parent: comment._id }] });
    await Like.deleteMany({ targetType: 'comment', targetId: comment._id });

    // Atomic decrement
    if (targetDoc) {
      await targetModel.findByIdAndUpdate(comment.targetId, {
        $inc: { commentsCount: -totalDeleted }
      });
    }

    return res.status(200).json({ success: true, message: 'Comment deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/comments/:id/like - Like a comment
 */
const likeComment = async (req, res, next) => {
  try {
    const commentId = req.params.id;
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found.' });
    }

    const existingLike = await Like.findOne({
      user: req.user._id,
      targetType: 'comment',
      targetId: commentId
    });

    if (existingLike) {
      return res.status(200).json({ success: true, isLiked: true, likesCount: comment.likesCount });
    }

    await Like.create({
      user: req.user._id,
      targetType: 'comment',
      targetId: commentId
    });

    const updated = await Comment.findByIdAndUpdate(
      commentId,
      { $inc: { likesCount: 1 } },
      { new: true }
    );

    // Notify comment author
    await notificationService.createNotification(
      {
        user: comment.author,
        actor: req.user._id,
        type: 'like',
        target: { kind: 'comment', refId: commentId },
        message: 'liked your comment.'
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
 * DELETE /api/comments/:id/like - Unlike a comment
 */
const unlikeComment = async (req, res, next) => {
  try {
    const commentId = req.params.id;
    const deleted = await Like.findOneAndDelete({
      user: req.user._id,
      targetType: 'comment',
      targetId: commentId
    });

    if (deleted) {
      const updated = await Comment.findByIdAndUpdate(
        commentId,
        { $inc: { likesCount: -1 } },
        { new: true }
      );

      await notificationService.deleteNotification(
        {
          user: updated?.author,
          actor: req.user._id,
          type: 'like',
          target: { refId: commentId }
        },
        req.io
      );

      return res.status(200).json({
        success: true,
        isLiked: false,
        likesCount: Math.max(0, updated?.likesCount || 0)
      });
    }

    const currentComment = await Comment.findById(commentId);
    return res.status(200).json({
      success: true,
      isLiked: false,
      likesCount: currentComment?.likesCount || 0
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getTargetComments,
  getCommentReplies,
  createComment,
  deleteComment,
  likeComment,
  unlikeComment
};
