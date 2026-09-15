const authService = require('../services/auth.service');
const { success, error } = require('../utils/response');
const authCookieOptions = require('../utils/authCookies');

async function login(req, res, next) {
  try {
    const { email, password, rememberMe } = req.body;
    if (!email || !password) return error(res, 'Email and password required', 400);

    const result = await authService.login(email, password, !!rememberMe);

    const accessMaxAge = result.accessMaxAge;
    const refreshMaxAge = result.refreshMaxAge;

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

async function logout(req, res, next) {
  try { await authService.logout(req.user.sessionId); } catch (err) { return next(err); }
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
    const result = await authService.refresh(req.cookies?.refreshToken);
    res.cookie('accessToken', result.accessToken, { ...authCookieOptions(req), maxAge: result.accessMaxAge });
    res.cookie('refreshToken', result.refreshToken, { ...authCookieOptions(req), maxAge: result.refreshMaxAge });
    return success(res, result.user);
  } catch (err) { next(err); }
}

async function updateProfile(req, res, next) {
  const r2Service = require('../services/r2.service');
  let uploadedUrl;
  try {
    const { prisma } = require('../middleware/auth');
    const data = {};
    if (req.body.name) data.name = req.body.name;
    if (req.body.department !== undefined) data.department = req.body.department;

    // Handle avatar upload
    if (req.file) {
      const url = await r2Service.uploadFile(req.file, 'avatars');
      uploadedUrl = url;
      if (url) data.avatarUrl = url;
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: { id: true, name: true, email: true, role: true, department: true, avatarUrl: true },
    });
    uploadedUrl = null;
    return success(res, user);
  } catch (err) {
    if (uploadedUrl) await r2Service.deleteFile(uploadedUrl).catch(() => {});
    next(err);
  }
}

module.exports = { login, logout, me, refresh, updateProfile };
