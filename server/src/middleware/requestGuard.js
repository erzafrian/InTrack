const config = require('../config/env');
const { error } = require('../utils/response');

// A custom header forces cross-origin browser mutations through CORS preflight.
// CLI clients must send the same header; a supplied Origin must always match.
function requestGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (req.get('X-InTrack-Request') !== '1' ||
      (origin && origin !== new URL(config.clientUrl).origin)) {
    return error(res, 'Request origin could not be verified. Reload the page and try again.', 403);
  }
  next();
}

module.exports = requestGuard;
