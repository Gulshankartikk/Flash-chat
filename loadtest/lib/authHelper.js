/**
 * Flash Chat Load Testing - Auth & Token Generation Helper
 */

const path = require('path');
const serverNodeModules = path.join(__dirname, '../../server/node_modules');

let jwt = null;
try {
  jwt = require(path.join(serverNodeModules, 'jsonwebtoken'));
} catch {
  jwt = {
    sign: (payload) => `mock_load_jwt_${payload.userId}_${Date.now()}`
  };
}

const crypto = require('crypto');
const config = require('../../server/config/env');

const JWT_ACCESS_SECRET = config.JWT_ACCESS_SECRET || 'test_jwt_access_secret_super_secure_12345';
const JWT_REFRESH_SECRET = config.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret_super_secure_67890';

function generateLoadUserTokens(userId, username) {
  const accessToken = jwt.sign(
    { userId: String(userId), username },
    JWT_ACCESS_SECRET,
    { expiresIn: '2h' }
  );

  const sessionId = crypto.randomUUID();
  const refreshToken = jwt.sign(
    { userId: String(userId), sessionId },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken, sessionId };
}

module.exports = {
  generateLoadUserTokens
};
