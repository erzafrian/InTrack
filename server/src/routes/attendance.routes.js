const { Router } = require('express');
const attendanceController = require('../controllers/attendance.controller');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { requireOwner } = require('../middleware/ownership');

const router = Router();

router.use(authenticate);
router.get('/', attendanceController.getAll);
router.post('/', authorize('INTERN'), upload.single('evidence'), attendanceController.submit);
router.get('/:id', requireOwner('attendance', 'id', { read: true }), attendanceController.getById);
router.post('/:id/evidence', requireOwner('attendance', 'id'), upload.single('evidence'), attendanceController.uploadEvidence);

module.exports = router;
