const { error } = require('../utils/response');

function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  console.error('[ERROR STACK]', err.stack);
  if (err.code) console.error('[ERROR CODE]', err.code);
  if (err.meta) console.error('[ERROR META]', JSON.stringify(err.meta));

  if (err.code === 'P2002') return error(res, 'A record with these values already exists', 409);
  if (err.code === 'P2025') return error(res, 'Record not found', 404);
  if (err.code === 'P2003') return error(res, 'This record is linked to other data', 409);
  if (err.code === 'P2034') return error(res, 'Data changed during this request. Please try again.', 409);
  if (err.name === 'ValidationError' || err.name === 'PrismaClientValidationError') return error(res, 'Invalid request data', 400);

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
