const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/env');
const { prisma } = require('../config/database');
const { hash } = require('./token.service');
const invalid = () => Object.assign(new Error('Session is invalid or expired. Please sign in again.'), { statusCode: 401 });
const selectUser = { id: true, name: true, email: true, role: true, department: true, avatarUrl: true, mentorId: true, createdAt: true };
function tokenPair(user, sid, rememberMe) {
  const accessToken = jwt.sign({ id: user.id, role: user.role, sid, type: 'access' }, config.jwt.secret, { expiresIn: rememberMe ? '30d' : config.jwt.expiresIn });
  const refreshToken = jwt.sign({ id: user.id, sid, type: 'refresh', rememberMe, jti: crypto.randomUUID() }, config.jwt.secret, { expiresIn: rememberMe ? '90d' : config.jwt.refreshExpiresIn });
  const remaining = token => Math.max(0, jwt.decode(token).exp * 1000 - Date.now());
  return { accessToken, refreshToken, accessMaxAge: remaining(accessToken), refreshMaxAge: remaining(refreshToken), user };
}
async function login(email, password, rememberMe = false) {
  if (typeof email !== 'string' || typeof password !== 'string') throw invalid();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  const sid = crypto.randomUUID();
  const safeUser = Object.fromEntries(Object.keys(selectUser).map(key => [key, user[key]]));
  const pair = tokenPair(safeUser, sid, rememberMe);
  await prisma.authSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await prisma.authSession.create({ data: { id: sid, userId: user.id, refreshHash: hash(pair.refreshToken), expiresAt: new Date(jwt.decode(pair.refreshToken).exp * 1000) } });
  return pair;
}
async function refresh(token) {
  let decoded;
  try { decoded = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] }); } catch { throw invalid(); }
  if (decoded.type !== 'refresh' || !decoded.sid) throw invalid();
  const session = await prisma.authSession.findUnique({ where: { id: decoded.sid }, include: { user: { select: selectUser } } });
  if (!session || session.userId !== decoded.id || session.expiresAt <= new Date() || session.refreshHash !== hash(token)) throw invalid();
  const pair = tokenPair(session.user, session.id, !!decoded.rememberMe);
  const rotated = await prisma.authSession.updateMany({ where: { id: session.id, refreshHash: hash(token), expiresAt: { gt: new Date() } }, data: { refreshHash: hash(pair.refreshToken), expiresAt: new Date(jwt.decode(pair.refreshToken).exp * 1000) } });
  if (rotated.count !== 1) throw invalid();
  return pair;
}
async function logout(sessionId) { await prisma.authSession.deleteMany({ where: { id: sessionId } }); }
async function getUserById(id) { return prisma.user.findUnique({ where: { id }, select: selectUser }); }
module.exports = { login, refresh, logout, getUserById };
