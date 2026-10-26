const crypto = require('crypto');
const { z } = require('zod');
const User = require('../models/User');
const authService = require('../services/auth/authService');
const otpService = require('../services/otpService');
const mailer = require('../services/mailer/mailerService');
const contactService = require('../services/contactService');
const config = require('../config/env');
const logger = require('../utils/logger');
const { normalizePhone, buildPhoneSearchQuery } = require('../utils/phoneUtils');

const redis = require('../services/redisService');

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
  name: z.string().min(2, 'Name must be at least 2 characters').max(60).trim(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .toLowerCase()
    .trim()
    .optional(),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  phoneNumber: z.string().trim().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const loginSchema = z.object({
  identifier: z.string().min(1, 'Email, username, or phone is required').trim().optional(),
  email: z.string().trim().optional(),
  password: z.string().min(1, 'Password is required')
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim()
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters')
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

    const finalIdentifier = type === 'phone' ? normalizePhone(identifier) : identifier.toLowerCase().trim();
    const result = await otpService.sendOtp(finalIdentifier, type);
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
    const finalIdentifier = isEmail ? identifier.toLowerCase().trim() : normalizePhone(identifier);
    const query = isEmail
      ? { email: finalIdentifier }
      : buildPhoneSearchQuery(finalIdentifier);

    // Verify OTP via service
    await otpService.verifyOtp(finalIdentifier, otp);

    // Find or create provisional user
    let user = await User.findOne(query);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const provisionalSeed = crypto.randomBytes(3).toString('hex');
      const provisionalUsername = `user_${provisionalSeed}`;
      const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${provisionalSeed}`;

      user = new User({
        ...(isEmail ? { email: finalIdentifier } : { phoneNumber: finalIdentifier }),
        username: provisionalUsername,
        name: isEmail ? finalIdentifier.split('@')[0] : `User ${finalIdentifier.slice(-4)}`,
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
      // If user had un-normalized phone, standardize it to E.164
      if (!isEmail && (!user.phoneNumber || !user.phoneNumber.startsWith('+'))) {
        user.phoneNumber = finalIdentifier;
      }
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

    if (isNewUser) {
      contactService.linkContactsForNewUser(user).catch((e) =>
        logger.warn({ err: e.message }, 'Failed background contact matching on new user signup')
      );
    }

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

    const sessionIndex = user.refreshTokens
      ? user.refreshTokens.findIndex((s) => s.token === token)
      : -1;

    if (sessionIndex === -1) {
      // Reuse detection: a validly signed token that was previously rotated or revoked is being reused
      logger.warn({ userId: user._id }, 'CRITICAL: Refresh token reuse detected. Revoking all sessions.');
      user.refreshTokens = [];
      await user.save();
      res.clearCookie('refreshToken', authService.getRefreshCookieOptions());
      return res.status(401).json({
        success: false,
        code: 'REFRESH_TOKEN_REUSE_DETECTED',
        message: 'Security alert: Refresh token reuse detected. All active sessions have been revoked.'
      });
    }

    // Rotate tokens
    const newAccessToken = authService.generateAccessToken(user._id);
    const newRefreshToken = authService.generateRefreshToken(user._id);

    user.refreshTokens[sessionIndex].token = newRefreshToken;
    user.refreshTokens[sessionIndex].createdAt = new Date();
    await user.save();

    res.cookie('refreshToken', newRefreshToken, authService.getRefreshCookieOptions());

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a specific device session
 */
const deleteSession = async (req, res, next) => {
  try {
    const { sid } = req.params;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const initialLength = user.refreshTokens.length;
    user.refreshTokens = user.refreshTokens.filter(
      (s) => String(s._id) !== String(sid) && String(s.deviceId) !== String(sid)
    );

    if (user.refreshTokens.length < initialLength) {
      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Session revoked successfully'
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
 * Signup (Email, Name, Password + Optional Username & Phone)
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

    const { name, email, password, username, phoneNumber } = parsed.data;

    // Check duplicate email
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    // Check duplicate username if provided
    let finalUsername = username;
    if (username) {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({
          success: false,
          message: 'This username is already taken. Please choose another.'
        });
      }
    } else {
      const provisionalSeed = crypto.randomBytes(3).toString('hex');
      finalUsername = `user_${provisionalSeed}`;
    }

    // Check duplicate phone if provided
    let normalizedPhone = phoneNumber ? normalizePhone(phoneNumber) : undefined;
    if (normalizedPhone) {
      const existingPhone = await User.findOne(buildPhoneSearchQuery(normalizedPhone));
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'An account with this phone number already exists.'
        });
      }
    }

    const passwordHash = await authService.hashPassword(password);
    const user = await User.create({
      name,
      username: finalUsername,
      email,
      ...(normalizedPhone ? { phoneNumber: normalizedPhone } : {}),
      passwordHash,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      isVerified: true,
      isOnboarded: Boolean(username)
    });

    mailer.sendWelcome(user.email, user.name);

    contactService.linkContactsForNewUser(user).catch((e) =>
      logger.warn({ err: e.message }, 'Failed background contact matching on new user signup')
    );

    const accessToken = authService.generateAccessToken(user._id);
    const refreshToken = authService.generateRefreshToken(user._id);
    user.refreshTokens = [
      {
        token: refreshToken,
        deviceInfo: req.headers['user-agent'] || 'Web Browser',
        createdAt: new Date()
      }
    ];
    await user.save();

    res.cookie('refreshToken', refreshToken, authService.getRefreshCookieOptions());

    const safeUser = user.toObject();
    delete safeUser.passwordHash;
    delete safeUser.refreshTokens;
    delete safeUser.pocketPinHash;

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: safeUser,
      token: accessToken,
      accessToken,
      isOnboarded: user.isOnboarded
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login (Email / Username / Phone + Password)
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

    const { identifier, email, password } = parsed.data;
    const rawTarget = (identifier || email || '').trim();

    if (!rawTarget) {
      return res.status(400).json({
        success: false,
        message: 'Email, username, or phone number is required.'
      });
    }

    let query = {};
    if (rawTarget.includes('@')) {
      query = { email: rawTarget.toLowerCase() };
    } else if (/^\+?\d{7,15}$/.test(rawTarget.replace(/[\s-()]/g, ''))) {
      query = buildPhoneSearchQuery(rawTarget);
    } else {
      query = { username: rawTarget.toLowerCase() };
    }

    const user = await User.findOne(query).select('+passwordHash');
    if (!user || !user.passwordHash) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please check your username/email and password.'
      });
    }

    const isMatch = await authService.comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please check your username/email and password.'
      });
    }

    user.isOnline = true;
    user.lastSeen = new Date();

    const accessToken = authService.generateAccessToken(user._id);
    const refreshToken = authService.generateRefreshToken(user._id);

    if (!user.refreshTokens) user.refreshTokens = [];
    user.refreshTokens.push({
      token: refreshToken,
      deviceInfo: req.headers['user-agent'] || 'Web Browser',
      createdAt: new Date()
    });

    if (user.refreshTokens.length > 10) {
      user.refreshTokens = user.refreshTokens.slice(-10);
    }

    await user.save();

    res.cookie('refreshToken', refreshToken, authService.getRefreshCookieOptions());

    const safeUser = user.toObject();
    delete safeUser.passwordHash;
    delete safeUser.refreshTokens;
    delete safeUser.pocketPinHash;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: safeUser,
      token: accessToken,
      accessToken,
      isOnboarded: user.isOnboarded
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Forgot Password - Send recovery link with secure token
 */
const forgotPassword = async (req, res, next) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0].message
      });
    }

    const { email } = parsed.data;
    const user = await User.findOne({ email });

    if (user) {
      const resetToken = authService.generateResetToken();
      const resetKey = `password_reset:${resetToken}`;
      // Store in redis with 1 hour TTL
      await redis.set(
        resetKey,
        JSON.stringify({ userId: String(user._id), email: user.email }),
        'EX',
        3600
      );

      const clientUrl = config.CLIENT_URL || 'http://localhost:5173';
      const resetUrl = `${clientUrl}/reset-password?token=${resetToken}`;

      logger.info(
        {
          event: 'password_reset_dispatched',
          recipient: logger.maskEmail(user.email)
        },
        'Password recovery instructions enqueued'
      );
    }

    // Always return generic success to prevent email enumeration
    return res.status(200).json({
      success: true,
      message: "If an account with that email exists, we've dispatched password recovery instructions."
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset Password - Validate token and hash new password
 */
const resetPassword = async (req, res, next) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0].message
      });
    }

    const { token, newPassword } = parsed.data;
    const resetKey = `password_reset:${token}`;
    const recordStr = await redis.get(resetKey);

    if (!recordStr) {
      return res.status(400).json({
        success: false,
        message: 'Password reset link is invalid or has expired. Please request a new one.'
      });
    }

    const record = typeof recordStr === 'object' ? recordStr : JSON.parse(recordStr);
    const user = await User.findById(record.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.'
      });
    }

    const passwordHash = await authService.hashPassword(newPassword);
    user.passwordHash = passwordHash;
    // Revoke all sessions on password change for high security
    user.refreshTokens = [];
    await user.save();

    // Consume reset token
    await redis.del(resetKey);

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.'
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
  deleteSession,
  logout,
  logoutAll,
  getMe,
  signup,
  login,
  forgotPassword,
  resetPassword,
  googleAuth
};
