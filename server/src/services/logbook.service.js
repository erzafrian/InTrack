const { prisma } = require('../middleware/auth');

async function getOrCreateEntry(userId, date) {
  const entryDate = new Date(date);
  entryDate.setHours(0, 0, 0, 0);

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
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
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
