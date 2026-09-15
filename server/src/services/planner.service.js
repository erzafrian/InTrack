const { prisma } = require('../middleware/auth');
const googleService = require('./google.service');

async function createEvent(userId, data) {
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

  if (startDate || endDate) {
    where.startDate = {};
    if (startDate) where.startDate.gte = new Date(startDate);
    if (endDate) where.startDate.lte = new Date(endDate);
  }

  return prisma.plannerEvent.findMany({
    where,
    include: { user: { select: { id: true, name: true } } },
    orderBy: { startDate: 'asc' },
  });
}

async function updateEvent(id, userId, data) {
  const event = await prisma.plannerEvent.findUnique({ where: { id } });
  if (!event || event.userId !== userId) return null;
  return prisma.plannerEvent.update({ where: { id }, data });
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
