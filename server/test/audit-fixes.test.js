const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter, once } = require('node:events');
const prisma = {};
const dbPath = require.resolve('../src/config/database');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { prisma } };
const users = require('../src/controllers/users.controller');
const face = require('../src/services/face.service');
const config = require('../src/config/env');

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
function userFixture(role = 'SUPERUSER', admins = 1) {
  let user = { id: 'fixture', role, name: 'Fixture', email: 'fixture@intrack.com', mentorId: null };
  const state = { revoked: 0, writes: 0 };
  prisma.user = {
    findUnique: async () => ({ ...user }), findFirst: async () => null,
    count: async ({ where }) => where.role === 'SUPERUSER' ? admins : 0,
    update: async ({ data }) => { state.writes++; user = { ...user, ...data }; return user; },
  };
  prisma.authSession = { deleteMany: async () => { state.revoked++; } };
  prisma.$transaction = async (fn, options) => { assert.equal(options.isolationLevel, 'Serializable'); return fn(prisma); };
  return state;
}

test('last admin cannot be demoted; ordinary profile edits preserve sessions', async () => {
  let state = userFixture();
  let failure;
  await users.update({ params: { id: 'fixture' }, body: { role: 'INTERN' } }, response(), err => { failure = err; });
  assert.equal(failure.statusCode, 409); assert.equal(state.writes, 0); assert.equal(state.revoked, 0);
  state = userFixture();
  await users.update({ params: { id: 'fixture' }, body: { role: 'SUPERUSER', department: 'Updated' } }, response(), err => { throw err; });
  assert.equal(state.writes, 1); assert.equal(state.revoked, 0);
  state = userFixture('SUPERUSER', 2);
  await users.update({ params: { id: 'fixture' }, body: { role: 'MENTOR' } }, response(), err => { throw err; });
  assert.equal(state.revoked, 1);
});

test('user creation rejects malformed email and weak passwords before database writes', async () => {
  const { validateUser } = require('../src/utils/validation');
  const valid = { name: 'Fixture', email: 'fixture@intrack.com', password: 'fixture-password' };
  for (const changes of [{ email: 'invalid' }, { password: 'a' }, { password: 'a'.repeat(73) }, { password: '😀'.repeat(19) }, { role: 'OWNER' }]) {
    assert.throws(() => validateUser({ ...valid, ...changes }), { statusCode: 400 });
  }
  assert.doesNotThrow(() => validateUser(valid));
  assert.doesNotThrow(() => validateUser({ department: 'Changed' }, { partial: true }));
});

test('completed enrollment never calls provider; final photo is rechecked inside serializable transaction', async t => {
  let count = 15, enrolled = true, providerCalls = 0;
  prisma.user = { findUnique: async () => ({ faceEnrolled: enrolled }), update: async () => { enrolled = true; } };
  prisma.faceEmbedding = { count: async () => count, create: async () => { count++; } };
  let transactions = 0;
  prisma.$transaction = async (fn, options) => {
    assert.equal(options.isolationLevel, 'Serializable'); transactions++; return fn(prisma);
  };
  t.mock.method(global, 'fetch', async () => { providerCalls++; return { ok: true, json: async () => ({ success: true, embedding: [1] }) }; });
  const file = { buffer: Buffer.from('fixture'), mimetype: 'image/png', originalname: 'fixture.png' };
  await assert.rejects(face.enrollFace('fixture', file, 'front'), { statusCode: 409 });
  assert.equal(providerCalls, 0);
  count = 14; enrolled = false;
  assert.deepEqual(await face.enrollFace('fixture', file, 'last'), { enrolled: 15, remaining: 0 });
  assert.equal(transactions, 1); assert.equal(enrolled, true);
  await assert.rejects(face.enrollFace('fixture', file, 'extra'), { statusCode: 409 });
  // Another request can complete enrollment while the provider is processing.
  count = 14; enrolled = false;
  global.fetch = async () => { count = 15; enrolled = true; return { ok: true, json: async () => ({ success: true, embedding: [1] }) }; };
  await assert.rejects(face.enrollFace('fixture', file, 'racing'), { statusCode: 409 });
  assert.equal(count, 15);
});

test('browser mutations require custom header and trusted Origin; reads remain available', async t => {
  const express = require('express');
  const app = express();
  let writes = 0;
  app.use(require('../src/middleware/requestGuard'));
  app.post('/mutation', (req, res) => { writes++; res.sendStatus(204); });
  app.get('/health', (req, res) => res.sendStatus(200));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const headers of [{}, { Origin: 'https://untrusted.invalid' }, { Origin: 'null', 'X-InTrack-Request': '1' }, { Origin: 'https://untrusted.invalid', 'X-InTrack-Request': '1' }]) {
    assert.equal((await fetch(base + '/mutation', { method: 'POST', headers })).status, 403);
  }
  assert.equal(writes, 0);
  assert.equal((await fetch(base + '/mutation', { method: 'POST', headers: { Origin: new URL(config.clientUrl).origin, 'X-InTrack-Request': '1' } })).status, 204);
  assert.equal((await fetch(base + '/health')).status, 200);
  assert.equal(writes, 1);
});

test('login limiter reserves concurrent attempts, expires blocks and refunds successful requests', () => {
  const { createLoginLimit } = require('../src/middleware/loginLimit');
  let time = 0;
  const limit = createLoginLimit({ accountLimit: 2, ipLimit: 3, windowMs: 1000, now: () => time });
  function attempt(email = 'fixture@intrack.com') {
    const res = Object.assign(new EventEmitter(), response(), { setHeader(key, value) { this[key] = value; } });
    limit({ ip: '127.0.0.1', body: { email } }, res, () => { res.allowed = true; });
    return res;
  }
  assert.equal(attempt().allowed, true); assert.equal(attempt().allowed, true);
  assert.equal(attempt().statusCode, 429);
  assert.equal(attempt('another@intrack.com').allowed, true);
  assert.equal(attempt('third@intrack.com').statusCode, 429);
  time = 1001;
  const success = attempt(); success.emit('finish');
  assert.equal(attempt().allowed, true); assert.equal(attempt().allowed, true);
  assert.equal(attempt().statusCode, 429);
});

test('Calendar failures preserve local data and expose a retryable warning; failed delete does not delete locally', async t => {
  const google = require('../src/services/google.service');
  const planner = require('../src/services/planner.service');
  const event = { id: 'fixture-event', userId: 'fixture', title: 'Fixture', startDate: new Date('2026-09-17T03:00:00Z'), endDate: new Date('2026-09-17T04:00:00Z'), gcalEventId: 'linked' };
  let deletes = 0;
  prisma.plannerEvent = { create: async () => event, findUnique: async () => event, update: async ({ data }) => ({ ...event, ...data }), delete: async () => { deletes++; } };
  t.mock.method(google, 'syncEventToCalendar', async () => { throw new Error('provider offline'); });
  t.mock.method(google, 'deleteCalendarEvent', async () => { throw Object.assign(new Error('provider offline'), { statusCode: 503 }); });
  const saved = await planner.createEvent('fixture', event);
  assert.equal(saved.id, event.id); assert.equal(saved.calendarSync, 'failed'); assert.match(saved.calendarWarning, /saved in InTrack/);
  await assert.rejects(planner.deleteEvent(event.id, 'fixture'), { statusCode: 503 });
  assert.equal(deletes, 0);
  assert.equal(await planner.retrySync(event.id, 'other-user'), null);
  google.syncEventToCalendar = async () => 'linked';
  assert.equal((await planner.retrySync(event.id, 'fixture')).calendarSync, 'synced');
});

test('busy face service refunds its reserved attempt, and a reset during verification prevents proof issuance', async t => {
  const rows = Array.from({ length: 15 }, (_, i) => ({ id: String(i), embedding: [1] }));
  let failures = 4, blockedUntil = null;
  prisma.faceEmbedding = { findMany: async () => rows, count: async () => 0 };
  prisma.user = { findUnique: async () => ({ faceEnrolled: false }) };
  prisma.faceAttempt = {
    upsert: async () => ({ failures, blockedUntil }),
    updateMany: async ({ where, data }) => {
      if (where.failures?.lt != null && failures >= where.failures.lt) return { count: 0 };
      if (where.failures?.gt != null && failures <= where.failures.gt) return { count: 0 };
      if (where.failures?.gte != null && failures < where.failures.gte) return { count: 0 };
      if (data.failures?.increment) failures++;
      if (data.failures?.decrement) failures--;
      if ('blockedUntil' in data) blockedUntil = data.blockedUntil;
      return { count: 1 };
    },
  };
  prisma.$transaction = async (fn, options) => { assert.equal(options.isolationLevel, 'Serializable'); return fn(prisma); };
  const mock = t.mock.method(global, 'fetch', async () => ({ ok: false, status: 429, json: async () => ({ message: 'busy' }) }));
  const file = { buffer: Buffer.from('fixture'), mimetype: 'image/png', originalname: 'fixture.png' };
  await assert.rejects(face.verifyFace('fixture', file, '2026-09-17'), { statusCode: 429 });
  assert.equal(failures, 4); assert.equal(blockedUntil, null);
  mock.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ success: true, match: true }) }));
  await assert.rejects(face.verifyFace('fixture', file, '2026-09-17'), { statusCode: 409, message: /enrollment changed/ });
});

test('Calendar retry reuses a stable ID after remote success followed by timeout', async t => {
  const { google } = require('googleapis');
  const service = require('../src/services/google.service');
  prisma.user = { findUnique: async () => ({ googleRefreshToken: 'fixture-token' }) };
  const calls = [];
  t.mock.method(google, 'calendar', () => ({ events: {
    update: async args => { calls.push(['update', args]); if (calls.length === 1) throw { code: 404 }; return { data: { id: args.eventId } }; },
    insert: async args => { calls.push(['insert', args]); throw { code: 409 }; },
    delete: async () => { throw { code: 404 }; },
  } }));
  const event = { id: 'fixture', title: 'Fixture', startDate: new Date('2026-09-17T03:00:00Z'), endDate: new Date('2026-09-17T04:00:00Z') };
  const id = await service.syncEventToCalendar('fixture', event);
  assert.match(id, /^[a-f0-9]{64}$/);
  assert.equal(calls[0][1].eventId, id); assert.equal(calls[1][1].requestBody.id, id); assert.equal(calls[2][1].eventId, id);
  await assert.doesNotReject(service.deleteCalendarEvent('fixture', id));
});

test('logbook cleanup happens only after successful database replacement or deletion', async t => {
  const storage = require('../src/services/storage.service');
  const service = require('../src/services/logbook.service');
  const cleaned = [];
  t.mock.method(storage, 'deleteFile', async url => { cleaned.push(url); });
  let failSave = true;
  prisma.$transaction = async fn => fn(prisma);
  prisma.logbookTask = {
    findUnique: async () => ({ evidenceUrl: 'old' }),
    update: async () => { if (failSave) throw new Error('database failure'); return { evidenceUrl: 'new' }; },
    delete: async () => ({ evidenceUrl: 'new' }),
  };
  await assert.rejects(service.updateTask('fixture', { evidenceUrl: 'new' }));
  assert.deepEqual(cleaned, []);
  failSave = false;
  await service.updateTask('fixture', { evidenceUrl: 'new' });
  assert.deepEqual(cleaned, ['old']);
  await service.deleteTask('fixture');
  assert.deepEqual(cleaned, ['old', 'new']);
});
