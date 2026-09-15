const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate, prisma } = require('../middleware/auth');
const upload = require('../middleware/upload');
const notionService = require('../services/notion.service');
const config = require('../config/env');

const router = Router();

router.post('/login', authController.login);
router.post('/logout', authenticate, authController.logout);
router.post('/refresh', authController.refresh);
router.get('/me', authenticate, authController.me);
router.put('/profile', authenticate, upload.single('avatar'), authController.updateProfile);

// Notion OAuth
router.get('/notion', authenticate, (req, res) => {
  if (!config.notion.clientId) return res.status(501).json({ error: 'Notion not configured' });
  const url = notionService.getAuthUrl(req.user.id);
  res.json({ data: { url } });
});

router.get('/notion/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.redirect(`${config.clientUrl}/mentor/settings?notion=error&reason=no_code`);

    const tokenData = await notionService.exchangeCode(code);
    const accessToken = tokenData.access_token;
    const workspaceName = tokenData.workspace_name || '';

    // Find user from state (we'll pass userId as state in the auth URL)
    // For simplicity, get the most recently active user or use a temp token
    // Better approach: we store a temp state before redirect
    if (state) {
      await prisma.user.update({
        where: { id: state },
        data: { notionAccessToken: accessToken },
      });
    }

    res.redirect(`${config.clientUrl}/mentor/settings?notion=success&workspace=${encodeURIComponent(workspaceName)}`);
  } catch (err) {
    console.error('[Notion] Callback error:', err.message);
    res.redirect(`${config.clientUrl}/mentor/settings?notion=error&reason=${encodeURIComponent(err.message)}`);
  }
});

router.get('/notion/status', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { notionAccessToken: true, notionDatabaseId: true },
  });
  res.json({ data: { connected: !!user?.notionAccessToken, hasDatabaseId: !!user?.notionDatabaseId } });
});

router.delete('/notion/disconnect', authenticate, async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: { notionAccessToken: null, notionDatabaseId: null },
  });
  res.json({ data: { disconnected: true } });
});

module.exports = router;
