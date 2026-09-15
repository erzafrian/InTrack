const { Router } = require('express');
const attendanceController = require('../controllers/attendance.controller');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = Router();

router.use(authenticate);
router.get('/', attendanceController.getAll);
router.post('/', upload.single('evidence'), attendanceController.submit);
router.get('/:id', attendanceController.getById);
router.post('/:id/evidence', upload.single('evidence'), attendanceController.uploadEvidence);

module.exports = router;
