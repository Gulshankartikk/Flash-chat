const { z } = require('zod');
const User = require('../models/User');

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60).optional(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .toLowerCase()
    .optional(),
  bio: z.string().max(160, 'Bio cannot exceed 160 characters').optional(),
  avatar: z.string().url('Avatar must be a valid URL').optional(),
  privacy: z
    .object({
      lastSeen: z.enum(['everyone', 'contacts', 'nobody']).optional(),
      profilePhoto: z.enum(['everyone', 'contacts', 'nobody']).optional(),
      readReceipts: z.boolean().optional()
    })
    .optional(),
  privacySettings: z
    .object({
      lastSeen: z.enum(['everyone', 'contacts', 'nobody']).optional(),
      profilePhoto: z.enum(['everyone', 'contacts', 'nobody']).optional(),
      readReceipts: z.boolean().optional()
    })
    .optional(),
  isPrivateAccount: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional()
});

/**
 * GET /api/users/me
 * Get current authenticated user profile
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-passwordHash -refreshTokens -pocketPinHash')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/users/me
 * Update authenticated user profile, privacy settings, and preferences
 */
const updateMe = async (req, res, next) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0].message
      });
    }

    const updates = parsed.data;

    // Check username uniqueness if changed
    if (updates.username) {
      const existingUser = await User.findOne({
        username: updates.username,
        _id: { $ne: req.user._id }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'This username is already taken. Please choose another.'
        });
      }
    }

    // Keep privacy & privacySettings in sync
    const privacyData = updates.privacy || updates.privacySettings;
    const updateQuery = {};

    if (updates.name !== undefined) updateQuery.name = updates.name.trim();
    if (updates.username !== undefined) updateQuery.username = updates.username.trim();
    if (updates.bio !== undefined) updateQuery.bio = updates.bio.trim();
    if (updates.avatar !== undefined) updateQuery.avatar = updates.avatar;
    if (updates.theme !== undefined) updateQuery.theme = updates.theme;

    if (updates.isPrivateAccount !== undefined || updates.isPrivate !== undefined) {
      const isPriv = updates.isPrivateAccount !== undefined ? updates.isPrivateAccount : updates.isPrivate;
      updateQuery.isPrivateAccount = isPriv;
      updateQuery.isPrivate = isPriv;
    }

    if (privacyData) {
      if (privacyData.lastSeen !== undefined) {
        updateQuery['privacy.lastSeen'] = privacyData.lastSeen;
        updateQuery['privacySettings.lastSeen'] = privacyData.lastSeen;
      }
      if (privacyData.profilePhoto !== undefined) {
        updateQuery['privacy.profilePhoto'] = privacyData.profilePhoto;
        updateQuery['privacySettings.profilePhoto'] = privacyData.profilePhoto;
      }
      if (privacyData.readReceipts !== undefined) {
        updateQuery['privacy.readReceipts'] = privacyData.readReceipts;
        updateQuery['privacySettings.readReceipts'] = privacyData.readReceipts;
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateQuery },
      { new: true, runValidators: true }
    )
      .select('-passwordHash -refreshTokens -pocketPinHash')
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/search?q=&page=&limit=
 * Case-insensitive search on username and name, paginated, excludes self
 */
const searchUsers = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    if (!q) {
      return res.status(200).json({
        success: true,
        users: [],
        total: 0,
        page,
        totalPages: 0
      });
    }

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const filter = {
      _id: { $ne: req.user._id },
      isOnboarded: true,
      $or: [{ username: regex }, { name: regex }]
    };

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('_id name username avatar bio isOnline lastSeen isPrivateAccount followersCount')
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/:username
 * Public profile endpoint
 */
const getPublicProfile = async (req, res, next) => {
  try {
    const username = (req.params.username || '').toLowerCase().trim();
    const Block = require('../models/Block');
    const Follow = require('../models/Follow');
    const Story = require('../models/Story');

    const user = await User.findOne({ username })
      .select(
        '_id name username avatar bio isOnline lastSeen isPrivateAccount followersCount followingCount postsCount createdAt privacy'
      )
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }

    // Check if target has blocked current user
    const blockedByTarget = await Block.findOne({ blocker: user._id, blocked: req.user._id });
    if (blockedByTarget) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }

    // Check if current user blocked target
    const blockedByMe = await Block.findOne({ blocker: req.user._id, blocked: user._id });
    user.isBlockedByMe = Boolean(blockedByMe);

    // Follow status
    const followDoc = await Follow.findOne({ follower: req.user._id, following: user._id });
    user.followStatus = followDoc ? followDoc.status : 'none'; // 'accepted' | 'pending' | 'none'

    // Check if target is following current viewer
    const followingViewerDoc = await Follow.findOne({
      follower: user._id,
      following: req.user._id,
      status: 'accepted'
    });
    user.isFollowingViewer = Boolean(followingViewerDoc);

    // Active story check
    const hasStory = await Story.exists({
      author: user._id,
      expiresAt: { $gt: new Date() }
    });
    user.hasActiveStory = Boolean(hasStory);

    // Mask lastSeen if user privacy is set to 'nobody'
    if (user.privacy?.lastSeen === 'nobody' && String(user._id) !== String(req.user._id)) {
      delete user.lastSeen;
      delete user.isOnline;
    }

    return res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/check-username/:username
 * Live username availability check
 */
const checkUsername = async (req, res, next) => {
  try {
    const username = (req.params.username || '').toLowerCase().trim();

    if (!username || username.length < 3) {
      return res.status(400).json({
        success: false,
        available: false,
        message: 'Username must be at least 3 characters'
      });
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({
        success: false,
        available: false,
        message: 'Username can only contain letters, numbers, and underscores (3-30 chars)'
      });
    }

    const query = { username };
    if (req.user && req.user._id) {
      query._id = { $ne: req.user._id };
    }

    const existing = await User.findOne(query);

    return res.status(200).json({
      success: true,
      available: !existing,
      message: existing ? 'Username is taken' : 'Username is available'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/users/:id/block - Block a user
 */
const blockUser = async (req, res, next) => {
  try {
    const Block = require('../models/Block');
    const Follow = require('../models/Follow');
    const targetUserId = req.params.id;

    if (String(req.user._id) === String(targetUserId)) {
      return res.status(400).json({ success: false, message: 'You cannot block yourself.' });
    }

    const existing = await Block.findOne({ blocker: req.user._id, blocked: targetUserId });
    if (!existing) {
      await Block.create({ blocker: req.user._id, blocked: targetUserId });
    }

    // Sever any follow relationships in either direction
    const deletedFollows = await Follow.find({
      $or: [
        { follower: req.user._id, following: targetUserId },
        { follower: targetUserId, following: req.user._id }
      ],
      status: 'accepted'
    });

    for (const f of deletedFollows) {
      await User.findByIdAndUpdate(f.follower, { $inc: { followingCount: -1 } });
      await User.findByIdAndUpdate(f.following, { $inc: { followersCount: -1 } });
    }

    await Follow.deleteMany({
      $or: [
        { follower: req.user._id, following: targetUserId },
        { follower: targetUserId, following: req.user._id }
      ]
    });

    return res.status(200).json({ success: true, message: 'User blocked successfully.' });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/users/:id/block - Unblock a user
 */
const unblockUser = async (req, res, next) => {
  try {
    const Block = require('../models/Block');
    await Block.findOneAndDelete({ blocker: req.user._id, blocked: req.params.id });
    return res.status(200).json({ success: true, message: 'User unblocked successfully.' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/blocked - List blocked users
 */
const getBlockedUsers = async (req, res, next) => {
  try {
    const Block = require('../models/Block');
    const blocks = await Block.find({ blocker: req.user._id })
      .populate('blocked', '_id name username avatar')
      .lean();

    return res.status(200).json({
      success: true,
      data: blocks.map((b) => b.blocked)
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMe,
  updateMe,
  searchUsers,
  getPublicProfile,
  checkUsername,
  blockUser,
  unblockUser,
  getBlockedUsers
};
