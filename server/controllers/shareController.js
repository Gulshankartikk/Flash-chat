const Post = require('../models/Post');
const Reel = require('../models/Reel');
const Story = require('../models/Story');
const User = require('../models/User');
const Follow = require('../models/Follow');
const Conversation = require('../models/Conversation');
const chatService = require('../services/chatService');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * POST /api/share - Share a post, reel, story or profile to multiple chats
 */
const shareContent = async (req, res, next) => {
  try {
    const { kind, refId, conversationIds = [], text = '' } = req.body;

    if (!kind || !refId || !Array.isArray(conversationIds) || conversationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'kind, refId, and at least one conversationId are required.'
      });
    }

    // 1. Fetch content snapshot and owner
    let snapshot = {
      thumbnail: '',
      authorUsername: '',
      authorName: '',
      authorAvatar: '',
      captionSnippet: '',
      mediaType: 'image'
    };
    let contentAuthorId = null;
    let messageType = 'shared_post';

    if (kind === 'post') {
      messageType = 'shared_post';
      const post = await Post.findById(refId).populate('author', '_id name username avatar');
      if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

      contentAuthorId = post.author._id;
      snapshot = {
        thumbnail: post.media?.[0]?.url || '',
        authorUsername: post.author.username,
        authorName: post.author.name,
        authorAvatar: post.author.avatar,
        captionSnippet: post.caption?.slice(0, 100) || '',
        mediaType: post.media?.[0]?.type || 'image'
      };
    } else if (kind === 'reel') {
      messageType = 'shared_reel';
      const reel = await Reel.findById(refId).populate('author', '_id name username avatar');
      if (!reel) return res.status(404).json({ success: false, message: 'Reel not found.' });

      contentAuthorId = reel.author._id;
      snapshot = {
        thumbnail: reel.thumbnail || reel.video?.url || '',
        authorUsername: reel.author.username,
        authorName: reel.author.name,
        authorAvatar: reel.author.avatar,
        captionSnippet: reel.caption?.slice(0, 100) || '',
        mediaType: 'video'
      };

      // Increment reel sharesCount
      await Reel.findByIdAndUpdate(refId, { $inc: { sharesCount: 1 } });
    } else if (kind === 'story') {
      messageType = 'shared_story';
      const story = await Story.findById(refId).populate('author', '_id name username avatar');
      if (!story) return res.status(404).json({ success: false, message: 'Story not found or expired.' });

      contentAuthorId = story.author._id;
      snapshot = {
        thumbnail: story.media?.url || '',
        authorUsername: story.author.username,
        authorName: story.author.name,
        authorAvatar: story.author.avatar,
        captionSnippet: story.text || 'Story',
        mediaType: story.media?.type || 'image'
      };
    } else if (kind === 'profile') {
      messageType = 'contact';
      const profile = await User.findById(refId).select('_id name username avatar bio');
      if (!profile) return res.status(404).json({ success: false, message: 'User not found.' });

      contentAuthorId = profile._id;
      snapshot = {
        thumbnail: profile.avatar || '',
        authorUsername: profile.username,
        authorName: profile.name,
        authorAvatar: profile.avatar,
        captionSnippet: profile.bio || '',
        mediaType: 'profile'
      };
    }

    const sentMessages = [];

    // 2. Deliver message into each conversation
    for (const convId of conversationIds) {
      const isMember = await chatService.isMember(convId, req.user._id);
      if (!isMember) continue;

      const message = await chatService.sendMessage(req.user._id, {
        conversationId: convId,
        type: messageType,
        text: text.trim(),
        sharedRef: { kind, refId },
        snapshot
      });

      if (req.io) {
        req.io.to(`conv:${convId}`).emit('message:new', message);
      }

      sentMessages.push(message);
    }

    // 3. Notify content owner (if not sharing own content)
    if (contentAuthorId && String(contentAuthorId) !== String(req.user._id)) {
      await notificationService.createNotification(
        {
          user: contentAuthorId,
          actor: req.user._id,
          type: 'share',
          target: { kind, refId },
          message: `shared your ${kind}.`
        },
        req.io
      );
    }

    return res.status(200).json({
      success: true,
      message: `Shared to ${sentMessages.length} conversation(s).`,
      count: sentMessages.length
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error in shareContent');
    next(err);
  }
};

/**
 * GET /api/share/suggestions - Recent conversations + contacts/followers for share sheet
 */
const getShareSuggestions = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { q = '' } = req.query;
    const queryStr = q.trim().toLowerCase();

    // 1. Recent active conversations
    const recentConvs = await Conversation.find({ 'members.user': userId })
      .sort({ updatedAt: -1 })
      .limit(15)
      .populate('members.user', '_id name username avatar isOnline')
      .lean();

    const formattedConvs = recentConvs.map((conv) => {
      if (conv.type === 'group') {
        return {
          id: conv._id,
          type: 'conversation',
          name: conv.name,
          avatar: conv.avatar,
          isGroup: true
        };
      }
      const otherUser = conv.members.find((m) => String(m.user._id) !== String(userId))?.user;
      return {
        id: conv._id,
        type: 'conversation',
        userId: otherUser?._id,
        name: otherUser?.name || otherUser?.username || 'User',
        username: otherUser?.username,
        avatar: otherUser?.avatar,
        isGroup: false
      };
    });

    // 2. People I follow
    const following = await Follow.find({ follower: userId, status: 'accepted' })
      .limit(20)
      .populate('following', '_id name username avatar isOnline')
      .lean();

    const formattedFollowing = following.map((f) => ({
      userId: f.following._id,
      type: 'user',
      name: f.following.name,
      username: f.following.username,
      avatar: f.following.avatar
    }));

    // Deduplicate and filter by query if provided
    const combined = [...formattedConvs];
    const seenUserIds = new Set(formattedConvs.map((c) => String(c.userId)).filter(Boolean));

    for (const f of formattedFollowing) {
      if (!seenUserIds.has(String(f.userId))) {
        seenUserIds.add(String(f.userId));
        combined.push(f);
      }
    }

    const filtered = queryStr
      ? combined.filter(
          (item) =>
            (item.name && item.name.toLowerCase().includes(queryStr)) ||
            (item.username && item.username.toLowerCase().includes(queryStr))
        )
      : combined;

    return res.status(200).json({ success: true, data: filtered });
  } catch (err) {
    logger.error({ err: err.message }, 'Error in getShareSuggestions');
    next(err);
  }
};

module.exports = {
  shareContent,
  getShareSuggestions
};
