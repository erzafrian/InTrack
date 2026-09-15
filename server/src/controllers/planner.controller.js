const plannerService = require('../services/planner.service');
const { success, error } = require('../utils/response');

async function create(req, res, next) {
  try {
    const { title, startDate, endDate, allDay, description } = req.body;
    if (!title || !startDate || !endDate) return error(res, 'title, startDate, endDate required', 400);

    const event = await plannerService.createEvent(req.user.id, {
      title,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      allDay: allDay || false,
      description,
    });
    return success(res, event, 201);
  } catch (err) {
    next(err);
  }
}

async function getAll(req, res, next) {
  try {
    const events = await plannerService.getEvents(req.user.id, req.user.role, req.query);
    return success(res, events);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const data = {};
    if (req.body.title) data.title = req.body.title;
    if (req.body.startDate) data.startDate = new Date(req.body.startDate);
    if (req.body.endDate) data.endDate = new Date(req.body.endDate);
    if (req.body.allDay !== undefined) data.allDay = req.body.allDay;
    if (req.body.description !== undefined) data.description = req.body.description;

    const event = await plannerService.updateEvent(req.params.id, req.user.id, data);
    if (!event) return error(res, 'Event not found or unauthorized', 404);
    return success(res, event);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const event = await plannerService.deleteEvent(req.params.id, req.user.id);
    if (!event) return error(res, 'Event not found or unauthorized', 404);
    return success(res, { message: 'Event deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, getAll, update, remove };
