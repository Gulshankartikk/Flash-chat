const pinoHttp = require('pino-http');
const logger = require('../utils/logger');

const loggerMiddleware = pinoHttp({
  logger,
  customLogLevel: function (res, err) {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: function (req, res) {
    return `${req.method} ${req.url} -> ${res.statusCode}`;
  },
  customErrorMessage: function (req, res, err) {
    return `${req.method} ${req.url} -> ${res.statusCode} [${err.message}]`;
  },
  autoLogging: {
    ignore: (req) => req.url === '/api/health' || req.url === '/health'
  }
});

module.exports = loggerMiddleware;
