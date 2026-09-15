const { prisma } = require('../middleware/auth');
const { parseDateOnly } = require('../utils/dateOnly');

async function getOrCreateEntry(userId, date) {
  const entryDate = parseDateOnly(date);

  return prisma.logbookEntry.upsert({
    where: { userId_date: { userId, date: entryDate } },
    create: { userId, date: entryDate },
    update: {},
    include: { tasks: { orderBy: { timeStart: 'asc' } } },
  });
}

async function getEntries(userId, role, query) {
  const { startDate, endDate, targetUserId } = query;
  const where = {};

  if (role === 'INTERN') {
    where.userId = userId;
  } else if (targetUserId) {
    where.userId = targetUserId;
  }

  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = parseDateOnly(startDate);
    if (endDate) where.date.lte = parseDateOnly(endDate);
    if (startDate && endDate && startDate > endDate) throw Object.assign(new Error('End date must not precede start date'), { statusCode: 400 });
  }

  return prisma.logbookEntry.findMany({
    where,
    include: {
      tasks: { orderBy: { timeStart: 'asc' } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { date: 'desc' },
  });
}

async function addTask(entryId, data) {
  const { timeStart, timeEnd, activity, quantitativeActivity, qualitativeActivity, output, evidenceUrl } = data;
  return prisma.logbookTask.create({
    data: { entryId, timeStart, timeEnd, activity: activity || '', quantitativeActivity: quantitativeActivity || '', qualitativeActivity: qualitativeActivity || '', output: output || '', evidenceUrl },
  });
}

async function updateTask(taskId, data) {
  return prisma.logbookTask.update({
    where: { id: taskId },
    data,
  });
}

async function deleteTask(taskId) {
  return prisma.logbookTask.delete({ where: { id: taskId } });
}

module.exports = { getOrCreateEntry, getEntries, addTask, updateTask, deleteTask };
