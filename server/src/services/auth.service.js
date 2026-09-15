const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { prisma } = require('../middleware/auth');

async function login(email, password, rememberMe = false) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });

  const payload = { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department, avatarUrl: user.avatarUrl };
  const accessExpiry = rememberMe ? '30d' : config.jwt.expiresIn;
  const refreshExpiry = rememberMe ? '90d' : config.jwt.refreshExpiresIn;
  const accessToken = jwt.sign({ id: user.id, role: user.role }, config.jwt.secret, { expiresIn: accessExpiry });
  const refreshToken = jwt.sign({ id: user.id }, config.jwt.secret, { expiresIn: refreshExpiry });

  return { accessToken, refreshToken, user: payload, rememberMe };
}

async function getUserById(id) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, department: true, avatarUrl: true, mentorId: true, createdAt: true },
  });
}

module.exports = { login, getUserById };
