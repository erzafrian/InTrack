const { dayStart, nextDate } = require('../utils/operationalTime');
const { badRequest } = require('../utils/validation');
function validateEvent(data) { if (typeof data.title !== 'string' || !data.title.trim() || !Number.isFinite(data.startDate?.getTime()) || !Number.isFinite(data.endDate?.getTime()) || data.endDate <= data.startDate) throw badRequest('Use a title and an end date/time later than the start.'); }
const { prisma } = require('../middleware/auth');
const googleService = require('./google.service');

async function syncSavedEvent(userId, event) {
  try {
    const gcalEventId = await googleService.syncEventToCalendar(userId, event);
    if (!gcalEventId) return { ...event, calendarSync: 'not_connected' };
    const saved = await prisma.plannerEvent.update({ where: { id: event.id }, data: { gcalEventId } });
    return { ...saved, calendarSync: 'synced' };
  } catch {
    // The local save already succeeded: do not encourage a duplicate create.
    return { ...event, calendarSync: 'failed', calendarWarning: 'Event saved in InTrack, but Google Calendar sync failed. Use Sync to Google to retry.' };
  }
}

async function createEvent(userId, data) {
  validateEvent(data);
  const event = await prisma.plannerEvent.create({
    data: { userId, ...data },
  });

  return syncSavedEvent(userId, event);
}

async function getEvents(userId, role, query) {
  const { startDate, endDate, targetUserId } = query;
  const where = {};

  if (role === 'INTERN') {
    where.userId = userId;
  } else if (targetUserId) {
    where.userId = targetUserId;
  }

  if (startDate) where.endDate = { gte: dayStart(startDate) };
  if (endDate) where.startDate = { lt: dayStart(nextDate(endDate)) };
  if (startDate && endDate && endDate < startDate) throw badRequest('End date must not precede start date');

  return prisma.plannerEvent.findMany({
    where,
    include: { user: { select: { id: true, name: true } } },
    orderBy: { startDate: 'asc' },
  });
}

async function updateEvent(id, userId, data) {
  const event = await prisma.plannerEvent.findUnique({ where: { id } });
  if (!event || event.userId !== userId) return null;
  validateEvent({ ...event, ...data });
  const updated = await prisma.plannerEvent.update({ where: { id }, data });
  return syncSavedEvent(userId, updated);
}

async function retrySync(id, userId) {
  const event = await prisma.plannerEvent.findUnique({ where: { id } });
  if (!event || event.userId !== userId) return null;
  return syncSavedEvent(userId, event);
}

async function deleteEvent(id, userId) {
  const event = await prisma.plannerEvent.findUnique({ where: { id } });
  if (!event || event.userId !== userId) return null;

  // Delete from Google Calendar if synced
  if (event.gcalEventId) {
    await googleService.deleteCalendarEvent(userId, event.gcalEventId);
  } else if (await googleService.isConnected(userId)) {
    // An earlier insert may have succeeded remotely despite a timeout.
    await googleService.deleteCalendarEvent(userId, googleService.eventKey(event));
  }

  return prisma.plannerEvent.delete({ where: { id } });
}

module.exports = { createEvent, getEvents, updateEvent, deleteEvent, retrySync };
