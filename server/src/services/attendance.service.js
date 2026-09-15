const { prisma } = require('../middleware/auth');
const { calculateDistance } = require('../utils/geo');
const config = require('../config/env');

async function submitAttendance(userId, data) {
  const { date, status, latitude, longitude, reason } = data;
  // Store at UTC noon — can never flip to a different calendar day in any timezone
  const attendanceDate = new Date(`${date}T12:00:00Z`);

  let distanceKm = null;
  const lat = latitude != null ? parseFloat(latitude) : null;
  const lng = longitude != null ? parseFloat(longitude) : null;
  if (lat && lng) {
    distanceKm = calculateDistance(config.office.latitude, config.office.longitude, lat, lng);
  }

  return prisma.attendance.upsert({
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
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
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
