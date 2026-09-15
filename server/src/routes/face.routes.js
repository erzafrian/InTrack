const { Router } = require('express');
const faceController = require('../controllers/face.controller');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = Router();

router.use(authenticate);

// Intern endpoints
router.post('/enroll', upload.single('photo'), faceController.enroll);
router.post('/verify', upload.single('photo'), faceController.verify);
router.get('/status', faceController.status);

// Mentor/Admin endpoint
router.delete('/enroll/:userId', authorize('MENTOR', 'SUPERUSER'), faceController.resetEnrollment);

module.exports = router;
