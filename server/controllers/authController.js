const crypto = require('crypto');
const { z } = require('zod');
const User = require('../models/User');
const authService = require('../services/auth/authService');
const otpService = require('../services/otpService');
const mailer = require('../services/mailer/mailerService');
const config = require('../config/env');
const logger = require('../utils/logger');

// Validation schemas
const sendOtpSchema = z.object({
  identifier: z.string().min(3, 'Phone or email is required').trim(),
  type: z.enum(['phone', 'email']).optional()
});

const verifyOtpSchema = z.object({
  identifier: z.string().min(3, 'Phone or email is required').trim(),
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
  type: z.enum(['phone', 'email']).optional(),
  deviceId: z.string().optional()
});

const onboardingSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60).trim(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .toLowerCase()
    .trim(),
  bio: z.string().max(160, 'Bio cannot exceed 160 characters').optional().default('⚡ Hey there! I am using Flash Chat.'),
  avatar: z.string().url('Avatar must be a valid URL').optional()
});

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

/**
 * 1. Send OTP (Phone via Twilio or Email via Nodemailer)
 */
const sendOtp = async (req, res, next) => {
  try {
    const parsed = sendOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0].message
      });
    }

    const { identifier } = parsed.data;
    let { type } = parsed.data;

    // Detect type if not provided
    if (!type) {
      type = identifier.includes('@') ? 'email' : 'phone';
    }

    const result = await otpService.sendOtp(identifier, type);
    return res.status(200).json(result);
  } catch (error) {
    logger.error({ err: error.message }, 'sendOtp error');
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || 'Failed to send OTP'
    });
  }
};

/**
 * 2. Verify OTP & authenticate (Dual JWT: Access + Refresh)
 */
const verifyOtp = async (req, res, next) => {
  try {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0].message
      });
    }

    const { identifier, otp } = parsed.data;
    const isEmail = identifier.includes('@');
    const query = isEmail
      ? { email: identifier.toLowerCase().trim() }
      : { phoneNumber: identifier.trim() };

    // Verify OTP via service
    await otpService.verifyOtp(identifier, otp);

    // Find or create provisional user
    let user = await User.findOne(query);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const provisionalSeed = crypto.randomBytes(3).toString('hex');
      const provisionalUsername = `user_${provisionalSeed}`;
      const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${provisionalSeed}`;

      user = new User({
        ...(isEmail ? { email: identifier.toLowerCase().trim() } : { phoneNumber: identifier.trim() }),
        username: provisionalUsername,
        name: isEmail ? identifier.split('@')[0] : `User ${identifier.slice(-4)}`,
        avatar: defaultAvatar,
        isVerified: true,
        isOnboarded: false,
        isOnline: true,
        lastSeen: new Date()
      });
    } else {
      user.isVerified = true;
      user.isOnline = true;
      user.lastSeen = new Date();
    }

    // Generate Access (15m) and Refresh (7d) tokens
    const accessToken = authService.generateAccessToken(user._id);
    const refreshToken = authService.generateRefreshToken(user._id);

    // Save refresh token session in user document
    const deviceId = parsed.data.deviceId || crypto.randomUUID();
    const deviceInfo = req.headers['user-agent'] || 'Web Browser';

    if (!user.refreshTokens) user.refreshTokens = [];
    user.refreshTokens.push({
      token: refreshToken,
      deviceId,
      deviceInfo,
      createdAt: new Date()
    });

    // Keep at most 10 active sessions
    if (user.refreshTokens.length > 10) {
      user.refreshTokens = user.refreshTokens.slice(-10);
    }

    await user.save();

    // Set Refresh Token in httpOnly cookie
    res.cookie('refreshToken', refreshToken, authService.getRefreshCookieOptions());

    const safeUser = user.toObject();
    delete safeUser.passwordHash;
    delete safeUser.refreshTokens;
    delete safeUser.pocketPinHash;

    return res.status(200).json({
      success: true,
      message: isNewUser ? 'Welcome to Flash Chat! Please complete onboarding.' : 'Login successful',
      user: safeUser,
      accessToken,
      isOnboarded: user.isOnboarded
    });
  } catch (error) {
    logger.error({ err: error.message }, 'verifyOtp error');
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || 'OTP verification failed'
    });
  }
};

/**
 * 3. Refresh Access Token using httpOnly Refresh Token cookie
 */
const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken || req.body.refreshToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    let decoded;
    try {
      decoded = authService.verifyRefreshToken(token);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const hasSession = user.refreshTokens && user.refreshTokens.some((s) => s.token === token);
    if (!hasSession) {
      return res.status(401).json({
        success: false,
        message: 'Session has been revoked'
      });
    }

    const newAccessToken = authService.generateAccessToken(user._id);

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. User Onboarding (name, unique username, bio, avatar)
 */
const onboarding = async (req, res, next) => {
  try {
    const parsed = onboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0].message
      });
    }

    const { name, username, bio, avatar } = parsed.data;

    // Check if username taken by another user
    const existing = await User.findOne({
      username,
      _id: { $ne: req.user._id }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'This username is already taken. Please choose another.'
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        name,
        username,
        bio: bio || '⚡ Hey there! I am using Flash Chat.',
        ...(avatar ? { avatar } : {}),
        isOnboarded: true
      },
      { new: true }
    ).select('-passwordHash -refreshTokens -pocketPinHash');

    return res.status(200).json({
      success: true,
      message: 'Onboarding completed!',
      user: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Check if username is available
 */
const checkUsername = async (req, res, next) => {
  try {
    const username = (req.params.username || '').toLowerCase().trim();
    if (!username || username.length < 3) {
      return res.status(400).json({ success: false, message: 'Username too short' });
    }

    const query = { username };
    if (req.user && req.user._id) {
      query._id = { $ne: req.user._id };
    }

    const existing = await User.findOne(query);
    return res.status(200).json({
      success: true,
      available: !existing
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Get active device sessions
 */
const getSessions = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('refreshTokens');
    const currentToken = req.cookies.refreshToken;

    const sessions = (user?.refreshTokens || []).map((s) => ({
      id: s._id,
      deviceId: s.deviceId,
      deviceInfo: s.deviceInfo,
      createdAt: s.createdAt,
      isCurrent: s.token === currentToken
    }));

    return res.status(200).json({
      success: true,
      sessions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 7. Logout current session
 */
const logout = async (req, res, next) => {
  try {
    const currentToken = req.cookies.refreshToken;
    if (req.user && req.user._id) {
      await User.findByIdAndUpdate(req.user._id, {
        isOnline: false,
        lastSeen: new Date(),
        ...(currentToken ? { $pull: { refreshTokens: { token: currentToken } } } : {})
      });
    }

    const isProd = config.NODE_ENV === 'production';
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/'
    });
    res.clearCookie('token', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax'
    });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 8. Logout all devices
 */
const logoutAll = async (req, res, next) => {
  try {
    if (req.user && req.user._id) {
      await User.findByIdAndUpdate(req.user._id, {
        isOnline: false,
        lastSeen: new Date(),
        refreshTokens: []
      });
    }

    const isProd = config.NODE_ENV === 'production';
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/'
    });

    return res.status(200).json({
      success: true,
      message: 'Logged out from all devices'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 9. Get current user profile
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
 * Legacy Signup (Email & Password)
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
      isVerified: true,
      isOnboarded: true
    });

    mailer.sendWelcome(user.email, user.name);

    const accessToken = authService.generateAccessToken(user._id);
    const refreshToken = authService.generateRefreshToken(user._id);
    user.refreshTokens = [{ token: refreshToken, deviceInfo: req.headers['user-agent'] || 'Web Browser' }];
    await user.save();

    res.cookie('refreshToken', refreshToken, authService.getRefreshCookieOptions());

    const safeUser = user.toObject();
    delete safeUser.passwordHash;
    delete safeUser.refreshTokens;

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: safeUser,
      token: accessToken,
      accessToken
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Legacy Login (Email & Password)
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

    const accessToken = authService.generateAccessToken(user._id);
    const refreshToken = authService.generateRefreshToken(user._id);

    if (!user.refreshTokens) user.refreshTokens = [];
    user.refreshTokens.push({ token: refreshToken, deviceInfo: req.headers['user-agent'] || 'Web Browser' });
    await user.save();

    res.cookie('refreshToken', refreshToken, authService.getRefreshCookieOptions());

    const safeUser = user.toObject();
    delete safeUser.passwordHash;
    delete safeUser.refreshTokens;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: safeUser,
      token: accessToken,
      accessToken
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Google Auth
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
        isOnboarded: false,
        isOnline: true
      });
      mailer.sendWelcome(user.email, user.name);
    } else {
      if (!user.googleId) user.googleId = googleProfile.googleId;
      user.isOnline = true;
      user.lastSeen = new Date();
    }

    const accessToken = authService.generateAccessToken(user._id);
    const refreshToken = authService.generateRefreshToken(user._id);

    if (!user.refreshTokens) user.refreshTokens = [];
    user.refreshTokens.push({ token: refreshToken, deviceInfo: req.headers['user-agent'] || 'Web Browser' });
    await user.save();

    res.cookie('refreshToken', refreshToken, authService.getRefreshCookieOptions());

    const safeUser = user.toObject();
    delete safeUser.passwordHash;
    delete safeUser.refreshTokens;

    res.status(200).json({
      success: true,
      message: isNewUser ? 'Google registration successful' : 'Google sign-in successful',
      user: safeUser,
      token: accessToken,
      accessToken,
      isOnboarded: user.isOnboarded
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
  refreshToken,
  onboarding,
  checkUsername,
  getSessions,
  logout,
  logoutAll,
  getMe,
  signup,
  login,
  googleAuth
};
