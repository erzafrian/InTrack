const { todayKey, TIME_ZONE, dayStart } = require('../utils/operationalTime');
const { prisma } = require('../middleware/auth');

const LIMIT = 100;
function shiftDate(key, days) {
  const date = new Date(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function buildContext(userId, now = new Date()) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return '';

  const today = todayKey(now);
  const periodStart = shiftDate(today, -29); // 30 calendar dates including today.
  const tomorrow = shiftDate(today, 1);
  const plannerEnd = shiftDate(today, 31);
  // Matches the current mentor dashboard's directory access.
  const interns = await prisma.user.findMany({
    where: { role: 'INTERN' },
    select: { id: true, name: true, email: true, department: true },
  });
  const context = {
    today, timeZone: TIME_ZONE,
    directory: { total: interns.length, interns },
    coverage: {
      attendanceAndLogbook: { start: periodStart, endInclusive: today },
      planner: { start: periodStart, endExclusive: plannerEnd },
      workdayScheduleAvailable: false,
      completionTargetsAvailable: false,
      note: 'Recorded activities, output and plans do not establish completion percentage or overall performance. A plan is not evidence of completion.',
    },
    attendanceToday: { recorded: 0, present: 0, onLeave: 0, sick: 0, notRecorded: interns.length, interns: [] },
    attendanceSummary: [],
    logbooks: { entries: [], hasMore: false, limit: LIMIT },
    planner: { entries: [], hasMore: false, limit: LIMIT },
  };
  if (!interns.length) return JSON.stringify(context);
  const internIds = interns.map(i => i.id);
  const [attendance, logbooks, planner] = await Promise.all([
    prisma.attendance.findMany({
      where: { userId: { in: internIds }, date: { gte: new Date(periodStart), lt: new Date(tomorrow) } },
      select: { userId: true, date: true, status: true, checkInTime: true },
    }),
    prisma.logbookEntry.findMany({
      where: { userId: { in: internIds }, date: { gte: new Date(periodStart), lt: new Date(tomorrow) } },
      include: { user: { select: { name: true } }, tasks: true },
      orderBy: [{ date: 'desc' }, { id: 'asc' }], take: LIMIT + 1,
    }),
    prisma.plannerEvent.findMany({
      // Include ongoing events that started before the visible period.
      where: { userId: { in: internIds }, startDate: { lt: dayStart(plannerEnd) }, endDate: { gte: dayStart(periodStart) } },
      include: { user: { select: { name: true } } },
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }], take: LIMIT + 1,
    }),
  ]);
  for (const intern of interns) {
    const records = attendance.filter(a => a.userId === intern.id);
    const current = records.find(a => a.date.toISOString().slice(0, 10) === today);
    const count = status => records.filter(a => a.status === status).length;
    const presentDays = count('HADIR');
    context.attendanceSummary.push({
      internId: intern.id, name: intern.name, recordedDays: records.length,
      presentDays, onLeaveDays: count('IZIN'), sickDays: count('SAKIT'),
      presencePercentOfRecordedDays: records.length ? Math.round(presentDays / records.length * 10000) / 100 : null,
      denominator: 'recordedDays; not scheduled workdays or calendar days',
    });
    context.attendanceToday.interns.push({
      internId: intern.id, name: intern.name, status: current?.status || 'NOT_RECORDED',
      recordedTimeWib: current?.checkInTime ? new Intl.DateTimeFormat('en-GB', {
        timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).format(current.checkInTime) : null,
    });
    if (current) {
      context.attendanceToday.recorded++;
      context.attendanceToday.notRecorded--;
      const key = { HADIR: 'present', IZIN: 'onLeave', SAKIT: 'sick' }[current.status];
      if (key) context.attendanceToday[key]++;
    }
  }
  context.logbooks.hasMore = logbooks.length > LIMIT;
  context.logbooks.entries = logbooks.slice(0, LIMIT).map(entry => ({
    internId: entry.userId, name: entry.user.name, date: entry.date.toISOString().slice(0, 10),
    tasks: entry.tasks.map(task => ({
      timeStart: task.timeStart, timeEnd: task.timeEnd, activity: task.activity,
      output: task.output, quantitativeActivity: task.quantitativeActivity,
      qualitativeActivity: task.qualitativeActivity,
    })),
  }));
  context.planner.hasMore = planner.length > LIMIT;
  context.planner.entries = planner.slice(0, LIMIT).map(plan => ({
    internId: plan.userId, name: plan.user.name, title: plan.title,
    startDate: plan.startDate.toISOString(), endDate: plan.endDate.toISOString(),
    allDay: plan.allDay, description: plan.description,
  }));
  return JSON.stringify(context);
}

module.exports = { buildContext };
