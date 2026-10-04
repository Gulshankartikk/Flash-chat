/**
 * Role-Based Access Control Middleware
 */

const requireRole = (...roles) => {
  const allowed = Array.isArray(roles[0]) ? roles[0] : roles;
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const userRole = req.user.role || 'user';
    if (!allowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: `Access denied. Required role: ${allowed.join(' or ')}.`
      });
    }

    next();
  };
};

module.exports = {
  requireRole
};
