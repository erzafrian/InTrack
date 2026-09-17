const badRequest = message => Object.assign(new Error(message), { statusCode: 400 });
const validTime = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
function validateTask(task) {
  if (!validTime(task.timeStart) || !validTime(task.timeEnd) || task.timeEnd <= task.timeStart) throw badRequest('Task end time must be later than start time (HH:mm).');
  if (![task.activity, task.quantitativeActivity, task.qualitativeActivity].some(v => typeof v === 'string' && v.trim())) throw badRequest('At least one activity is required');
  for (const key of ['activity','quantitativeActivity','qualitativeActivity','output']) if (task[key] != null && typeof task[key] !== 'string') throw badRequest('Task text must be a string');
}
function validateUser(data, { partial = false } = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw badRequest('Invalid user data');
  if (!partial || data.name !== undefined) {
    if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 120) throw badRequest('Name must contain 1 to 120 characters');
  }
  if (!partial || data.email !== undefined) {
    if (typeof data.email !== 'string' || data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) throw badRequest('Use a valid email address');
  }
  if (!partial || (data.password !== undefined && data.password !== '')) {
    if (typeof data.password !== 'string' || data.password.length < 12 || Buffer.byteLength(data.password, 'utf8') > 72) throw badRequest('Password must contain at least 12 characters and at most 72 UTF-8 bytes');
  }
  if (data.role !== undefined && !['INTERN', 'MENTOR', 'SUPERUSER'].includes(data.role)) throw badRequest('Invalid role');
  if (data.department != null && (typeof data.department !== 'string' || data.department.length > 120)) throw badRequest('Department must contain at most 120 characters');
  if (data.mentorId != null && (typeof data.mentorId !== 'string' || !data.mentorId)) throw badRequest('Invalid mentor');
}
module.exports = { badRequest, validTime, validateTask, validateUser };
