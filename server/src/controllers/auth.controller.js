const authService = require('../services/auth.service');
const { success, error } = require('../utils/response');
const authCookieOptions = require('../utils/authCookies');

async function login(req, res, next) {
  try {
    const { email, password, rememberMe } = req.body;
    if (!email || !password) return error(res, 'Email and password required', 400);

    const result = await authService.login(email, password, !!rememberMe);

    const accessMaxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 15 * 60 * 1000;
    const refreshMaxAge = rememberMe ? 90 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

    res.cookie('accessToken', result.accessToken, {
      ...authCookieOptions(req),
      maxAge: accessMaxAge,
    });

    res.cookie('refreshToken', result.refreshToken, {
      ...authCookieOptions(req),
      maxAge: refreshMaxAge,
    });

    return success(res, result.user);
  } catch (err) {
    next(err);
  }
}

async function logout(req, res) {
  res.clearCookie('accessToken', authCookieOptions(req));
  res.clearCookie('refreshToken', authCookieOptions(req));
  return success(res, { message: 'Logged out' });
}

async function me(req, res, next) {
  try {
    const user = await authService.getUserById(req.user.id);
    if (!user) return error(res, 'User not found', 404);
    return success(res, user);
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const jwt = require('jsonwebtoken');
    const config = require('../config/env');
    const token = req.cookies?.refreshToken;
    if (!token) return error(res, 'Refresh token required', 401);

    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await authService.getUserById(decoded.id);
    if (!user) return error(res, 'User not found', 404);

    const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
    const accessToken = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

    res.cookie('accessToken', accessToken, {
      ...authCookieOptions(req),
      maxAge: 15 * 60 * 1000,
    });

    return success(res, payload);
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { prisma } = require('../middleware/auth');
    const data = {};
    if (req.body.name) data.name = req.body.name;
    if (req.body.department !== undefined) data.department = req.body.department;

    // Handle avatar upload
    if (req.file) {
      const r2Service = require('../services/r2.service');
      const url = await r2Service.uploadFile(req.file, 'avatars');
      if (url) data.avatarUrl = url;
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: { id: true, name: true, email: true, role: true, department: true, avatarUrl: true },
    });
    return success(res, user);
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, me, refresh, updateProfile };
