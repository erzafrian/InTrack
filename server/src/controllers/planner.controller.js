const { badRequest } = require('../utils/validation');
const { parseDateOnly } = require('../utils/dateOnly');
function parseEventTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) throw badRequest('Date and time are required');
  parseDateOnly(value.slice(0,10));
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:[zZ]|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/.test(value)) throw badRequest('Invalid event time');
  const date = new Date(/[zZ]$|[+-]\d{2}:\d{2}$/.test(value) ? value : value + '+07:00');
  if (!Number.isFinite(date.getTime())) throw badRequest('Invalid event date');
  return date;
}
const plannerService = require('../services/planner.service');
const { success, error } = require('../utils/response');

async function create(req, res, next) {
  try {
    const { title, startDate, endDate, allDay, description } = req.body;
    if (allDay !== undefined && typeof allDay !== 'boolean') throw badRequest('allDay must be a boolean');
    if (!title || !startDate || !endDate) return error(res, 'title, startDate, endDate required', 400);

    const event = await plannerService.createEvent(req.user.id, {
      title,
      startDate: parseEventTime(startDate),
      endDate: parseEventTime(endDate),
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
    if (req.body.allDay !== undefined && typeof req.body.allDay !== 'boolean') throw badRequest('allDay must be a boolean');
    const data = {};
    if (req.body.title !== undefined) data.title = req.body.title;
    if (req.body.startDate) data.startDate = parseEventTime(req.body.startDate);
    if (req.body.endDate) data.endDate = parseEventTime(req.body.endDate);
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

async function retrySync(req, res, next) {
  try {
    const event = await plannerService.retrySync(req.params.id, req.user.id);
    if (!event) return error(res, 'Event not found or unauthorized', 404);
    if (event.calendarSync === 'not_connected') return error(res, 'Connect Google Calendar before syncing.', 409);
    if (event.calendarSync === 'failed') return error(res, event.calendarWarning, 503);
    return success(res, event);
  } catch (err) { next(err); }
}

module.exports = { create, getAll, update, remove, retrySync };
