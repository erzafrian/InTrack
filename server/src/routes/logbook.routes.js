const { Router } = require('express');
const logbookController = require('../controllers/logbook.controller');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { requireOwner } = require('../middleware/ownership');

const router = Router();

router.use(authenticate);
router.get('/', logbookController.getEntries);
router.post('/', logbookController.createEntry);
router.post('/:entryId/tasks', requireOwner('logbookEntry', 'entryId'), upload.single('evidence'), logbookController.addTask);
router.put('/tasks/:taskId', requireOwner('logbookTask', 'taskId', { task: true }), upload.single('evidence'), logbookController.updateTask);
router.delete('/tasks/:taskId', requireOwner('logbookTask', 'taskId', { task: true }), logbookController.deleteTask);

module.exports = router;
