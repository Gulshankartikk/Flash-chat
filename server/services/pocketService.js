const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const PocketItem = require('../models/PocketItem');
const PocketFolder = require('../models/PocketFolder');
const PocketSettings = require('../models/PocketSettings');
const Message = require('../models/Message');
const Post = require('../models/Post');
const Reel = require('../models/Reel');
const User = require('../models/User');
const chatService = require('./chatService');
const { canViewUser } = require('../utils/privacyHelper');
const linkPreviewService = require('./linkPreviewService');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const redisService = require('./redisService');
const logger = require('../utils/logger');

// Ensure exports directory exists
const exportsDir = path.join(__dirname, '..', 'uploads', 'exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

// In-memory fallback map for export jobs when Redis is unavailable
const exportJobs = new Map();

/**
 * Calculates raw byte size of a PocketItem
 */
const calculateItemBytes = (item) => {
  let bytes = 0;
  if (item.title) bytes += Buffer.byteLength(item.title, 'utf8');
  if (item.content) bytes += Buffer.byteLength(item.content, 'utf8');
  if (item.url) bytes += Buffer.byteLength(item.url, 'utf8');
  if (Array.isArray(item.tags)) {
    bytes += Buffer.byteLength(item.tags.join(''), 'utf8');
  }
  if (Array.isArray(item.media)) {
    for (const m of item.media) {
      bytes += m.size || 0;
    }
  }
  return bytes;
};

const pocketService = {
  /**
   * Retrieves or creates default PocketSettings for a user
   */
  async getOrCreateSettings(userId) {
    let settings = await PocketSettings.findOne({ user: userId });
    if (!settings) {
      settings = await PocketSettings.create({
        user: userId,
        storageUsedBytes: 0,
        storageLimitBytes: 1073741824 // 1 GB
      });
    }
    return settings;
  },

  /**
   * Recalculates total storage used across all active items for a user
   */
  async recalculateStorage(userId) {
    const activeItems = await PocketItem.find({
      owner: userId,
      deletedAt: null
    }).select('title content url tags media');

    let totalBytes = 0;
    for (const item of activeItems) {
      totalBytes += calculateItemBytes(item);
    }

    await PocketSettings.findOneAndUpdate(
      { user: userId },
      { storageUsedBytes: totalBytes },
      { upsert: true }
    );

    return totalBytes;
  },

  /**
   * Checks whether adding `additionalBytes` would exceed user's storage quota
   */
  async checkStorageQuota(userId, additionalBytes = 0) {
    const settings = await this.getOrCreateSettings(userId);
    const limit = settings.storageLimitBytes || 1073741824;
    const current = settings.storageUsedBytes || 0;

    if (current + additionalBytes > limit) {
      const limitMB = Math.round(limit / (1024 * 1024));
      const currentMB = Math.round(current / (1024 * 1024));
      throw new Error(
        `Pocket storage limit exceeded (${currentMB}MB / ${limitMB}MB). Please delete items to free up space.`
      );
    }
    return settings;
  },

  /**
   * Returns storage usage breakdown by category
   */
  async getStorageBreakdown(userId) {
    const settings = await this.getOrCreateSettings(userId);
    const items = await PocketItem.find({
      owner: userId,
      deletedAt: null
    }).select('type title content url tags media');

    const breakdown = {
      notes: { bytes: 0, count: 0 },
      media: { bytes: 0, count: 0 },
      documents: { bytes: 0, count: 0 },
      audio: { bytes: 0, count: 0 },
      links: { bytes: 0, count: 0 },
      other: { bytes: 0, count: 0 }
    };

    let totalComputedBytes = 0;

    for (const item of items) {
      const bytes = calculateItemBytes(item);
      totalComputedBytes += bytes;

      if (item.type === 'note' || item.type === 'snippet') {
        breakdown.notes.bytes += bytes;
        breakdown.notes.count += 1;
      } else if (item.type === 'image' || item.type === 'video') {
        breakdown.media.bytes += bytes;
        breakdown.media.count += 1;
      } else if (item.type === 'document') {
        breakdown.documents.bytes += bytes;
        breakdown.documents.count += 1;
      } else if (item.type === 'audio') {
        breakdown.audio.bytes += bytes;
        breakdown.audio.count += 1;
      } else if (item.type === 'link') {
        breakdown.links.bytes += bytes;
        breakdown.links.count += 1;
      } else {
        breakdown.other.bytes += bytes;
        breakdown.other.count += 1;
      }
    }

    // Keep settings stored bytes synchronized
    if (settings.storageUsedBytes !== totalComputedBytes) {
      settings.storageUsedBytes = totalComputedBytes;
      await settings.save();
    }

    const limitBytes = settings.storageLimitBytes || 1073741824;
    const percent = Math.min(100, Math.round((totalComputedBytes / limitBytes) * 100));

    return {
      usedBytes: totalComputedBytes,
      limitBytes,
      percent,
      breakdown,
      totalItems: items.length
    };
  },

  /**
   * Saves a chat message to Pocket with verification that user belongs to conversation
   */
  async saveChatMessage(userId, { refId, folderId, tags = [] }) {
    const message = await Message.findById(refId).populate('sender', 'name username avatar');
    if (!message) {
      throw new Error('Message not found.');
    }

    // Security check: ensure user is a participant in this conversation
    const isMember = await chatService.isMember(message.conversation, userId);
    if (!isMember) {
      throw new Error('Access denied. You are not a member of this chat conversation.');
    }

    let type = 'message';
    if (message.type === 'image') type = 'image';
    else if (message.type === 'video') type = 'video';
    else if (message.type === 'audio' || message.type === 'voice') type = 'audio';
    else if (message.type === 'document') type = 'document';

    const senderName = message.sender ? message.sender.name || message.sender.username : 'Chat Member';
    const title = message.text ? `${message.text.slice(0, 40)}...` : `Saved message from ${senderName}`;

    // Verify storage limit before saving
    const itemBytes = (message.text ? Buffer.byteLength(message.text, 'utf8') : 0) +
      (message.media ? message.media.reduce((acc, m) => acc + (m.size || 0), 0) : 0);
    await this.checkStorageQuota(userId, itemBytes);

    const pocketItem = await PocketItem.create({
      owner: userId,
      type,
      title,
      content: message.text || '',
      media: message.media || [],
      folder: folderId || null,
      tags: Array.isArray(tags) ? tags : [],
      source: {
        kind: 'chat_message',
        refId: message._id,
        snapshot: {
          senderName,
          senderAvatar: message.sender ? message.sender.avatar : '',
          conversationId: message.conversation,
          sentAt: message.createdAt,
          originalType: message.type
        }
      }
    });

    await this.recalculateStorage(userId);
    return pocketItem;
  },

  /**
   * Saves a Social Post or Reel with privacy filter validation
   */
  async saveSocialContent(userId, { refId, kind = 'social_post', folderId, tags = [] }) {
    let authorId;
    let title = '';
    let content = '';
    let media = [];
    let authorSnapshot = {};

    if (kind === 'social_post') {
      const post = await Post.findById(refId).populate('author', 'name username avatar isPrivate isPrivateAccount');
      if (!post) throw new Error('Social post not found.');

      authorId = post.author._id;
      const canView = await canViewUser(userId, authorId);
      if (!canView) throw new Error('Access denied. You do not have permission to view this post.');

      title = post.caption ? `${post.caption.slice(0, 50)}...` : `Post by @${post.author.username}`;
      content = post.caption || '';
      media = post.media || [];
      authorSnapshot = {
        name: post.author.name,
        username: post.author.username,
        avatar: post.author.avatar,
        mediaCount: post.media ? post.media.length : 0,
        publishedAt: post.createdAt
      };
    } else if (kind === 'social_reel') {
      const reel = await Reel.findById(refId).populate('author', 'name username avatar isPrivate isPrivateAccount');
      if (!reel) throw new Error('Social reel not found.');

      authorId = reel.author._id;
      const canView = await canViewUser(userId, authorId);
      if (!canView) throw new Error('Access denied. You do not have permission to view this reel.');

      title = reel.caption ? `${reel.caption.slice(0, 50)}...` : `Reel by @${reel.author.username}`;
      content = reel.caption || '';
      media = reel.video ? [reel.video] : [];
      authorSnapshot = {
        name: reel.author.name,
        username: reel.author.username,
        avatar: reel.author.avatar,
        audioTitle: reel.audioTitle || '',
        publishedAt: reel.createdAt
      };
    } else {
      throw new Error(`Unsupported social content kind "${kind}".`);
    }

    const itemBytes = Buffer.byteLength(content, 'utf8') +
      media.reduce((acc, m) => acc + (m.size || 0), 0);
    await this.checkStorageQuota(userId, itemBytes);

    const pocketItem = await PocketItem.create({
      owner: userId,
      type: kind === 'social_reel' ? 'reel' : 'post',
      title,
      content,
      media,
      folder: folderId || null,
      tags: Array.isArray(tags) ? tags : [],
      source: {
        kind,
        refId,
        snapshot: authorSnapshot
      }
    });

    await this.recalculateStorage(userId);
    return pocketItem;
  },

  /**
   * Saves a URL to Pocket with automatic SSRF-protected link preview
   */
  async saveUrl(userId, { url, text = '', folderId, tags = [] }) {
    const preview = await linkPreviewService.getPreview(url);

    const title = preview.title || url;
    const content = text || preview.description || '';

    const itemBytes = Buffer.byteLength(title + content + url, 'utf8');
    await this.checkStorageQuota(userId, itemBytes);

    const pocketItem = await PocketItem.create({
      owner: userId,
      type: 'link',
      title,
      content,
      url,
      linkPreview: preview,
      folder: folderId || null,
      tags: Array.isArray(tags) ? tags : [],
      source: {
        kind: 'manual',
        snapshot: {
          siteName: preview.siteName,
          fetchedAt: new Date()
        }
      }
    });

    await this.recalculateStorage(userId);
    return pocketItem;
  },

  /**
   * Saves an AI Answer to Pocket (Hook for Step 8)
   */
  async saveAiAnswer(userId, { text, prompt = '', model = 'gemini-1.5-flash', folderId, tags = [] }) {
    if (!text || typeof text !== 'string') {
      throw new Error('AI answer text is required.');
    }

    const title = prompt ? `AI: ${prompt.slice(0, 50)}...` : 'AI Generated Answer';
    const itemBytes = Buffer.byteLength(title + text, 'utf8');
    await this.checkStorageQuota(userId, itemBytes);

    const pocketItem = await PocketItem.create({
      owner: userId,
      type: 'ai_answer',
      title,
      content: text,
      folder: folderId || null,
      tags: Array.isArray(tags) ? tags : ['ai', 'gemini'],
      source: {
        kind: 'ai',
        snapshot: {
          prompt,
          model,
          savedAt: new Date()
        }
      }
    });

    await this.recalculateStorage(userId);
    return pocketItem;
  },

  /**
   * Bulk-saves all messages starred by the user into Pocket
   */
  async bulkSaveStarredMessages(userId, folderId = null) {
    const starredMessages = await Message.find({
      starredBy: userId,
      deletedForEveryone: false,
      deletedFor: { $ne: userId }
    })
      .populate('sender', 'name username avatar')
      .sort({ createdAt: -1 })
      .limit(100);

    const savedItems = [];

    for (const msg of starredMessages) {
      try {
        const isMember = await chatService.isMember(msg.conversation, userId);
        if (!isMember) continue;

        // Skip if already saved
        const existing = await PocketItem.findOne({
          owner: userId,
          'source.refId': msg._id
        });
        if (existing) continue;

        let type = 'message';
        if (msg.type === 'image') type = 'image';
        else if (msg.type === 'video') type = 'video';
        else if (msg.type === 'audio' || msg.type === 'voice') type = 'audio';
        else if (msg.type === 'document') type = 'document';

        const senderName = msg.sender ? msg.sender.name || msg.sender.username : 'Chat Member';
        const title = msg.text ? `${msg.text.slice(0, 40)}...` : `Starred message from ${senderName}`;

        const item = await PocketItem.create({
          owner: userId,
          type,
          title,
          content: msg.text || '',
          media: msg.media || [],
          folder: folderId || null,
          tags: ['starred-message'],
          source: {
            kind: 'chat_message',
            refId: msg._id,
            snapshot: {
              senderName,
              senderAvatar: msg.sender ? msg.sender.avatar : '',
              conversationId: msg.conversation,
              sentAt: msg.createdAt
            }
          }
        });

        savedItems.push(item);
      } catch (err) {
        logger.warn({ err: err.message, messageId: msg._id }, 'Skipping starred message save');
      }
    }

    await this.recalculateStorage(userId);
    return savedItems;
  },

  /**
   * Cleans up trash items soft-deleted more than 30 days ago
   */
  async cleanupOldTrash() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    logger.info({ thirtyDaysAgo }, 'Starting 30-day Pocket trash automated cleanup');

    const expiredItems = await PocketItem.find({
      deletedAt: { $ne: null, $lte: thirtyDaysAgo }
    });

    let deletedCount = 0;
    const affectedUsers = new Set();

    for (const item of expiredItems) {
      affectedUsers.add(String(item.owner));

      // Destroy Cloudinary assets if any
      if (isCloudinaryConfigured && Array.isArray(item.media)) {
        for (const m of item.media) {
          if (m.publicId) {
            try {
              const resType = item.type === 'video' ? 'video' : 'image';
              await cloudinary.uploader.destroy(m.publicId, { resource_type: resType });
            } catch (cloudErr) {
              logger.warn({ err: cloudErr.message, publicId: m.publicId }, 'Cloudinary purge failed during cleanup');
            }
          }
        }
      }

      await PocketItem.deleteOne({ _id: item._id });
      deletedCount++;
    }

    // Refresh storage quotas for affected users
    for (const uid of affectedUsers) {
      await this.recalculateStorage(uid);
    }

    logger.info({ deletedCount }, 'Pocket 30-day trash cleanup finished');
    return { deletedCount };
  },

  /**
   * Builds an export ZIP file (JSON manifest + markdown notes) in background
   */
  async exportVault(userId, jobId, isUnlocked = false) {
    const jobKey = `pocket:export:${jobId}`;

    const updateJob = async (status, data = {}) => {
      const payload = { status, ...data, updatedAt: Date.now() };
      exportJobs.set(jobId, payload);
      try {
        await redisService.set(jobKey, payload, 'EX', 3600); // 1 hour job expiry
      } catch (e) {
        // Fallback to in-memory map
      }
    };

    try {
      await updateJob('processing', { progress: 10 });

      // If unlocked, export all active items; otherwise omit locked items
      const query = {
        owner: userId,
        deletedAt: null
      };
      if (!isUnlocked) {
        query.isLocked = { $ne: true };
      }

      const [items, folders, user] = await Promise.all([
        PocketItem.find(query).lean(),
        PocketFolder.find({ owner: userId }).lean(),
        User.findById(userId).select('name username email createdAt').lean()
      ]);

      await updateJob('processing', { progress: 40 });

      const zipPath = path.join(exportsDir, `pocket_export_${jobId}.zip`);
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      const folderMap = new Map();
      for (const f of folders) {
        folderMap.set(String(f._id), f.name.replace(/[/\\?%*:|"<>]/g, '_'));
      }

      archive.pipe(output);

      // 1. Append JSON Manifest
      const manifest = {
        exportedAt: new Date().toISOString(),
        user: {
          name: user ? user.name : '',
          username: user ? user.username : '',
          email: user ? user.email : ''
        },
        stats: {
          itemsCount: items.length,
          foldersCount: folders.length
        },
        folders,
        items
      };

      archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

      // 2. Append markdown notes organized into folder subdirectories
      for (const item of items) {
        const folderName = item.folder && folderMap.has(String(item.folder))
          ? folderMap.get(String(item.folder))
          : 'General';

        const safeTitle = (item.title || 'Untitled')
          .replace(/[/\\?%*:|"<>]/g, '_')
          .slice(0, 50);

        const filename = `${folderName}/${safeTitle}_${String(item._id).slice(-6)}.md`;

        const mdContent = `---
title: "${item.title || 'Untitled'}"
type: "${item.type}"
date: "${item.createdAt}"
tags: [${(item.tags || []).map((t) => `"${t}"`).join(', ')}]
favorite: ${item.isFavorite}
source: "${item.source ? item.source.kind : 'manual'}"
---

# ${item.title || 'Untitled'}

${item.url ? `**URL:** [${item.url}](${item.url})\n\n` : ''}
${item.content || ''}

${
  item.media && item.media.length > 0
    ? '\n## Media Attachments\n' +
      item.media.map((m) => `- [${m.mimeType || 'File'}](${m.url}) (${Math.round((m.size || 0) / 1024)} KB)`).join('\n')
    : ''
}
`;
        archive.append(mdContent, { name: filename });
      }

      await updateJob('processing', { progress: 80 });

      await new Promise((resolve, reject) => {
        output.on('close', resolve);
        archive.on('error', reject);
        archive.finalize();
      });

      await updateJob('completed', {
        progress: 100,
        downloadUrl: `/api/pocket/export/${jobId}/download`,
        filename: `pocket_export_${jobId}.zip`,
        expiresAt: Date.now() + 3600000 // 1 hour
      });

      logger.info({ jobId, userId }, 'Pocket export ZIP completed successfully');
    } catch (err) {
      logger.error({ err: err.message, jobId, userId }, 'Pocket export failed');
      await updateJob('failed', { error: err.message });
    }
  },

  /**
   * Retrieves export status
   */
  async getExportStatus(jobId) {
    const jobKey = `pocket:export:${jobId}`;
    try {
      const cached = await redisService.get(jobKey);
      if (cached) {
        return typeof cached === 'string' ? JSON.parse(cached) : cached;
      }
    } catch (e) {}

    return exportJobs.get(jobId) || null;
  }
};

module.exports = pocketService;
