const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 60
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: {
      type: String,
      select: false
    },
    googleId: {
      type: String,
      sparse: true,
      index: true
    },
    avatar: {
      type: String,
      default: 'https://api.dicebear.com/7.x/bottts/svg?seed=Flash'
    },
    bio: {
      type: String,
      default: 'Hey there! I am using Flash Chat.',
      maxlength: 160
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    isOnline: {
      type: Boolean,
      default: false,
      index: true
    },
    lastSeen: {
      type: Date,
      default: Date.now
    },
    otp: {
      type: String,
      select: false
    },
    otpExpires: {
      type: Date,
      select: false
    },
    resetPasswordToken: {
      type: String,
      select: false
    },
    resetPasswordExpires: {
      type: Date,
      select: false
    }
  },
  {
    timestamps: true
  }
);

userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ name: 'text', email: 'text' });

module.exports = mongoose.model('User', userSchema);
