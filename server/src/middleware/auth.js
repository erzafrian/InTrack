const config = require('../config/env');
const { error } = require('../utils/response');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');
async function authenticate(req, res, next) {
  const token = req.cookies?.accessToken;
  if (!token) return error(res, 'Authentication required', 401);
  let decoded;
  try { decoded = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] }); } catch { return error(res, 'Invalid or expired token', 401); }
  if (decoded.type !== 'access' || !decoded.sid) return error(res, 'Invalid or expired token', 401);
  try {
    const session = await prisma.authSession.findUnique({ where: { id: decoded.sid }, include: { user: { select: { id: true, role: true, name: true, email: true } } } });
    if (!session || session.userId !== decoded.id || session.expiresAt <= new Date()) return error(res, 'Session expired', 401);
    req.user = { ...session.user, sessionId: session.id };
    next();
  } catch (err) { next(err); }
}
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return error(res, 'Authentication required', 401);
    if (!roles.includes(req.user.role)) return error(res, 'Insufficient permissions', 403);
    next();
  };
}
module.exports = { authenticate, authorize, prisma };
