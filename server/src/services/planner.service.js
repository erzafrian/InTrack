const { dayStart, nextDate } = require('../utils/operationalTime');
const { badRequest } = require('../utils/validation');
function validateEvent(data) { if (typeof data.title !== 'string' || !data.title.trim() || !Number.isFinite(data.startDate?.getTime()) || !Number.isFinite(data.endDate?.getTime()) || data.endDate <= data.startDate) throw badRequest('Use a title and an end date/time later than the start.'); }
const { prisma } = require('../middleware/auth');
const googleService = require('./google.service');

async function createEvent(userId, data) {
  validateEvent(data);
  const event = await prisma.plannerEvent.create({
    data: { userId, ...data },
  });

  // Auto-sync to Google Calendar if connected
  const gcalEventId = await googleService.syncEventToCalendar(userId, event);
  if (gcalEventId) {
    return prisma.plannerEvent.update({
      where: { id: event.id },
      data: { gcalEventId },
    });
  }

  return event;
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
  const gcalEventId = await googleService.syncEventToCalendar(userId, updated);
  return gcalEventId ? prisma.plannerEvent.update({ where: { id }, data: { gcalEventId } }) : updated;
}

async function deleteEvent(id, userId) {
  const event = await prisma.plannerEvent.findUnique({ where: { id } });
  if (!event || event.userId !== userId) return null;

  // Delete from Google Calendar if synced
  if (event.gcalEventId) {
    await googleService.deleteCalendarEvent(userId, event.gcalEventId);
  }

  return prisma.plannerEvent.delete({ where: { id } });
}

module.exports = { createEvent, getEvents, updateEvent, deleteEvent };
