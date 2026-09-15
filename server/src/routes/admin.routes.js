const { Router } = require('express');
const adminController = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.use(authenticate);

// Settings
router.get('/settings', authorize('SUPERUSER'), adminController.getSettings);
router.put('/settings', authorize('SUPERUSER'), adminController.updateSettings);

// Attendance reopen
router.get('/attendance/reopened', authorize('INTERN', 'MENTOR', 'SUPERUSER'), adminController.getReopenedDates);
router.post('/attendance/reopen', authorize('SUPERUSER'), adminController.reopenDate);
router.delete('/attendance/reopen', authorize('SUPERUSER'), adminController.closeDate);
router.post('/attendance/reopen-bulk', authorize('SUPERUSER'), adminController.bulkReopenDates);
router.post('/attendance/close-bulk', authorize('SUPERUSER'), adminController.bulkCloseDates);

// Chat rooms
router.get('/mentor/chat-rooms', authorize('MENTOR', 'SUPERUSER'), adminController.getRooms);
router.post('/mentor/chat-rooms', authorize('MENTOR', 'SUPERUSER'), adminController.createRoom);
router.put('/mentor/chat-rooms/:id', authorize('MENTOR', 'SUPERUSER'), adminController.updateRoom);
router.delete('/mentor/chat-rooms/:id', authorize('MENTOR', 'SUPERUSER'), adminController.deleteRoom);

// AI query + history (room-based)
router.post('/mentor/ai-query', authorize('MENTOR', 'SUPERUSER'), adminController.aiQuery);
router.get('/mentor/chat-rooms/:roomId/messages', authorize('MENTOR', 'SUPERUSER'), adminController.getChatHistory);

module.exports = router;
