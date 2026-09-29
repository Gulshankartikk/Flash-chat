const { z } = require('zod');
const User = require('../models/User');
const authService = require('../services/auth/authService');
const mailer = require('../services/mailer/mailerService');
const config = require('../config/env');
const logger = require('../utils/logger');

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required')
});

const googleAuthSchema = z.object({
  credential: z.string().min(1, 'Google credential token is required')
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase()
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters')
});

/**
 * Register new user with email and password
 */
const signup = async (req, res, next) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0].message
      });
    }

    const { name, email, password } = parsed.data;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    const passwordHash = await authService.hashPassword(password);
    const user = await User.create({
      name,
      email,
      passwordHash,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      isVerified: true
    });

    // Send Welcome Email asynchronously
    mailer.sendWelcome(user.email, user.name);

    const token = authService.generateToken(user._id);
    res.cookie('token', token, authService.getCookieOptions());

    const safeUser = user.toObject();
    delete safeUser.passwordHash;

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: safeUser,
      token
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login with email and password
 */
const login = async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0].message
      });
    }

    const { email, password } = parsed.data;

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !user.passwordHash) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const isMatch = await authService.comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    // Async login alert email with device, IP, and timestamp
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    const clientDevice = req.headers['user-agent'] || 'Unknown Device';
    mailer.sendLoginAlert(user.email, {
      name: user.name,
      time: new Date().toLocaleString(),
      ip: String(clientIp),
      device: clientDevice
    });

    const token = authService.generateToken(user._id);
    res.cookie('token', token, authService.getCookieOptions());

    const safeUser = user.toObject();
    delete safeUser.passwordHash;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: safeUser,
      token
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Google OAuth: Sign in / Authorize with Google
 */
const googleAuth = async (req, res, next) => {
  try {
    const parsed = googleAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0].message
      });
    }

    const { credential } = parsed.data;
    const googleProfile = await authService.verifyGoogleIdToken(credential);

    let user = await User.findOne({ email: googleProfile.email });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await User.create({
        name: googleProfile.name,
        email: googleProfile.email,
        googleId: googleProfile.googleId,
        avatar: googleProfile.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(googleProfile.name)}`,
        isVerified: true,
        isOnline: true
      });

      mailer.sendWelcome(user.email, user.name);
    } else {
      if (!user.googleId) {
        user.googleId = googleProfile.googleId;
      }
      user.isOnline = true;
      user.lastSeen = new Date();
      await user.save();

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
      const clientDevice = req.headers['user-agent'] || 'Unknown Device';
      mailer.sendLoginAlert(user.email, {
        name: user.name,
        time: new Date().toLocaleString(),
        ip: String(clientIp),
        device: clientDevice
      });
    }

    const token = authService.generateToken(user._id);
    res.cookie('token', token, authService.getCookieOptions());

    res.status(200).json({
      success: true,
      message: isNewUser ? 'Google registration successful' : 'Google sign-in successful',
      user,
      token
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout current user & clear session
 */
const logout = async (req, res, next) => {
  try {
    if (req.user && req.user._id) {
      await User.findByIdAndUpdate(req.user._id, {
        isOnline: false,
        lastSeen: new Date()
      });
    }

    const isProd = config.NODE_ENV === 'production';
    res.clearCookie('token', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax'
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current authenticated user profile
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
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
 * Request password reset email
 */
const forgotPassword = async (req, res, next) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    }

    const { email } = parsed.data;
    const user = await User.findOne({ email });

    // Always respond with success to avoid email enumeration
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been dispatched.'
      });
    }

    const resetToken = authService.generateResetToken();
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetUrl = `${config.CLIENT_URL}/reset-password?token=${resetToken}`;
    mailer.sendPasswordReset(user.email, user.name, resetUrl);

    res.status(200).json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been dispatched.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password using token
 */
const resetPassword = async (req, res, next) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    }

    const { token, newPassword } = parsed.data;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid or has expired.'
      });
    }

    user.passwordHash = await authService.hashPassword(newPassword);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password successfully reset. You may now log in.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup,
  login,
  googleAuth,
  logout,
  getMe,
  forgotPassword,
  resetPassword
};
