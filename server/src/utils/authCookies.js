function authCookieOptions(req) {
  const secure = Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');
  return {
    httpOnly: true,
    secure,
    // Browsers reject SameSite=None cookies without Secure on local HTTP.
    sameSite: secure ? 'none' : 'lax',
    path: '/',
  };
}

module.exports = authCookieOptions;
