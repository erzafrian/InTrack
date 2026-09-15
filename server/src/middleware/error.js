const { error } = require('../utils/response');

function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  console.error('[ERROR STACK]', err.stack);
  if (err.code) console.error('[ERROR CODE]', err.code);
  if (err.meta) console.error('[ERROR META]', JSON.stringify(err.meta));

  if (err.name === 'ValidationError' || err.code === 'P2002') {
    return error(res, 'Validation error', 400, err.message);
  }

  if (err.name === 'JsonWebTokenError') {
    return error(res, 'Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return error(res, 'Token expired', 401);
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;
  return error(res, message, statusCode);
}

module.exports = errorHandler;
