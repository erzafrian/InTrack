const { prisma } = require('../middleware/auth');
const { success, error } = require('../utils/response');

async function getSettings(req, res, next) {
  try {
    const settings = await prisma.appSetting.findMany();
    const map = {};
    settings.forEach(s => { map[s.key] = s.value; });
    return success(res, map);
  } catch (err) { next(err); }
}

async function updateSettings(req, res, next) {
  try {
    const updates = req.body;
    const results = [];
    for (const [key, value] of Object.entries(updates)) {
      const setting = await prisma.appSetting.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      });
      results.push(setting);
    }
    return success(res, results);
  } catch (err) { next(err); }
}

// ── Attendance Reopen ──

async function reopenDate(req, res, next) {
  try {
    const { date } = req.body;
    if (!date) return error(res, 'Date required', 400);
    const key = `reopen_${date}`;
    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value: 'true' },
      update: { value: 'true' },
    });
    return success(res, { date, reopened: true });
  } catch (err) { next(err); }
}

async function closeDate(req, res, next) {
  try {
    const { date } = req.body;
    if (!date) return error(res, 'Date required', 400);
    const key = `reopen_${date}`;
    await prisma.appSetting.deleteMany({ where: { key } });
    return success(res, { date, reopened: false });
  } catch (err) { next(err); }
}

async function bulkReopenDates(req, res, next) {
  try {
    const { dates } = req.body;
    if (!dates || !Array.isArray(dates)) return error(res, 'Dates array required', 400);
    for (const date of dates) {
      const key = `reopen_${date}`;
      await prisma.appSetting.upsert({ where: { key }, create: { key, value: 'true' }, update: { value: 'true' } });
    }
    return success(res, { count: dates.length, reopened: true });
  } catch (err) { next(err); }
}

async function bulkCloseDates(req, res, next) {
  try {
    const { dates } = req.body;
    if (!dates || !Array.isArray(dates)) return error(res, 'Dates array required', 400);
    for (const date of dates) {
      await prisma.appSetting.deleteMany({ where: { key: `reopen_${date}` } });
    }
    return success(res, { count: dates.length, reopened: false });
  } catch (err) { next(err); }
}

async function getReopenedDates(req, res, next) {
  try {
    const settings = await prisma.appSetting.findMany({ where: { key: { startsWith: 'reopen_' } } });
    const dates = settings.map(s => s.key.replace('reopen_', ''));
    return success(res, dates);
  } catch (err) { next(err); }
}

// ── Chat Rooms ──

async function getRooms(req, res, next) {
  try {
    const rooms = await prisma.chatRoom.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, createdAt: true, updatedAt: true, _count: { select: { messages: true } } },
    });
    return success(res, rooms);
  } catch (err) { next(err); }
}

async function createRoom(req, res, next) {
  try {
    const room = await prisma.chatRoom.create({
      data: { userId: req.user.id, name: req.body.name || "New Chat" },
    });
    return success(res, room, 201);
  } catch (err) { next(err); }
}

async function updateRoom(req, res, next) {
  try {
    const room = await prisma.chatRoom.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!room) return error(res, 'Room not found', 404);
    const updated = await prisma.chatRoom.update({ where: { id: req.params.id }, data: { name: req.body.name } });
    return success(res, updated);
  } catch (err) { next(err); }
}

async function deleteRoom(req, res, next) {
  try {
    const room = await prisma.chatRoom.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!room) return error(res, 'Room not found', 404);
    await prisma.chatRoom.delete({ where: { id: req.params.id } });
    return success(res, { deleted: true });
  } catch (err) { next(err); }
}

// ── AI Query (room-based) ──

async function aiQuery(req, res, next) {
  try {
    const { query, roomId } = req.body;
    if (!query) return error(res, 'Query required', 400);

    const aiService = require('../services/ai.service');
    const { buildContext } = require('../services/ai.context');
    const userId = req.user.id;

    // Ensure room exists and belongs to user
    let room;
    if (roomId) {
      room = await prisma.chatRoom.findFirst({ where: { id: roomId, userId } });
      if (!room) return error(res, 'Room not found', 404);
    } else {
      room = await prisma.chatRoom.create({ data: { userId, name: "New Chat" } });
    }

    // Load last 20 messages from this room as context
    const history = await prisma.chatMessage.findMany({
      where: { roomId: room.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    history.reverse();

    const messages = history.map(m => ({ role: m.role, content: m.content }));
    messages.push({ role: 'user', content: query });

    // Save user message
    await prisma.chatMessage.create({ data: { roomId: room.id, role: 'user', content: query } });

    // Build real-time DB context
    const dbContext = await buildContext(userId);

    const response = await aiService.chat(messages, dbContext);

    // Save assistant response
    await prisma.chatMessage.create({ data: { roomId: room.id, role: 'assistant', content: response } });

    // Touch room updatedAt
    await prisma.chatRoom.update({ where: { id: room.id }, data: {} });

    return success(res, { response, roomId: room.id });
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
}

async function getChatHistory(req, res, next) {
  try {
    const { roomId } = req.params;
    const room = await prisma.chatRoom.findFirst({ where: { id: roomId, userId: req.user.id } });
    if (!room) return error(res, 'Room not found', 404);

    const messages = await prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true, createdAt: true },
    });
    return success(res, messages);
  } catch (err) { next(err); }
}

module.exports = { getSettings, updateSettings, reopenDate, closeDate, bulkReopenDates, bulkCloseDates, getReopenedDates, getRooms, createRoom, updateRoom, deleteRoom, aiQuery, getChatHistory };
