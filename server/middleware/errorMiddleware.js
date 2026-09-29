const logger = require('../utils/logger');

const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`
  });
};

const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode !== 200 ? res.statusCode : err.statusCode || 500;

  // Log server errors
  if (statusCode >= 500) {
    logger.error(
      {
        err: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method
      },
      'Internal Server Error caught by error middleware'
    );
  } else {
    logger.warn(
      {
        status: statusCode,
        message: err.message,
        url: req.originalUrl
      },
      'Client error caught by error middleware'
    );
  }

  // Handle specific MongoDB errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: Object.values(err.errors).map((e) => e.message).join(', ')
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `An account with that ${field} already exists.`
    });
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
