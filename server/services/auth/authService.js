const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../../config/env');
const logger = require('../../utils/logger');

const googleClient = new OAuth2Client(
  config.GOOGLE_CLIENT_ID,
  config.GOOGLE_CLIENT_SECRET,
  config.GOOGLE_REDIRECT_URI
);

class AuthService {
  /**
   * Generate JWT token for user
   * @param {string} userId
   * @returns {string}
   */
  generateToken(userId) {
    return jwt.sign({ id: userId }, config.JWT_SECRET, {
      expiresIn: '7d'
    });
  }

  /**
   * Get cookie options for secure JWT storage
   */
  getCookieOptions() {
    const isProd = config.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    };
  }

  /**
   * Hash plain-text password using bcrypt
   * @param {string} password
   * @returns {Promise<string>}
   */
  async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  /**
   * Compare plain-text password with stored hash
   * @param {string} password
   * @param {string} hash
   * @returns {Promise<boolean>}
   */
  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Verify Google ID token from frontend Google OAuth credential
   * @param {string} idToken
   */
  async verifyGoogleIdToken(idToken) {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: config.GOOGLE_CLIENT_ID
      });
      const payload = ticket.getPayload();
      return {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        avatar: payload.picture,
        isVerified: payload.email_verified
      };
    } catch (error) {
      logger.error({ error: error.message }, 'Google ID Token verification failed');
      throw new Error('Invalid Google credential');
    }
  }

  /**
   * Generate 6-digit numeric OTP
   */
  generateOtp() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Generate random crypto token for password resets
   */
  generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
  }
}

module.exports = new AuthService();
