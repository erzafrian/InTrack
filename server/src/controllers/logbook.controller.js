const { validateTask } = require('../utils/validation');
const logbookService = require('../services/logbook.service');
const storageService = require('../services/storage.service');
const { success, error } = require('../utils/response');

async function getEntries(req, res, next) {
  try {
    const data = await logbookService.getEntries(req.user.id, req.user.role, req.query);
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function createEntry(req, res, next) {
  try {
    const { date } = req.body;
    if (!date) return error(res, 'Date required', 400);
    const entry = await logbookService.getOrCreateEntry(req.user.id, date);
    return success(res, entry, 201);
  } catch (err) {
    next(err);
  }
}

async function addTask(req, res, next) {
  let evidenceUrl;
  try {
    const { timeStart, timeEnd, activity, quantitativeActivity, qualitativeActivity, output } = req.body;
    validateTask(req.body);
    if (!req.file) return error(res, 'Evidence must be uploaded', 400);
    if (!timeStart || !timeEnd) return error(res, 'timeStart, timeEnd required', 400);
    if (!quantitativeActivity && !qualitativeActivity && !activity) {
      return error(res, "At least one activity is required", 400);
    }

    if (req.file) {
      evidenceUrl = await storageService.uploadFile(req.file, 'logbook');
    }

    const task = await logbookService.addTask(req.params.entryId, { timeStart, timeEnd, activity: activity || '', quantitativeActivity, qualitativeActivity, output, evidenceUrl });
    evidenceUrl = null;
    return success(res, task, 201);
  } catch (err) {
    if (evidenceUrl) await storageService.deleteFile(evidenceUrl).catch(() => {});
    next(err);
  }
}

async function updateTask(req, res, next) {
  let evidenceUrl;
  try {
    const data = {};
    for (const key of ['timeStart','timeEnd','activity','quantitativeActivity','qualitativeActivity','output']) if (req.body[key] !== undefined) data[key] = req.body[key];
    validateTask({ ...req.ownedRecord, ...data });
    if (!req.file && !req.ownedRecord.evidenceUrl) return error(res, 'Evidence must be uploaded', 400);
    if (req.file) evidenceUrl = await storageService.uploadFile(req.file, 'logbook');
    if (evidenceUrl) data.evidenceUrl = evidenceUrl;

    const task = await logbookService.updateTask(req.params.taskId, data);
    evidenceUrl = null;
    return success(res, task);
  } catch (err) {
    if (evidenceUrl) await storageService.deleteFile(evidenceUrl).catch(() => {});
    next(err);
  }
}

async function deleteTask(req, res, next) {
  try {
    await logbookService.deleteTask(req.params.taskId);
    return success(res, { message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getEntries, createEntry, addTask, updateTask, deleteTask };
