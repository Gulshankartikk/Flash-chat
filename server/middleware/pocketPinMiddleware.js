const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Middleware that inspects the X-Pocket-Token header.
 * If present and valid (scope: 'pocket' and matching user id), marks req.isPocketUnlocked = true.
 * Does not block if missing; simply leaves req.isPocketUnlocked = false.
 */
const attachPocketAuth = (req, res, next) => {
  const token = req.headers['x-pocket-token'] || req.query.pocketToken;
  req.isPocketUnlocked = false;

  if (!token) {
    return next();
  }

  try {
    const accessSecret = config.JWT_ACCESS_SECRET || config.JWT_SECRET;
    const decoded = jwt.verify(token, accessSecret);

    if (
      decoded &&
      decoded.scope === 'pocket' &&
      req.user &&
      String(decoded.id) === String(req.user._id)
    ) {
      req.isPocketUnlocked = true;
      req.pocketToken = token;
    }
  } catch (err) {
    // Expired or invalid pocket token leaves vault locked
    req.isPocketUnlocked = false;
  }

  next();
};

/**
 * Guard middleware requiring an active, verified Pocket token.
 */
const requirePocketUnlock = (req, res, next) => {
  if (req.isPocketUnlocked) {
    return next();
  }

  return res.status(403).json({
    success: false,
    code: 'POCKET_LOCKED',
    message: 'Vault PIN verification required to access this resource.'
  });
};

module.exports = {
  attachPocketAuth,
  requirePocketUnlock
};
