const { prisma } = require('../middleware/auth');
const { calculateDistance } = require('../utils/geo');
const { parseDateOnly } = require('../utils/dateOnly');
const { getSettings } = require('./settings.service');

async function submitAttendance(userId, data, tx = prisma) {
  const { date, status, latitude, longitude, reason } = data;
  const attendanceDate = parseDateOnly(date);

  let distanceKm = null;
  const lat = latitude != null ? parseFloat(latitude) : null;
  const lng = longitude != null ? parseFloat(longitude) : null;
  if (lat !== null && lng !== null) {
    const settings = await getSettings(tx);
    distanceKm = calculateDistance(Number(settings.office_latitude), Number(settings.office_longitude), lat, lng);
  }

  return tx.attendance.upsert({
    where: { userId_date: { userId, date: attendanceDate } },
    create: {
      userId,
      date: attendanceDate,
      status,
      checkInTime: new Date(),
      latitude: lat,
      longitude: lng,
      distanceKm,
      reason,
    },
    update: { status, checkInTime: new Date(), latitude: lat, longitude: lng, distanceKm, reason },
    include: { evidences: true },
  });
}

async function getAttendances(userId, role, query) {
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

  return prisma.attendance.findMany({
    where,
    include: { evidences: true, user: { select: { id: true, name: true, email: true } } },
    orderBy: { date: 'desc' },
  });
}

async function getAttendanceById(id) {
  return prisma.attendance.findUnique({
    where: { id },
    include: { evidences: true, user: { select: { id: true, name: true, email: true } } },
  });
}

async function addEvidence(attendanceId, fileUrl, fileType) {
  return prisma.attendanceEvidence.create({
    data: { attendanceId, fileUrl, fileType },
  });
}

module.exports = { submitAttendance, getAttendances, getAttendanceById, addEvidence };
