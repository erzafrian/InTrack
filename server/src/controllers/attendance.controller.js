const attendanceService = require('../services/attendance.service');
const storageService = require('../services/storage.service');
const { success, error } = require('../utils/response');
const { prisma } = require('../middleware/auth');

const tokenService = require('../services/token.service');
const { parseDateOnly } = require('../utils/dateOnly');
const { todayKey, minutesNow } = require('../utils/operationalTime');
const { getSettings } = require('../services/settings.service');
async function submit(req, res, next) {
  let fileUrl;
  try {
    const { date, status, latitude, longitude, reason, faceProof } = req.body;
    parseDateOnly(date);
    if (!['HADIR','IZIN','SAKIT'].includes(status)) return error(res, 'Invalid status', 400);
    if (!faceProof) return error(res, 'Face verification required', 401);
    if (!req.file) return error(res, 'Evidence must be uploaded', 400);
    if (status === 'HADIR' && (latitude == null || longitude == null)) return error(res, 'Geolocation is required', 400);
    for (const [value,limit] of [[latitude,90],[longitude,180]]) if (value != null && (String(value).trim() === '' || !Number.isFinite(Number(value)) || Math.abs(Number(value)) > limit)) return error(res, 'Invalid coordinates', 400);
    if (status !== 'HADIR' && (typeof reason !== 'string' || !reason.trim())) return error(res, 'Reason is required for leave or sickness', 400);
    if (date > todayKey()) return error(res, 'Future attendance cannot be submitted', 400);
    if (date !== todayKey()) {
      const reopened = await prisma.appSetting.findUnique({ where: { key: 'reopen_' + date } });
      if (reopened?.value !== 'true') return error(res, 'This attendance date is closed', 400);
    } else {
      const settings = await getSettings();
      const toMinutes = time => { const [h,m] = time.split(':').map(Number); return h*60+m; };
      if (minutesNow() < toMinutes(settings.absen_start_time) || minutesNow() > toMinutes(settings.absen_end_time)) return error(res, 'Attendance is available from ' + settings.absen_start_time + ' to ' + settings.absen_end_time + ' WIB', 400);
    }
    fileUrl = await storageService.uploadFile(req.file, 'attendance');
    const updated = await prisma.$transaction(async tx => {
      await tokenService.consume(faceProof, 'face', date, req.user.id, tx);
      const attendance = await attendanceService.submitAttendance(req.user.id, { date, status, latitude, longitude, reason }, tx);
      await tx.attendanceEvidence.create({ data: { attendanceId: attendance.id, fileUrl, fileType: req.file.mimetype } });
      return tx.attendance.findUnique({ where: { id: attendance.id }, include: { evidences: true, user: { select: { id: true, name: true, email: true } } } });
    }, { timeout: 15000 });
    fileUrl = null;
    return success(res, updated, 201);
  } catch (err) {
    if (fileUrl) await storageService.deleteFile(fileUrl).catch(() => {});
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
  let fileUrl;
  try {
    if (!req.file) return error(res, 'File required', 400);
    fileUrl = await storageService.uploadFile(req.file, 'attendance');
    const evidence = await attendanceService.addEvidence(req.params.id, fileUrl, req.file.mimetype);
    fileUrl = null;
    return success(res, evidence, 201);
  } catch (err) {
    if (fileUrl) await storageService.deleteFile(fileUrl).catch(() => {});
    next(err);
  }
}

module.exports = { submit, getAll, getById, uploadEvidence };
