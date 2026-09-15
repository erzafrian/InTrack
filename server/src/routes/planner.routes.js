const { Router } = require('express');
const plannerController = require('../controllers/planner.controller');
const { authenticate } = require('../middleware/auth');

const router = Router();

router.use(authenticate);
router.get('/events', plannerController.getAll);
router.post('/events', plannerController.create);
router.put('/events/:id', plannerController.update);
router.delete('/events/:id', plannerController.remove);

module.exports = router;
