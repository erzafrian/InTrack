const { prisma } = require('../middleware/auth');
const statusLabels = { HADIR: 'Present', IZIN: 'On Leave', SAKIT: 'Sick' };

async function buildContext(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, name: true } });
  if (!user) return '';

  const lines = ['--- REAL-TIME INTRACK DATABASE CONTEXT ---'];
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  // Get interns (Dashboard currently shows all interns to Mentors, so AI should too)
  const internWhere = { role: 'INTERN' };
  const interns = await prisma.user.findMany({
    where: internWhere,
    select: { id: true, name: true, email: true, department: true },
  });

  lines.push(`\n### Intern Directory (${interns.length} people)`);
  if (interns.length === 0) {
    lines.push('- No registered interns');
  } else {
    interns.forEach(i => lines.push(`- ${i.name} (${i.email})${i.department ? ` — ${i.department}` : ''}`));
  }

  if (interns.length > 0) {
    const internIds = interns.map(i => i.id);

    // Today's attendance
    const todayStart = new Date(todayStr);
    const todayEnd = new Date(todayStr);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todayAttendance = await prisma.attendance.findMany({
      where: { userId: { in: internIds }, date: { gte: todayStart, lt: todayEnd } },
      include: { user: { select: { name: true } } },
    });

    lines.push(`\n### Today’s Attendance (${todayStr})`);
    const checkedIn = todayAttendance.map(a => `- ${a.user.name}: **${statusLabels[a.status] || 'Not Checked In'}** (${a.checkInTime ? new Date(a.checkInTime).toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' }) : '-'})`);
    const notCheckedIn = interns.filter(i => !todayAttendance.find(a => a.userId === i.id)).map(i => `- ${i.name}: **NOT CHECKED IN**`);
    lines.push(`Checked in: ${todayAttendance.length}/${interns.length}`);
    checkedIn.forEach(l => lines.push(l));
    notCheckedIn.forEach(l => lines.push(l));

    // This month's summary
    const monthAttendance = await prisma.attendance.findMany({
      where: { userId: { in: internIds }, date: { gte: monthAgo } },
      include: { user: { select: { name: true } } },
    });

    lines.push(`\n### Attendance Summary for the Last 30 Days`);
    interns.forEach(intern => {
      const records = monthAttendance.filter(a => a.userId === intern.id);
      const hadir = records.filter(a => a.status === 'HADIR').length;
      const izin = records.filter(a => a.status === 'IZIN').length;
      const sakit = records.filter(a => a.status === 'SAKIT').length;
      lines.push(`- ${intern.name}: Present ${hadir} days, On Leave ${izin} days, Sick ${sakit} days (total ${records.length} days)`);
    });

    // Recent logbook
    const recentLogbooks = await prisma.logbookEntry.findMany({
      where: { userId: { in: internIds }, date: { gte: monthAgo } },
      include: { user: { select: { name: true } }, tasks: true },
      orderBy: { date: 'desc' },
      take: 100,
    });

    if (recentLogbooks.length > 0) {
      lines.push(`\n### Logbook Terbaru (30 days)`);
      recentLogbooks.forEach(entry => {
        const d = entry.date.toISOString().split('T')[0];
        const taskSummary = entry.tasks.map(t => t.activity || t.output).filter(Boolean).join(', ');
        lines.push(`- ${entry.user.name} (${d}): ${taskSummary || 'No details'}`);
      });
    }

    // Recent Planners (Added so AI knows the plans)
    const recentPlanners = await prisma.plannerEvent.findMany({
      where: { userId: { in: internIds }, startDate: { gte: monthAgo } },
      include: { user: { select: { name: true } } },
      orderBy: { startDate: 'desc' },
      take: 100,
    });

    if (recentPlanners.length > 0) {
      lines.push(`\n### Planner / Rencana Tugas (30 days)`);
      recentPlanners.forEach(plan => {
        const d = plan.startDate.toISOString().split('T')[0];
        lines.push(`- ${plan.user.name} (${d}): ${plan.title}`);
      });
    }
  }

  lines.push('\n--- END DATABASE CONTEXT ---');
  return lines.join('\n');
}

module.exports = { buildContext };
