const jwt = require('jsonwebtoken');
const response = require('../utils/responseHandler');

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not defined in environment variables");
  process.exit(1);
}

const authMiddleware = (req, res, next) => {
  let authToken = req.cookies?.auth_token;

  // Fallback to Bearer authorization header if cookie is not present
  if (!authToken && req.headers.authorization?.startsWith('Bearer ')) {
    authToken = req.headers.authorization.split(' ')[1];
  }

  if (!authToken) {
    return response(res, 401, 'Authorization token missing. Please provide token');
  }

  try {
    const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      res.setHeader('X-Token-Expired', 'true');
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Access token expired',
      });
    }
    return response(res, 401, 'Invalid or expired token');
  }
};

module.exports = authMiddleware;

