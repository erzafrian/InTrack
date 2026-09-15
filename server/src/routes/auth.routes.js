const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate, authorize, prisma } = require('../middleware/auth');
const upload = require('../middleware/upload');
const notionService = require('../services/notion.service');
const config = require('../config/env');

const router = Router();

router.post('/login', authController.login);
router.post('/logout', authenticate, authController.logout);
router.post('/refresh', authController.refresh);
router.get('/me', authenticate, authController.me);
router.put('/profile', authenticate, upload.image('avatar'), authController.updateProfile);

// One shared Notion integration managed by administrators.
const oauth = require('../services/oauth.service');
router.get('/notion', authenticate, authorize('SUPERUSER'), async (req,res,next) => {
  try { if (!config.notion.clientId) return res.status(501).json({ error: 'Notion not configured' });
    res.json({ data: { url: notionService.getAuthUrl(await oauth.begin(req,res,'notion')) } });
  } catch(err) { next(err); }
});
router.get('/notion/callback', async (req,res) => {
  try {
    const userId = await oauth.finish(req,res,'notion');
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (user?.role !== 'SUPERUSER' || !req.query.code) throw new Error('Invalid authorization');
    await notionService.saveConnection(await notionService.exchangeCode(req.query.code));
    res.redirect(config.clientUrl + '/admin/settings?notion=success');
  } catch { res.redirect(config.clientUrl + '/admin/settings?notion=error'); }
});
router.get('/notion/status', authenticate, async (req,res,next) => { try { res.json({ data: await notionService.status() }); } catch(err) { next(err); } });
router.delete('/notion/disconnect', authenticate, authorize('SUPERUSER'), async (req,res,next) => { try { await notionService.disconnect(); res.json({ data: { disconnected: true } }); } catch(err) { next(err); } });
router.get('/notion/databases', authenticate, authorize('SUPERUSER'), async (req,res,next) => { try { res.json({ data: await notionService.databases() }); } catch(err) { next(err); } });
router.put('/notion/database', authenticate, authorize('SUPERUSER'), async (req,res,next) => { try { res.json({ data: await notionService.selectDatabase(req.body.dataSourceId) }); } catch(err) { next(err); } });
router.get('/notion/syncs', authenticate, authorize('SUPERUSER'), async (req,res,next) => { try { res.json({ data: await prisma.externalSync.findMany({ where: { provider: 'notion' }, orderBy: { lastSynced: 'desc' }, take: 20 }) }); } catch(err) { next(err); } });
router.post('/notion/sync/:attendanceId', authenticate, authorize('SUPERUSER'), async (req,res,next) => { try {
  const attendance = await prisma.attendance.findUnique({ where: { id: req.params.attendanceId } });
  if (!attendance) return res.status(404).json({ error: 'Attendance not found' });
  const pageId = await notionService.syncAttendanceToNotion(attendance.userId, attendance);
  if (!pageId) return res.status(409).json({ error: 'Connect and select a database first, or wait for the current sync.' });
  res.json({ data: { synced: true } });
} catch(err) { next(err); } });
module.exports = router;
