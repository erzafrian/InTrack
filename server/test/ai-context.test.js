const test = require('node:test');
const assert = require('node:assert/strict');
const now = new Date('2026-09-16T02:00:00Z');
const interns = [
  { id: 'r', name: 'Rani', department: 'Engineering' },
  { id: 'b', name: 'Bima', department: 'Design' },
  { id: 'c', name: 'Citra', department: 'Engineering' },
];
const task = { timeStart: '09:00', timeEnd: '11:00', activity: 'Implement login', output: '12 tests passed', quantitativeActivity: '12 tests', qualitativeActivity: 'Validated edge cases' };
const entry = { userId: 'r', user: { name: 'Rani' }, date: new Date('2026-09-16'), tasks: [task] };
const plan = { userId: 'r', user: { name: 'Rani' }, title: 'Review tests', startDate: now, endDate: new Date('2026-09-16T04:00:00Z'), allDay: false, description: 'Review accessibility and security' };
const queries = {};
const prisma = {
  user: { findUnique: async () => ({ role: 'MENTOR' }), findMany: async () => interns },
  attendance: { findMany: async args => { queries.attendance = args; return [
    { userId: 'r', date: new Date('2026-09-16'), status: 'HADIR', checkInTime: now },
    { userId: 'b', date: new Date('2026-09-16'), status: 'IZIN', checkInTime: now },
  ]; } },
  logbookEntry: { findMany: async args => { queries.logbook = args; return [entry]; } },
  plannerEvent: { findMany: async args => { queries.planner = args; return [plan]; } },
};
const authPath = require.resolve('../src/middleware/auth');
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { prisma } };
const { buildContext } = require('../src/services/ai.context');

test('context retains task outputs, time, quantitative/qualitative work and planner details', async () => {
  const context = JSON.parse(await buildContext('mentor', now));
  assert.deepEqual(context.logbooks.entries[0].tasks[0], task);
  assert.equal(context.planner.entries[0].description, plan.description);
  assert.equal(context.planner.entries[0].endDate, plan.endDate.toISOString());
  assert.equal(context.coverage.completionTargetsAvailable, false);
});

test('leave counts as a recorded submission, not physical presence; missing records stay unknown', async () => {
  const context = JSON.parse(await buildContext('mentor', now));
  assert.equal(context.attendanceToday.recorded, 2);
  assert.equal(context.attendanceToday.present, 1);
  assert.equal(context.attendanceToday.onLeave, 1);
  assert.equal(context.attendanceToday.notRecorded, 1);
  assert.equal(context.attendanceToday.interns[0].recordedTimeWib, '09:00');
  assert.equal(context.attendanceToday.interns[2].status, 'NOT_RECORDED');
  assert.equal(context.attendanceSummary[2].presencePercentOfRecordedDays, null);
  assert.equal(context.attendanceSummary[1].presencePercentOfRecordedDays, 0);
});

test('30-day date range includes whole calendar dates and excludes future attendance/logbooks', async () => {
  const context = JSON.parse(await buildContext('mentor', now));
  assert.equal(context.coverage.attendanceAndLogbook.start, '2026-08-18');
  assert.equal(queries.attendance.where.date.gte.toISOString(), '2026-08-18T00:00:00.000Z');
  assert.equal(queries.logbook.where.date.lt.toISOString(), '2026-09-17T00:00:00.000Z');
  assert.equal(context.timeZone, 'Asia/Jakarta');
});

test('truncated logs/plans are explicitly marked, not presented as complete', async t => {
  t.mock.method(prisma.logbookEntry, 'findMany', async () => Array(101).fill(entry));
  t.mock.method(prisma.plannerEvent, 'findMany', async () => Array(101).fill(plan));
  const context = JSON.parse(await buildContext('mentor', now));
  assert.equal(context.logbooks.entries.length, 100);
  assert.equal(context.logbooks.hasMore, true);
  assert.equal(context.planner.entries.length, 100);
  assert.equal(context.planner.hasMore, true);
});

test('empty directory returns explicit empty data without querying activity tables', async t => {
  t.mock.method(prisma.user, 'findMany', async () => []);
  t.mock.method(prisma.attendance, 'findMany', async () => { throw new Error('Must not query'); });
  const context = JSON.parse(await buildContext('mentor', now));
  assert.equal(context.directory.total, 0);
  assert.deepEqual(context.attendanceSummary, []);
  assert.equal(context.logbooks.hasMore, false);
});
