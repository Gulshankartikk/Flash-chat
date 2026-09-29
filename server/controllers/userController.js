const { z } = require('zod');
const User = require('../models/User');

const updateProfileSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  bio: z.string().max(160).optional(),
  avatar: z.string().url().optional()
});

/**
 * Search users by query string (name or email)
 */
const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim() === '') {
      return res.status(200).json({ success: true, users: [] });
    }

    const regex = new RegExp(q.trim(), 'i');
    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [{ name: regex }, { email: regex }]
    })
      .select('_id name email avatar isOnline lastSeen bio')
      .limit(20)
      .lean();

    res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get profile by ID
 */
const getProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id)
      .select('_id name email avatar isOnline lastSeen bio createdAt')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update authenticated user profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: parsed.data },
      { new: true, runValidators: true }
    )
      .select('-passwordHash')
      .lean();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchUsers,
  getProfile,
  updateProfile
};
