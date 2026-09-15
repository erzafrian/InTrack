const crypto = require('crypto');
const tokens = require('./token.service');
const { prisma } = require('../config/database');
const cookieOptions = require('../utils/authCookies');
async function begin(req, res, provider) {
  const binding = crypto.randomBytes(32).toString('hex');
  const state = await tokens.issue(req.user.id, 'oauth_' + provider, tokens.hash(binding), 10 * 60000);
  res.cookie('oauth_' + provider, binding, { ...cookieOptions(req), sameSite: 'lax', maxAge: 10 * 60000 });
  return state;
}
async function finish(req, res, provider) {
  const binding = req.cookies?.['oauth_' + provider];
  res.clearCookie('oauth_' + provider, { ...cookieOptions(req), sameSite: 'lax' });
  if (typeof binding !== 'string') throw Object.assign(new Error('OAuth session expired'), { statusCode: 401 });
  return prisma.$transaction(tx => tokens.consume(req.query.state, 'oauth_' + provider, tokens.hash(binding), undefined, tx));
}
module.exports = { begin, finish };
