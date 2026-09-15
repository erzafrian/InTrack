const { Router } = require('express');
const usersController = require('../controllers/users.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.use(authenticate);
router.get('/', authorize('MENTOR', 'SUPERUSER'), usersController.getAll);
router.post('/', authorize('SUPERUSER'), usersController.create);
router.put('/:id', authorize('SUPERUSER'), usersController.update);
router.delete('/:id', authorize('SUPERUSER'), usersController.remove);

module.exports = router;
