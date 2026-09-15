const { Router } = require('express');
const logbookController = require('../controllers/logbook.controller');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = Router();

router.use(authenticate);
router.get('/', logbookController.getEntries);
router.post('/', logbookController.createEntry);
router.post('/:entryId/tasks', upload.single('evidence'), logbookController.addTask);
router.put('/tasks/:taskId', upload.single('evidence'), logbookController.updateTask);
router.delete('/tasks/:taskId', logbookController.deleteTask);

module.exports = router;
