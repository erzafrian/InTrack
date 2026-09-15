const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const googleService = require('../services/google.service');
const config = require('../config/env');
const { success, error } = require('../utils/response');

const router = Router();

// Get Google OAuth consent URL (requires auth)
router.get('/auth-url', authenticate, (req, res) => {
  try {
    if (!config.google.clientId) return error(res, 'Google Calendar not configured', 501);
    const url = googleService.getAuthUrl(req.user.id);
    return success(res, { url });
  } catch (err) {
    return error(res, 'Failed to generate auth URL', 500);
  }
});

// OAuth callback (public — Google redirects here)
router.get('/callback', async (req, res) => {
  try {
    const { code, state: userId } = req.query;
    if (!code || !userId) return res.status(400).send('Missing code or state');

    await googleService.handleCallback(code, userId);
    res.redirect(`${config.clientUrl}/planner?google=connected`);
  } catch (err) {
    console.error('[Google Callback]', err.message);
    res.redirect(`${config.clientUrl}/planner?google=error`);
  }
});

// Connection status (requires auth)
router.get('/status', authenticate, async (req, res) => {
  try {
    const connected = await googleService.isConnected(req.user.id);
    return success(res, { connected });
  } catch (err) {
    return error(res, 'Failed to check status', 500);
  }
});

// Disconnect (requires auth)
router.post('/disconnect', authenticate, async (req, res) => {
  try {
    await googleService.disconnect(req.user.id);
    return success(res, { message: 'Google Calendar disconnected' });
  } catch (err) {
    return error(res, 'Failed to disconnect', 500);
  }
});

module.exports = router;
