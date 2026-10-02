const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const PocketItem = require('../models/PocketItem');
const PocketFolder = require('../models/PocketFolder');
const PocketSettings = require('../models/PocketSettings');
const pocketService = require('../services/pocketService');
const linkPreviewService = require('../services/linkPreviewService');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const redisService = require('../services/redisService');
const config = require('../config/env');
const logger = require('../utils/logger');

// --- Zod Validation Schemas ---

const createItemSchema = z.object({
  type: z.enum([
    'note',
    'link',
    'image',
    'video',
    'audio',
    'document',
    'snippet',
    'message',
    'post',
    'reel',
    'ai_answer'
  ]),
  title: z.string().max(300).optional(),
  content: z.string().max(1048576).optional(), // Max 1MB content limit
  url: z.string().url().optional().or(z.literal('')),
  linkPreview: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      image: z.string().optional(),
      favicon: z.string().optional(),
      siteName: z.string().optional()
    })
    .optional(),
  media: z
    .array(
      z.object({
        url: z.string().url(),
        publicId: z.string().optional(),
        mimeType: z.string().optional(),
        size: z.number().optional(),
        duration: z.number().optional(),
        thumbnail: z.string().optional()
      })
    )
    .max(20)
    .optional(),
  folder: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  isFavorite: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  isLocked: z.boolean().optional(),
  isEncrypted: z.boolean().optional(),
  encryption: z
    .object({
      iv: z.string().optional(),
      salt: z.string().optional()
    })
    .optional(),
  source: z.any().optional()
});

const updateItemSchema = z.object({
  title: z.string().max(300).optional(),
  content: z.string().max(1048576).optional(),
  folder: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  isFavorite: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  isLocked: z.boolean().optional(),
  isEncrypted: z.boolean().optional(),
  encryption: z
    .object({
      iv: z.string().optional(),
      salt: z.string().optional()
    })
    .optional(),
  media: z
    .array(
      z.object({
        url: z.string().url(),
        publicId: z.string().optional(),
        mimeType: z.string().optional(),
        size: z.number().optional(),
        duration: z.number().optional(),
        thumbnail: z.string().optional()
      })
    )
    .max(20)
    .optional()
});

const bulkActionSchema = z.object({
  ids: z.array(z.string()).min(1),
  action: z.enum(['move', 'tag', 'delete', 'favorite']),
  folderId: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  isFavorite: z.boolean().optional()
});

const folderSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(60),
  color: z.string().optional(),
  icon: z.string().optional(),
  parent: z.string().nullable().optional(),
  order: z.number().optional()
});

const pinSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be between 4 and 6 numeric digits'),
  currentPin: z.string().optional()
});

const saveAnywhereSchema = z.object({
  from: z.enum(['chat_message', 'social_post', 'social_reel', 'ai_answer', 'url']),
  refId: z.string().optional(),
  url: z.string().optional(),
  text: z.string().optional(),
  folderId: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  prompt: z.string().optional(),
  model: z.string().optional()
});

// --- Controller Handlers ---

const pocketController = {
  /**
   * POST /api/pocket/items - Create a new Pocket Item
   */
  async createItem(req, res, next) {
    try {
      const parsed = createItemSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          errors: parsed.error.format()
        });
      }

      const itemData = parsed.data;

      // Calculate approximate item size
      const contentBytes = Buffer.byteLength(itemData.content || '', 'utf8') +
        Buffer.byteLength(itemData.title || '', 'utf8');
      const mediaBytes = (itemData.media || []).reduce((acc, m) => acc + (m.size || 0), 0);
      const totalBytes = contentBytes + mediaBytes;

      // Verify storage limit
      await pocketService.checkStorageQuota(req.user._id, totalBytes);

      const newItem = await PocketItem.create({
        ...itemData,
        owner: req.user._id,
        folder: itemData.folder || null,
        tags: itemData.tags ? itemData.tags.map((t) => t.trim().toLowerCase()) : []
      });

      await pocketService.recalculateStorage(req.user._id);

      return res.status(201).json({
        success: true,
        item: newItem
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/pocket/items - List active Pocket items with cursor pagination & filters
   */
  async getItems(req, res, next) {
    try {
      const {
        type,
        folder,
        tag,
        favorite,
        pinned,
        q,
        cursor,
        limit = 20
      } = req.query;

      const pageLimit = Math.min(parseInt(limit, 10) || 20, 50);

      // Security check: owner only and non-deleted
      const query = {
        owner: req.user._id,
        deletedAt: null
      };

      // Filter: Locked items
      // If the vault is NOT currently unlocked via valid X-Pocket-Token, hide locked items
      if (!req.isPocketUnlocked) {
        query.isLocked = { $ne: true };
      }

      // Filter: Type
      if (type && type !== 'all') {
        if (type === 'media') {
          query.type = { $in: ['image', 'video'] };
        } else if (type === 'chats') {
          query['source.kind'] = 'chat_message';
        } else if (type === 'social') {
          query['source.kind'] = { $in: ['social_post', 'social_reel'] };
        } else if (type === 'ai') {
          query.type = 'ai_answer';
        } else {
          query.type = type;
        }
      }

      // Filter: Folder
      if (folder) {
        if (folder === 'none' || folder === 'unorganized') {
          query.folder = null;
        } else {
          query.folder = folder;
        }
      }

      // Filter: Tag
      if (tag) {
        query.tags = tag.toLowerCase().trim();
      }

      // Filter: Favorite
      if (favorite === 'true') {
        query.isFavorite = true;
      }

      // Filter: Pinned
      if (pinned === 'true') {
        query.isPinned = true;
      }

      // Filter: Search query (case-insensitive title/content/tags)
      if (q && q.trim()) {
        const regex = new RegExp(q.trim(), 'i');
        query.$or = [
          { title: regex },
          { content: regex },
          { tags: regex },
          { url: regex }
        ];
      }

      // Cursor Pagination
      if (cursor) {
        const cursorDate = new Date(cursor);
        if (!isNaN(cursorDate.getTime())) {
          query.createdAt = { $lt: cursorDate };
        }
      }

      const items = await PocketItem.find(query)
        .sort({ isPinned: -1, createdAt: -1 })
        .limit(pageLimit + 1)
        .populate('folder', 'name color icon')
        .lean();

      let hasMore = false;
      let nextCursor = null;

      if (items.length > pageLimit) {
        hasMore = true;
        items.pop(); // Remove extra peeked item
        nextCursor = items[items.length - 1].createdAt.toISOString();
      }

      return res.status(200).json({
        success: true,
        items,
        nextCursor,
        hasMore
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/pocket/items/:id - Retrieve a single item
   */
  async getItemById(req, res, next) {
    try {
      // Compound query ensuring STRICT owner check
      const item = await PocketItem.findOne({
        _id: req.params.id,
        owner: req.user._id
      }).populate('folder', 'name color icon');

      // Crucial requirement: if item does not exist or belongs to another user, return 404
      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Pocket item not found.'
        });
      }

      // If item is locked and user has not supplied a verified Pocket unlock token, block access
      if (item.isLocked && !req.isPocketUnlocked) {
        return res.status(403).json({
          success: false,
          code: 'ITEM_LOCKED',
          message: 'This item is locked. Vault PIN required to view.'
        });
      }

      return res.status(200).json({
        success: true,
        item
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/pocket/items/:id - Update item fields
   */
  async updateItem(req, res, next) {
    try {
      const parsed = updateItemSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          errors: parsed.error.format()
        });
      }

      const item = await PocketItem.findOne({
        _id: req.params.id,
        owner: req.user._id,
        deletedAt: null
      });

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Pocket item not found.'
        });
      }

      // If item was already locked, user must have unlocked vault
      if (item.isLocked && !req.isPocketUnlocked) {
        return res.status(403).json({
          success: false,
          code: 'ITEM_LOCKED',
          message: 'Vault PIN required to edit this locked item.'
        });
      }

      const updateData = parsed.data;
      if (updateData.tags) {
        updateData.tags = updateData.tags.map((t) => t.trim().toLowerCase());
      }

      Object.assign(item, updateData);
      await item.save();

      await pocketService.recalculateStorage(req.user._id);

      return res.status(200).json({
        success: true,
        item
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/pocket/items/:id - Soft delete item to trash
   */
  async softDeleteItem(req, res, next) {
    try {
      const item = await PocketItem.findOne({
        _id: req.params.id,
        owner: req.user._id
      });

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Pocket item not found.'
        });
      }

      item.deletedAt = new Date();
      await item.save();

      return res.status(200).json({
        success: true,
        message: 'Item moved to trash.'
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/pocket/items/bulk - Bulk actions (move, tag, delete, favorite)
   */
  async bulkAction(req, res, next) {
    try {
      const parsed = bulkActionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          errors: parsed.error.format()
        });
      }

      const { ids, action, folderId, tags, isFavorite } = parsed.data;

      const filter = {
        _id: { $in: ids },
        owner: req.user._id
      };

      let result;

      if (action === 'delete') {
        result = await PocketItem.updateMany(filter, {
          $set: { deletedAt: new Date() }
        });
      } else if (action === 'move') {
        result = await PocketItem.updateMany(filter, {
          $set: { folder: folderId || null }
        });
      } else if (action === 'tag') {
        const cleanTags = (tags || []).map((t) => t.trim().toLowerCase());
        result = await PocketItem.updateMany(filter, {
          $addToSet: { tags: { $each: cleanTags } }
        });
      } else if (action === 'favorite') {
        result = await PocketItem.updateMany(filter, {
          $set: { isFavorite: isFavorite !== undefined ? isFavorite : true }
        });
      }

      return res.status(200).json({
        success: true,
        modifiedCount: result.modifiedCount || 0
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/pocket/trash - List soft-deleted items
   */
  async getTrash(req, res, next) {
    try {
      const { cursor, limit = 20 } = req.query;
      const pageLimit = Math.min(parseInt(limit, 10) || 20, 50);

      const query = {
        owner: req.user._id,
        deletedAt: { $ne: null }
      };

      if (cursor) {
        const cursorDate = new Date(cursor);
        if (!isNaN(cursorDate.getTime())) {
          query.deletedAt = { $lt: cursorDate };
        }
      }

      const items = await PocketItem.find(query)
        .sort({ deletedAt: -1 })
        .limit(pageLimit + 1)
        .lean();

      let hasMore = false;
      let nextCursor = null;

      if (items.length > pageLimit) {
        hasMore = true;
        items.pop();
        nextCursor = items[items.length - 1].deletedAt.toISOString();
      }

      return res.status(200).json({
        success: true,
        items,
        nextCursor,
        hasMore
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/pocket/items/:id/restore - Restore an item from trash
   */
  async restoreTrashItem(req, res, next) {
    try {
      const item = await PocketItem.findOne({
        _id: req.params.id,
        owner: req.user._id
      });

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Pocket item not found in trash.'
        });
      }

      item.deletedAt = null;
      await item.save();

      return res.status(200).json({
        success: true,
        message: 'Item restored successfully.',
        item
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/pocket/items/:id/permanent - Permanently delete item & clean Cloudinary assets
   */
  async permanentDeleteItem(req, res, next) {
    try {
      const item = await PocketItem.findOne({
        _id: req.params.id,
        owner: req.user._id
      });

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Pocket item not found.'
        });
      }

      // Cleanup Cloudinary media if applicable
      if (isCloudinaryConfigured && Array.isArray(item.media)) {
        for (const m of item.media) {
          if (m.publicId) {
            try {
              const resType = item.type === 'video' ? 'video' : 'image';
              await cloudinary.uploader.destroy(m.publicId, { resource_type: resType });
            } catch (cloudErr) {
              logger.warn({ err: cloudErr.message, publicId: m.publicId }, 'Cloudinary destroy failed');
            }
          }
        }
      }

      await PocketItem.deleteOne({ _id: item._id });
      await pocketService.recalculateStorage(req.user._id);

      return res.status(200).json({
        success: true,
        message: 'Item permanently deleted.'
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/pocket/folders - List all folders with active item counts
   */
  async getFolders(req, res, next) {
    try {
      const folders = await PocketFolder.find({ owner: req.user._id })
        .sort({ order: 1, createdAt: 1 })
        .lean();

      // Aggregate counts of active items in each folder
      const folderCounts = await PocketItem.aggregate([
        { $match: { owner: req.user._id, deletedAt: null } },
        { $group: { _id: '$folder', count: { $sum: 1 } } }
      ]);

      const countMap = new Map();
      let unorganizedCount = 0;

      for (const fc of folderCounts) {
        if (!fc._id) {
          unorganizedCount = fc.count;
        } else {
          countMap.set(String(fc._id), fc.count);
        }
      }

      const foldersWithCounts = folders.map((f) => ({
        ...f,
        itemCount: countMap.get(String(f._id)) || 0
      }));

      return res.status(200).json({
        success: true,
        folders: foldersWithCounts,
        unorganizedCount
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/pocket/folders - Create folder
   */
  async createFolder(req, res, next) {
    try {
      const parsed = folderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          errors: parsed.error.format()
        });
      }

      const { name, color, icon, parent } = parsed.data;

      // Check unique name under same parent
      const existing = await PocketFolder.findOne({
        owner: req.user._id,
        name: name.trim(),
        parent: parent || null
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'A folder with this name already exists in this location.'
        });
      }

      const folder = await PocketFolder.create({
        owner: req.user._id,
        name: name.trim(),
        color: color || '#F97316',
        icon: icon || 'folder',
        parent: parent || null
      });

      return res.status(201).json({
        success: true,
        folder
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/pocket/folders/:id - Update folder
   */
  async updateFolder(req, res, next) {
    try {
      const parsed = folderSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          errors: parsed.error.format()
        });
      }

      const folder = await PocketFolder.findOne({
        _id: req.params.id,
        owner: req.user._id
      });

      if (!folder) {
        return res.status(404).json({
          success: false,
          message: 'Folder not found.'
        });
      }

      Object.assign(folder, parsed.data);
      await folder.save();

      return res.status(200).json({
        success: true,
        folder
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/pocket/folders/:id - Delete folder and detach its items
   */
  async deleteFolder(req, res, next) {
    try {
      const folder = await PocketFolder.findOne({
        _id: req.params.id,
        owner: req.user._id
      });

      if (!folder) {
        return res.status(404).json({
          success: false,
          message: 'Folder not found.'
        });
      }

      // Detach items that were in this folder
      await PocketItem.updateMany(
        { owner: req.user._id, folder: folder._id },
        { $set: { folder: null } }
      );

      // Detach child subfolders
      await PocketFolder.updateMany(
        { owner: req.user._id, parent: folder._id },
        { $set: { parent: null } }
      );

      await PocketFolder.deleteOne({ _id: folder._id });

      return res.status(200).json({
        success: true,
        message: 'Folder deleted and items moved to Unorganized.'
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/pocket/folders/reorder - Reorder folders array
   */
  async reorderFolders(req, res, next) {
    try {
      const { orders } = req.body;
      if (!Array.isArray(orders)) {
        return res.status(400).json({ success: false, message: 'Invalid orders array.' });
      }

      const bulkOps = orders.map((o) => ({
        updateOne: {
          filter: { _id: o.id, owner: req.user._id },
          update: { $set: { order: o.order } }
        }
      }));

      if (bulkOps.length > 0) {
        await PocketFolder.bulkWrite(bulkOps);
      }

      return res.status(200).json({ success: true, message: 'Folder order updated.' });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/pocket/tags - List user tags with counts
   */
  async getTags(req, res, next) {
    try {
      const tags = await PocketItem.aggregate([
        { $match: { owner: req.user._id, deletedAt: null } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } }
      ]);

      const formatted = tags.map((t) => ({ name: t._id, count: t.count }));

      return res.status(200).json({
        success: true,
        tags: formatted
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/pocket/tags/rename - Rename tag across items
   */
  async renameTag(req, res, next) {
    try {
      const { oldTag, newTag } = req.body;
      if (!oldTag || !newTag) {
        return res.status(400).json({ success: false, message: 'Both oldTag and newTag are required.' });
      }

      const cleanOld = oldTag.trim().toLowerCase();
      const cleanNew = newTag.trim().toLowerCase();

      await PocketItem.updateMany(
        { owner: req.user._id, tags: cleanOld },
        {
          $pull: { tags: cleanOld },
          $addToSet: { tags: cleanNew }
        }
      );

      return res.status(200).json({
        success: true,
        message: `Tag "${cleanOld}" renamed to "${cleanNew}".`
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/pocket/save - Save from anywhere (chat_message, social_post, social_reel, url, ai_answer)
   */
  async saveFromAnywhere(req, res, next) {
    try {
      const parsed = saveAnywhereSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          errors: parsed.error.format()
        });
      }

      const { from, refId, url, text, folderId, tags, prompt, model } = parsed.data;
      let item;

      if (from === 'chat_message') {
        if (!refId) return res.status(400).json({ success: false, message: 'refId is required for chat message.' });
        item = await pocketService.saveChatMessage(req.user._id, { refId, folderId, tags });
      } else if (from === 'social_post') {
        if (!refId) return res.status(400).json({ success: false, message: 'refId is required for social post.' });
        item = await pocketService.saveSocialContent(req.user._id, { refId, kind: 'social_post', folderId, tags });
      } else if (from === 'social_reel') {
        if (!refId) return res.status(400).json({ success: false, message: 'refId is required for social reel.' });
        item = await pocketService.saveSocialContent(req.user._id, { refId, kind: 'social_reel', folderId, tags });
      } else if (from === 'url') {
        if (!url) return res.status(400).json({ success: false, message: 'URL is required.' });
        item = await pocketService.saveUrl(req.user._id, { url, text, folderId, tags });
      } else if (from === 'ai_answer') {
        if (!text) return res.status(400).json({ success: false, message: 'AI answer text is required.' });
        item = await pocketService.saveAiAnswer(req.user._id, { text, prompt, model, folderId, tags });
      }

      return res.status(201).json({
        success: true,
        item
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/pocket/save-starred - Bulk save starred chat messages
   */
  async saveStarredMessages(req, res, next) {
    try {
      const { folderId } = req.body;
      const savedItems = await pocketService.bulkSaveStarredMessages(req.user._id, folderId);

      return res.status(200).json({
        success: true,
        savedCount: savedItems.length,
        items: savedItems
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/pocket/preview - SSRF protected Link Preview
   */
  async getLinkPreview(req, res, next) {
    try {
      const targetUrl = req.query.url || req.body.url;
      if (!targetUrl) {
        return res.status(400).json({ success: false, message: 'URL query parameter is required.' });
      }

      const preview = await linkPreviewService.getPreview(targetUrl);
      return res.status(200).json({
        success: true,
        preview
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Failed to fetch link preview.'
      });
    }
  },

  /**
   * GET /api/pocket/storage - Storage metrics & breakdown
   */
  async getStorage(req, res, next) {
    try {
      const metrics = await pocketService.getStorageBreakdown(req.user._id);
      return res.status(200).json({
        success: true,
        storage: metrics
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/pocket/export - Start background export job
   */
  async startExport(req, res, next) {
    try {
      const jobId = crypto.randomUUID();
      // Start background packaging job
      pocketService.exportVault(req.user._id, jobId, req.isPocketUnlocked);

      return res.status(202).json({
        success: true,
        jobId,
        message: 'Pocket vault export started.'
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/pocket/export/:jobId - Check export status
   */
  async getExportStatus(req, res, next) {
    try {
      const status = await pocketService.getExportStatus(req.params.jobId);
      if (!status) {
        return res.status(404).json({ success: false, message: 'Export job not found or expired.' });
      }

      return res.status(200).json({
        success: true,
        job: status
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/pocket/export/:jobId/download - Download export ZIP
   */
  async downloadExport(req, res, next) {
    try {
      const zipPath = path.join(__dirname, '..', 'uploads', 'exports', `pocket_export_${req.params.jobId}.zip`);
      if (!fs.existsSync(zipPath)) {
        return res.status(404).json({ success: false, message: 'Export file not found or expired.' });
      }

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="pocket_export.zip"`);

      const fileStream = fs.createReadStream(zipPath);
      fileStream.pipe(res);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/pocket/pin - Set or change vault PIN
   */
  async setPin(req, res, next) {
    try {
      const parsed = pinSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          errors: parsed.error.format()
        });
      }

      const { pin, currentPin } = parsed.data;
      const settings = await PocketSettings.findOne({ user: req.user._id }).select('+pinHash');

      if (settings && settings.pinHash) {
        if (!currentPin) {
          return res.status(400).json({
            success: false,
            message: 'Current PIN is required to change PIN.'
          });
        }
        const matches = await bcrypt.compare(currentPin, settings.pinHash);
        if (!matches) {
          return res.status(401).json({
            success: false,
            message: 'Current PIN is incorrect.'
          });
        }
      }

      const hashed = await bcrypt.hash(pin, 10);
      await PocketSettings.findOneAndUpdate(
        { user: req.user._id },
        {
          pinHash: hashed,
          pinSetAt: new Date(),
          failedPinAttempts: 0,
          lockedUntil: null
        },
        { upsert: true }
      );

      return res.status(200).json({
        success: true,
        message: 'Vault PIN configured successfully.'
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/pocket/pin/verify - Verify PIN with brute-force lockout (5 attempts -> 15 min lock)
   */
  async verifyPin(req, res, next) {
    try {
      const { pin } = req.body;
      if (!pin || typeof pin !== 'string') {
        return res.status(400).json({ success: false, message: 'PIN is required.' });
      }

      const userId = String(req.user._id);
      const lockKey = `pocket:locked:${userId}`;
      const attemptsKey = `pocket:pin_attempts:${userId}`;

      // Check lockout status
      const isLocked = await redisService.get(lockKey);
      if (isLocked) {
        return res.status(423).json({
          success: false,
          code: 'VAULT_TEMPORARILY_LOCKED',
          message: 'Too many incorrect attempts. Vault is temporarily locked for 15 minutes.'
        });
      }

      const settings = await PocketSettings.findOne({ user: req.user._id }).select('+pinHash');
      if (!settings || !settings.pinHash) {
        return res.status(400).json({
          success: false,
          message: 'No PIN is set for this vault. Please set a PIN in settings.'
        });
      }

      const isMatch = await bcrypt.compare(pin, settings.pinHash);

      if (!isMatch) {
        const attempts = await redisService.incr(attemptsKey);
        await redisService.expire(attemptsKey, 900); // 15 min window

        if (attempts >= 5) {
          // Lock out user for 15 minutes (900 seconds)
          await redisService.set(lockKey, '1', 'EX', 900);
          await PocketSettings.findOneAndUpdate(
            { user: req.user._id },
            { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) }
          );

          return res.status(423).json({
            success: false,
            code: 'VAULT_TEMPORARILY_LOCKED',
            message: 'Too many incorrect attempts (5/5). Vault locked for 15 minutes.'
          });
        }

        return res.status(401).json({
          success: false,
          message: `Incorrect PIN. ${5 - attempts} attempts remaining.`
        });
      }

      // Successful verification: clear failed attempts
      await redisService.del(attemptsKey);
      await redisService.del(lockKey);

      // Generate a 10-minute scoped unlock token
      const accessSecret = config.JWT_ACCESS_SECRET || config.JWT_SECRET;
      const pocketToken = jwt.sign(
        {
          id: req.user._id,
          scope: 'pocket'
        },
        accessSecret,
        { expiresIn: '10m' }
      );

      return res.status(200).json({
        success: true,
        token: pocketToken,
        expiresIn: 600
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/pocket/pin - Remove PIN lock
   */
  async removePin(req, res, next) {
    try {
      const { pin } = req.body;
      if (!pin) {
        return res.status(400).json({ success: false, message: 'Current PIN is required to remove PIN.' });
      }

      const settings = await PocketSettings.findOne({ user: req.user._id }).select('+pinHash');
      if (!settings || !settings.pinHash) {
        return res.status(400).json({ success: false, message: 'No PIN is currently configured.' });
      }

      const matches = await bcrypt.compare(pin, settings.pinHash);
      if (!matches) {
        return res.status(401).json({ success: false, message: 'Incorrect PIN.' });
      }

      settings.pinHash = null;
      settings.pinSetAt = null;
      settings.failedPinAttempts = 0;
      settings.lockedUntil = null;
      await settings.save();

      return res.status(200).json({
        success: true,
        message: 'Vault PIN removed successfully.'
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/pocket/search - Search items with text index and tag/type filtering
   */
  async searchItems(req, res, next) {
    try {
      const { q, type, tag } = req.query;

      const query = {
        owner: req.user._id,
        deletedAt: null
      };

      // Locked items exclusion if not unlocked
      if (!req.isPocketUnlocked) {
        query.isLocked = { $ne: true };
      }

      if (type && type !== 'all') {
        query.type = type;
      }

      if (tag) {
        query.tags = tag.toLowerCase().trim();
      }

      if (q && q.trim()) {
        const regex = new RegExp(q.trim(), 'i');
        // Search text or regex match on title, content, or tags
        // Exclude client-encrypted ciphertext from text regex matching to avoid garbled false positives
        query.$or = [
          { title: regex },
          { tags: regex },
          { $and: [{ isEncrypted: { $ne: true } }, { content: regex }] }
        ];
      }

      const items = await PocketItem.find(query)
        .sort({ isPinned: -1, createdAt: -1 })
        .limit(30)
        .populate('folder', 'name color icon')
        .lean();

      return res.status(200).json({
        success: true,
        items
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = pocketController;
