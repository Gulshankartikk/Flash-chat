const Story = require('../models/Story');
const Follow = require('../models/Follow');
const User = require('../models/User');
const chatService = require('../services/chatService');
const notificationService = require('../services/notificationService');
const { getBlockedUserIds } = require('../utils/privacyHelper');
const logger = require('../utils/logger');

/**
 * POST /api/stories - Create 24h story (photo, video, or text status)
 */
const createStory = async (req, res, next) => {
  try {
    const {
      media,
      text = '',
      backgroundColor = '#10B981',
      fontStyle = 'sans',
      textAlign = 'center',
      stickers = [],
      closeFriendsOnly = false,
      audience = 'followers',
      hiddenFrom = [],
      customAudience = []
    } = req.body;

    const isTextStatus = media?.type === 'text' || (!media?.url && text.trim().length > 0);

    if (!isTextStatus && (!media || !media.url)) {
      return res.status(400).json({ success: false, message: 'Story media or text content is required.' });
    }

    const storyMedia = isTextStatus
      ? { url: '', type: 'text', duration: 5 }
      : {
          url: media.url,
          publicId: media.publicId || '',
          type: media.type === 'video' ? 'video' : 'image',
          duration: media.duration || (media.type === 'video' ? 15 : 5)
        };

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const story = await Story.create({
      author: req.user._id,
      media: storyMedia,
      text: text.trim(),
      backgroundColor: backgroundColor || '#10B981',
      fontStyle: fontStyle || 'sans',
      textAlign: textAlign || 'center',
      stickers: Array.isArray(stickers) ? stickers : [],
      closeFriendsOnly: Boolean(closeFriendsOnly || audience === 'close_friends'),
      audience: audience || (closeFriendsOnly ? 'close_friends' : 'followers'),
      hiddenFrom: Array.isArray(hiddenFrom) ? hiddenFrom : [],
      customAudience: Array.isArray(customAudience) ? customAudience : [],
      expiresAt,
      viewers: [],
      reactions: []
    });

    const populated = await Story.findById(story._id).populate(
      'author',
      '_id name username avatar isVerified'
    );

    // Broadcast new story event via Socket.IO
    if (req.io) {
      req.io.emit('story:new', {
        storyId: story._id,
        author: populated.author
      });
    }

    return res.status(201).json({ success: true, data: populated });
  } catch (err) {
    logger.error({ err: err.message }, 'Error in createStory');
    next(err);
  }
};

/**
 * GET /api/stories/tray - Grouped active stories from following + me with privacy filtering
 */
const getStoriesTray = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();

    const blockedIds = await getBlockedUserIds(userId);

    // Get all accepted followed authors
    const followDocs = await Follow.find({
      follower: userId,
      status: 'accepted'
    }).select('following');

    const followingIds = followDocs.map((f) => String(f.following));
    const targetAuthorIds = Array.from(new Set([String(userId), ...followingIds])).filter(
      (id) => !blockedIds.includes(id)
    );

    // Find active non-expired stories
    const stories = await Story.find({
      author: { $in: targetAuthorIds },
      expiresAt: { $gt: now }
    })
      .sort({ createdAt: 1 })
      .populate('author', '_id name username avatar isVerified')
      .lean();

    // Group stories by user and filter audience permissions
    const trayMap = new Map();

    stories.forEach((story) => {
      const authorId = String(story.author._id);
      const isMe = authorId === String(userId);

      // Privacy check for viewers other than author:
      if (!isMe) {
        // 1. If user is in hiddenFrom list, skip story
        if (story.hiddenFrom?.some((id) => String(id) === String(userId))) {
          return;
        }

        // 2. If custom audience, user must be in customAudience
        if (story.audience === 'custom' && !story.customAudience?.some((id) => String(id) === String(userId))) {
          return;
        }

        // 3. If close friends only, check if author marked user as close friend (or followers fallback)
        if (story.closeFriendsOnly || story.audience === 'close_friends') {
          if (!followingIds.includes(authorId)) {
            return;
          }
        }
      }

      const isViewer = story.viewers?.some((v) => String(v.user) === String(userId));

      if (!trayMap.has(authorId)) {
        trayMap.set(authorId, {
          user: story.author,
          isMe,
          hasUnseen: !isViewer && !isMe,
          latestStoryAt: story.createdAt,
          stories: []
        });
      }

      const userEntry = trayMap.get(authorId);
      userEntry.stories.push({
        ...story,
        isViewed: isViewer
      });

      if (!isViewer && !isMe) {
        userEntry.hasUnseen = true;
      }
      if (new Date(story.createdAt) > new Date(userEntry.latestStoryAt)) {
        userEntry.latestStoryAt = story.createdAt;
      }
    });

    // Convert map to array and sort:
    // 1. My story first
    // 2. Unseen stories next
    // 3. Seen stories last
    const tray = Array.from(trayMap.values()).sort((a, b) => {
      if (a.isMe) return -1;
      if (b.isMe) return 1;
      if (a.hasUnseen && !b.hasUnseen) return -1;
      if (!a.hasUnseen && b.hasUnseen) return 1;
      return new Date(b.latestStoryAt) - new Date(a.latestStoryAt);
    });

    return res.status(200).json({ success: true, data: tray });
  } catch (err) {
    logger.error({ err: err.message }, 'Error in getStoriesTray');
    next(err);
  }
};

/**
 * GET /api/stories/:id - Get single story with privacy authorization check
 */
const getStoryById = async (req, res, next) => {
  try {
    const storyId = req.params.id;
    const userId = req.user._id;

    const story = await Story.findById(storyId).populate(
      'author',
      '_id name username avatar isVerified'
    );

    if (!story || story.expiresAt < new Date()) {
      return res.status(404).json({ success: false, message: 'Story not found or expired.' });
    }

    const authorId = String(story.author._id);
    const isMe = authorId === String(userId);

    if (!isMe) {
      if (story.hiddenFrom?.some((id) => String(id) === String(userId))) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
      if (story.audience === 'custom' && !story.customAudience?.some((id) => String(id) === String(userId))) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    return res.status(200).json({ success: true, data: story });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/stories/:id/view - Idempotent story view
 */
const viewStory = async (req, res, next) => {
  try {
    const storyId = req.params.id;
    const userId = req.user._id;

    const story = await Story.findById(storyId);
    if (!story || story.expiresAt < new Date()) {
      return res.status(404).json({ success: false, message: 'Story not found or expired.' });
    }

    const alreadyViewed = story.viewers.some((v) => String(v.user) === String(userId));
    if (!alreadyViewed && String(story.author) !== String(userId)) {
      story.viewers.push({ user: userId, at: new Date() });
      await story.save();
    }

    return res.status(200).json({ success: true, isViewed: true });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/stories/:id/react - Emoji reaction to story
 */
const reactToStory = async (req, res, next) => {
  try {
    const storyId = req.params.id;
    const userId = req.user._id;
    const { emoji } = req.body;

    if (!emoji || typeof emoji !== 'string') {
      return res.status(400).json({ success: false, message: 'Emoji is required.' });
    }

    const story = await Story.findById(storyId).populate('author', '_id name username avatar');
    if (!story || story.expiresAt < new Date()) {
      return res.status(404).json({ success: false, message: 'Story not found or expired.' });
    }

    // Add or update reaction
    const existingIndex = story.reactions.findIndex((r) => String(r.user) === String(userId));
    if (existingIndex > -1) {
      story.reactions[existingIndex].emoji = emoji;
      story.reactions[existingIndex].at = new Date();
    } else {
      story.reactions.push({ user: userId, emoji, at: new Date() });
    }
    await story.save();

    // Send realtime event to author
    if (req.io && String(story.author._id) !== String(userId)) {
      req.io.to(`user:${story.author._id}`).emit('story:reaction', {
        storyId: story._id,
        user: {
          _id: req.user._id,
          name: req.user.name,
          username: req.user.username,
          avatar: req.user.avatar
        },
        emoji
      });
    }

    // Notification
    if (String(story.author._id) !== String(userId)) {
      await notificationService.createNotification(
        {
          user: story.author._id,
          actor: userId,
          type: 'story_reaction',
          target: { kind: 'story', refId: story._id },
          message: `reacted ${emoji} to your story`
        },
        req.io
      );
    }

    return res.status(200).json({ success: true, emoji, message: 'Reaction recorded' });
  } catch (err) {
    logger.error({ err: err.message }, 'Error in reactToStory');
    next(err);
  }
};

/**
 * GET /api/stories/:id/viewers - Viewers list (owner only)
 */
const getStoryViewers = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id)
      .populate('viewers.user', '_id name username avatar isVerified isOnline')
      .populate('reactions.user', '_id name username avatar');

    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found.' });
    }

    if (String(story.author) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only story author can see viewers.' });
    }

    return res.status(200).json({
      success: true,
      data: story.viewers,
      reactions: story.reactions
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/stories/:id - Delete story
 */
const deleteStory = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found.' });
    }

    if (String(story.author) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Permission denied.' });
    }

    await Story.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: 'Story deleted.' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/stories/:id/reply - Cross-link story reply directly into Chat
 */
const replyToStory = async (req, res, next) => {
  try {
    const storyId = req.params.id;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Reply text is required.' });
    }

    const story = await Story.findById(storyId).populate('author', '_id name username avatar');
    if (!story || story.expiresAt < new Date()) {
      return res.status(404).json({ success: false, message: 'Story not found or expired.' });
    }

    if (String(story.author._id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Cannot reply to your own story.' });
    }

    // 1. Find or create 1-to-1 conversation with story author
    const conversation = await chatService.createDirectConversation(req.user._id, story.author._id);

    // 2. Prepare rich snapshot for chat preview card
    const snapshot = {
      thumbnail: story.media?.url || '',
      authorUsername: story.author.username,
      authorName: story.author.name,
      authorAvatar: story.author.avatar,
      captionSnippet: story.text || 'Story',
      mediaType: story.media?.type || 'image',
      backgroundColor: story.backgroundColor || '#10B981'
    };

    // 3. Send message via unified chatService
    const message = await chatService.sendMessage(req.user._id, {
      conversationId: conversation._id,
      type: 'shared_story',
      text: text.trim(),
      sharedRef: { kind: 'story', refId: story._id },
      snapshot
    });

    // 4. Emit realtime message:new to conversation room & update notification
    if (req.io) {
      req.io.to(`conv:${conversation._id}`).emit('message:new', message);
      req.io.to(`user:${story.author._id}`).emit('conversation:updated', {
        conversationId: conversation._id,
        lastMessage: message
      });
    }

    // 5. Send story_reply notification
    await notificationService.createNotification(
      {
        user: story.author._id,
        actor: req.user._id,
        type: 'story_reply',
        target: { kind: 'story', refId: story._id },
        message: `replied to your story: "${text.trim().slice(0, 50)}"`
      },
      req.io
    );

    return res.status(200).json({
      success: true,
      message: 'Story reply sent to chat',
      conversationId: conversation._id,
      data: message
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error in replyToStory');
    next(err);
  }
};

module.exports = {
  createStory,
  getStoriesTray,
  getStoryById,
  viewStory,
  reactToStory,
  getStoryViewers,
  deleteStory,
  replyToStory
};
