const { prisma } = require('../middleware/auth');
const { parseDateOnly } = require('../utils/dateOnly');
const storage = require('./storage.service');
async function cleanupEvidence(url) {
  if (url) await storage.deleteFile(url).catch(() => console.warn('[Storage] Old logbook evidence cleanup failed; manual retry is required.'));
}

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
  const { previous, task } = await prisma.$transaction(async tx => {
    const previous = await tx.logbookTask.findUnique({ where: { id: taskId } });
    const task = await tx.logbookTask.update({ where: { id: taskId }, data });
    return { previous, task };
  }, { isolationLevel: 'Serializable' });
  if (previous?.evidenceUrl !== task.evidenceUrl) await cleanupEvidence(previous?.evidenceUrl);
  return task;
}

async function deleteTask(taskId) {
  const task = await prisma.logbookTask.delete({ where: { id: taskId } });
  await cleanupEvidence(task.evidenceUrl);
  return task;
}

module.exports = { getOrCreateEntry, getEntries, addTask, updateTask, deleteTask };
