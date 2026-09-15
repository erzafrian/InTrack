const badRequest = message => Object.assign(new Error(message), { statusCode: 400 });
const validTime = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
function validateTask(task) {
  if (!validTime(task.timeStart) || !validTime(task.timeEnd) || task.timeEnd <= task.timeStart) throw badRequest('Task end time must be later than start time (HH:mm).');
  if (![task.activity, task.quantitativeActivity, task.qualitativeActivity].some(v => typeof v === 'string' && v.trim())) throw badRequest('At least one activity is required');
  for (const key of ['activity','quantitativeActivity','qualitativeActivity','output']) if (task[key] != null && typeof task[key] !== 'string') throw badRequest('Task text must be a string');
}
module.exports = { badRequest, validTime, validateTask };
