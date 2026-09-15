const logbookService = require('../services/logbook.service');
const r2Service = require('../services/r2.service');
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
  try {
    const { timeStart, timeEnd, activity, quantitativeActivity, qualitativeActivity, output } = req.body;
    if (!timeStart || !timeEnd) return error(res, 'timeStart, timeEnd required', 400);
    if (!quantitativeActivity && !qualitativeActivity && !activity) {
      return error(res, "At least one activity is required", 400);
    }

    let evidenceUrl = null;
    if (req.file) {
      evidenceUrl = await r2Service.uploadFile(req.file, 'logbook');
    }

    const task = await logbookService.addTask(req.params.entryId, { timeStart, timeEnd, activity: activity || '', quantitativeActivity, qualitativeActivity, output, evidenceUrl });
    return success(res, task, 201);
  } catch (err) {
    next(err);
  }
}

async function updateTask(req, res, next) {
  try {
    let evidenceUrl;
    if (req.file) {
      evidenceUrl = await r2Service.uploadFile(req.file, 'logbook');
    }

    const data = { ...req.body };
    if (evidenceUrl) data.evidenceUrl = evidenceUrl;

    const task = await logbookService.updateTask(req.params.taskId, data);
    return success(res, task);
  } catch (err) {
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
