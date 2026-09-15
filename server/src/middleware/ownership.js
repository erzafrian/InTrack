const { prisma } = require('../config/database');
const { error } = require('../utils/response');
// Mentors may read every intern, as requested. Mutations remain owner/admin only.
function requireOwner(model, parameter, { read = false, task = false } = {}) {
  return async (req, res, next) => {
    try {
      const record = await prisma[model].findUnique({ where: { id: req.params[parameter] }, ...(task ? { include: { entry: true } } : {}) });
      const owner = task ? record?.entry?.userId : record?.userId;
      if (!record || !(owner === req.user.id || req.user.role === 'SUPERUSER' || (read && req.user.role === 'MENTOR'))) return error(res, 'Record not found', 404);
      req.ownedRecord = record;
      next();
    } catch (err) { next(err); }
  };
}
module.exports = { requireOwner };
