function authCookieOptions(req) {
  const secure = Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');
  return {
    httpOnly: true,
    secure,
    // Frontend/API share a site; OAuth callbacks use a top-level navigation.
    sameSite: 'lax',
    path: '/',
  };
}

module.exports = authCookieOptions;
