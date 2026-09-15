const config = require('../config/env');
const { error } = require('../utils/response');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function authenticate(req, res, next) {
  const token = req.cookies?.accessToken;
  if (!token) return error(res, 'Authentication required', 401);

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    return error(res, 'Invalid or expired token', 401);
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return error(res, 'Authentication required', 401);
    if (!roles.includes(req.user.role)) {
      return error(res, 'Insufficient permissions', 403);
    }
    next();
  };
}

module.exports = { authenticate, authorize, prisma };
