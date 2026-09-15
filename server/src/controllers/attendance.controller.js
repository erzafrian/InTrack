const attendanceService = require('../services/attendance.service');
const r2Service = require('../services/r2.service');
const { success, error } = require('../utils/response');
const { prisma } = require('../middleware/auth');

async function submit(req, res, next) {
  try {
    const { date, status, latitude, longitude, reason } = req.body;
    if (!date || !status) return error(res, 'Date and status required', 400);
    if (!['HADIR', 'IZIN', 'SAKIT'].includes(status)) return error(res, 'Invalid status', 400);
    if (status === 'HADIR' && (latitude == null || longitude == null)) {
      return error(res, "Geolocation is required when checking in as Present", 400);
    }

    // Feature 2: Validate date must be today (unless reopened by admin)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    if (date !== todayStr) {
      const reopened = await prisma.appSetting.findUnique({ where: { key: `reopen_${date}` } });
      if (!reopened) {
        return error(res, "Attendance can only be submitted for today", 400);
      }
    }

    // Feature 2: Validate within attendance time window (only for today)
    if (date === todayStr) {
      const endTimeSetting = await prisma.appSetting.findUnique({ where: { key: 'absen_end_time' } });
      const endTimeStr = endTimeSetting?.value || '17:00';
      const [endH, endM] = endTimeStr.split(':').map(Number);
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const endMinutes = endH * 60 + endM;
      if (currentMinutes > endMinutes) {
        return error(res, `The attendance window has closed. Today's deadline was ${endTimeStr} WIB`, 400);
      }
    }

    // Feature 3: Evidence mandatory
    if (!req.file) {
      return error(res, "Evidence must be uploaded", 400);
    }

    const attendance = await attendanceService.submitAttendance(req.user.id, { date, status, latitude, longitude, reason });

    const fileUrl = await r2Service.uploadFile(req.file, 'attendance');
    await attendanceService.addEvidence(attendance.id, fileUrl, req.file.mimetype);

    // Sync to Notion (non-blocking, per-user token)
    const notionService = require('../services/notion.service');
    notionService.syncAttendanceToNotion(req.user.id, attendance, req.user.name).catch(() => {});

    const updated = await attendanceService.getAttendanceById(attendance.id);
    return success(res, updated, 201);
  } catch (err) {
    next(err);
  }
}

async function getAll(req, res, next) {
  try {
    const data = await attendanceService.getAttendances(req.user.id, req.user.role, req.query);
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const data = await attendanceService.getAttendanceById(req.params.id);
    if (!data) return error(res, 'Attendance not found', 404);
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function uploadEvidence(req, res, next) {
  try {
    if (!req.file) return error(res, 'File required', 400);
    const fileUrl = await r2Service.uploadFile(req.file, 'attendance');
    const evidence = await attendanceService.addEvidence(req.params.id, fileUrl, req.file.mimetype);
    return success(res, evidence, 201);
  } catch (err) {
    next(err);
  }
}

module.exports = { submit, getAll, getById, uploadEvidence };
