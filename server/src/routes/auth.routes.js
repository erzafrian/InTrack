const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = Router();

router.post('/login', require('../middleware/loginLimit').createLoginLimit(), authController.login);
router.post('/logout', authenticate, authController.logout);
router.post('/refresh', authController.refresh);
router.get('/me', authenticate, authController.me);
router.put('/profile', authenticate, upload.image('avatar'), authController.updateProfile);

module.exports = router;
