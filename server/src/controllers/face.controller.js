const faceService = require('../services/face.service');
const { success, error } = require('../utils/response');

async function enroll(req, res, next) {
  try {
    if (!req.file) return error(res, 'Photo file required', 400);
    const label = req.body.label || 'front';
    const result = await faceService.enrollFace(req.user.id, req.file, label);
    return success(res, result, 201);
  } catch (err) {
    next(err);
  }
}

async function verify(req, res, next) {
  try {
    if (!req.file) return error(res, 'Photo file required', 400);
    const result = await faceService.verifyFace(req.user.id, req.file);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

async function status(req, res, next) {
  try {
    const result = await faceService.getEnrollmentStatus(req.user.id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

async function resetEnrollment(req, res, next) {
  try {
    const result = await faceService.resetEnrollment(req.params.userId);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

module.exports = { enroll, verify, status, resetEnrollment };
