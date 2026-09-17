const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

// Isolated fixtures: never load a live database or contact a provider.
const prisma = {};
const databasePath = require.resolve('../src/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { prisma } };
const config = require('../src/config/env');
Object.assign(config.s3, {
  endpoint: 'https://fixture.storage.supabase.co/storage/v1/s3',
  region: 'ap-southeast-1', accessKeyId: 'fixture-key', secretAccessKey: 'fixture-secret',
  bucketName: 'fixture-files', publicUrl: 'https://fixture.supabase.co/storage/v1/object/public/fixture-files',
});
const storage = require('../src/services/storage.service');

test('removed integration routes return 404 while auth, health and Calendar remain mounted', async t => {
  const app = require('../src/app');
  const server = app.listen(0, '127.0.0.1');
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  for (const [method, route] of [
    ['GET', '/auth/notion'], ['GET', '/auth/notion/callback?code=fixture'],
    ['GET', '/auth/notion/status'], ['GET', '/auth/notion/databases'],
    ['PUT', '/auth/notion/database'], ['GET', '/auth/notion/syncs'],
    ['POST', '/auth/notion/sync/fixture'], ['DELETE', '/auth/notion/disconnect'],
  ]) {
    const response = await fetch(base + route, { method, redirect: 'manual', headers: { 'X-InTrack-Request': '1' } });
    assert.equal(response.status, 404, `${method} ${route}`);
    await response.text();
  }
  for (const [method, route, expected] of [
    ['GET', '/health', 200], ['POST', '/auth/login', 400], ['GET', '/google/status', 401],
  ]) {
    const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', 'X-InTrack-Request': '1' }, ...(method === 'POST' ? { body: '{}' } : {}) });
    assert.equal(response.status, expected, route);
    await response.text();
  }
});

test('Supabase storage still uploads evidence and supports compensating deletion', async t => {
  const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const commands = [];
  t.mock.method(S3Client.prototype, 'send', async command => { commands.push(command); return {}; });
  const file = { mimetype: 'image/png', buffer: Buffer.from('fixture') };
  const url = await storage.uploadFile(file, 'attendance');
  assert.ok(commands[0] instanceof PutObjectCommand);
  assert.equal(commands[0].input.Bucket, 'fixture-files');
  assert.equal(commands[0].input.Body, file.buffer);
  assert.equal(url, config.s3.publicUrl + '/' + commands[0].input.Key);
  assert.match(commands[0].input.Key, /^attendance\/.+\.png$/);
  await storage.deleteFile(url);
  assert.ok(commands[1] instanceof DeleteObjectCommand);
  assert.equal(commands[1].input.Key, commands[0].input.Key);
});

test('valid attendance persists evidence without calling an external synchronization provider', async t => {
  const { todayKey } = require('../src/utils/operationalTime');
  const settings = require('../src/services/settings.service');
  const tokens = require('../src/services/token.service');
  const attendance = require('../src/services/attendance.service');
  const saved = { id: 'attendance-fixture', evidences: [] };
  t.mock.method(settings, 'getSettings', async () => ({ absen_start_time: '00:00', absen_end_time: '23:59' }));
  t.mock.method(tokens, 'consume', async (proof, purpose, date, userId) => {
    assert.equal(proof, 'fixture-proof'); assert.equal(purpose, 'face');
    assert.equal(date, todayKey()); assert.equal(userId, 'intern-fixture');
  });
  t.mock.method(storage, 'uploadFile', async () => 'https://files.example.invalid/evidence.png');
  t.mock.method(attendance, 'submitAttendance', async () => saved);
  prisma.$transaction = async fn => fn({
    attendanceEvidence: { create: async ({ data }) => { saved.evidences.push(data); } },
    attendance: { findUnique: async () => saved },
  });
  const outgoing = t.mock.method(global, 'fetch', async () => { throw new Error('Unexpected provider request'); });
  const controllerPath = require.resolve('../src/controllers/attendance.controller');
  delete require.cache[controllerPath];
  const { submit } = require(controllerPath);
  let responseStatus, payload, failure;
  await submit({
    user: { id: 'intern-fixture' }, file: { mimetype: 'image/png' },
    body: { date: todayKey(), status: 'HADIR', latitude: '-6.2', longitude: '106.8', faceProof: 'fixture-proof' },
  }, { status(value) { responseStatus = value; return this; }, json(value) { payload = value; } }, err => { failure = err; });
  assert.equal(failure, undefined);
  assert.equal(responseStatus, 201);
  assert.equal(payload.data.evidences[0].fileUrl, 'https://files.example.invalid/evidence.png');
  assert.equal(outgoing.mock.callCount(), 0);
});

test('partial AI configuration fails locally instead of using an implicit provider or model', async t => {
  const { chat } = require('../src/services/ai.service');
  const outgoing = t.mock.method(global, 'fetch', async () => { throw new Error('Unexpected provider request'); });
  const original = { ...config.ai };
  t.after(() => Object.assign(config.ai, original));
  for (const missing of ['apiKey', 'baseUrl', 'model']) {
    Object.assign(config.ai, { apiKey: 'fixture', baseUrl: 'https://ai.example.invalid/v1', model: 'fixture-model', [missing]: '' });
    await assert.rejects(chat([{ role: 'user', content: 'How many interns are registered?' }]), { statusCode: 501, message: /AI provider not configured/ });
  }
  assert.equal(outgoing.mock.callCount(), 0);
});
