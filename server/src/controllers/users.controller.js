const bcrypt = require('bcryptjs');
const { prisma } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const { validateUser, badRequest } = require('../utils/validation');

async function validateMentor(tx, mentorId, role, userId) {
  if (!mentorId) return;
  const mentor = await tx.user.findUnique({ where: { id: mentorId }, select: { role: true } });
  if (role !== 'INTERN' || mentorId === userId || !mentor || mentor.role !== 'MENTOR') throw badRequest('Assign an intern to a valid mentor');
}

async function protectLastAdmin(tx, existing, newRole) {
  if (existing.role === 'SUPERUSER' && newRole !== 'SUPERUSER' &&
      await tx.user.count({ where: { role: 'SUPERUSER' } }) <= 1) {
    throw Object.assign(new Error('At least one administrator must remain. Create another administrator first.'), { statusCode: 409 });
  }
}

async function getAll(req, res, next) {
  try {
    const { role, search } = req.query;
    const where = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, department: true, mentorId: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
    return success(res, users);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    validateUser(req.body);
    const { name, email, password, role, department, mentorId } = req.body;
    if (!name || !email || !password) return error(res, 'name, email, password required', 400);

    const cleanEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findFirst({ where: { email: { equals: cleanEmail, mode: 'insensitive' } } });
    if (existing) return error(res, 'Email already exists', 409);

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.$transaction(async tx => {
      await validateMentor(tx, mentorId, role || 'INTERN');
      return tx.user.create({
        data: { name: name.trim(), email: cleanEmail, passwordHash, role: role || 'INTERN', department, mentorId },
        select: { id: true, name: true, email: true, role: true, department: true, createdAt: true },
      });
    }, { isolationLevel: 'Serializable' });
    return success(res, user, 201);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    validateUser(req.body, { partial: true });
    const { name, email, password, role, department, mentorId } = req.body;
    const data = {};
    if (name) data.name = name.trim();
    if (email) data.email = email.trim().toLowerCase();
    if (role) data.role = role;
    if (department !== undefined) data.department = department;
    if (mentorId !== undefined) data.mentorId = mentorId;
    if (password) data.passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async tx => {
      const existing = await tx.user.findUnique({ where: { id: req.params.id } });
      if (!existing) throw Object.assign(new Error('User not found'), { statusCode: 404 });
      const newRole = role || existing.role;
      await protectLastAdmin(tx, existing, newRole);
      if (newRole !== 'MENTOR' && existing.role === 'MENTOR' && await tx.user.count({ where: { mentorId: existing.id } })) throw Object.assign(new Error('Reassign this mentor\'s interns before changing their role'), { statusCode: 409 });
      if (newRole !== 'INTERN') data.mentorId = null;
      await validateMentor(tx, data.mentorId === undefined ? existing.mentorId : data.mentorId, newRole, existing.id);
      if (data.email && await tx.user.findFirst({ where: { id: { not: existing.id }, email: { equals: data.email, mode: 'insensitive' } } })) throw Object.assign(new Error('Email already exists'), { statusCode: 409 });
      const updated = await tx.user.update({
        where: { id: req.params.id },
        data,
        select: { id: true, name: true, email: true, role: true, department: true, createdAt: true },
      });
      if (password || newRole !== existing.role) await tx.authSession.deleteMany({ where: { userId: req.params.id } });
      return updated;
    }, { isolationLevel: 'Serializable', timeout: 15000 });
    return success(res, user);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const userId = req.params.id;

    if (userId === req.user.id) return error(res, 'You cannot delete your own account', 400);
    await prisma.$transaction(async tx => {
    const existing = await tx.user.findUnique({ where: { id: userId } });
    if (!existing) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    await protectLastAdmin(tx, existing, null);
    if (await tx.user.count({ where: { mentorId: userId } })) throw Object.assign(new Error("Reassign this mentor's interns before deleting the account"), { statusCode: 409 });
    // Cascade delete related records
    // Delete attendance evidences first (via attendance IDs)
    const attendances = await tx.attendance.findMany({ where: { userId }, select: { id: true } });
    const attendanceIds = attendances.map(a => a.id);
    if (attendanceIds.length > 0) {
      await tx.attendanceEvidence.deleteMany({ where: { attendanceId: { in: attendanceIds } } });
      // Retained legacy sync rows must be removed before their attendance records.
      await tx.externalSync.deleteMany({ where: { entityId: { in: attendanceIds } } });
    }
    await tx.attendance.deleteMany({ where: { userId } });

    // Delete logbook tasks (via entry IDs)
    const entries = await tx.logbookEntry.findMany({ where: { userId }, select: { id: true } });
    const entryIds = entries.map(e => e.id);
    if (entryIds.length > 0) {
      await tx.logbookTask.deleteMany({ where: { entryId: { in: entryIds } } });
    }
    await tx.logbookEntry.deleteMany({ where: { userId } });

    // Delete other related records
    await tx.plannerEvent.deleteMany({ where: { userId } });
    await tx.faceEmbedding.deleteMany({ where: { userId } });
    await tx.chatRoom.deleteMany({ where: { userId } });

    // Finally delete the user
    await tx.user.delete({ where: { id: userId } });
    }, { isolationLevel: 'Serializable', timeout: 15000 });
    return success(res, { message: 'User deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, create, update, remove };
