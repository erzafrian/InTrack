const { prisma } = require('../middleware/auth');
const config = require('../config/env');

const AI_BASE = config.faceService.baseUrl;
const REQUIRED_PHOTOS = 15;
const tokenService = require('./token.service');
const { parseDateOnly } = require('../utils/dateOnly');
const blocked = () => Object.assign(new Error('Too many face verification attempts. Try again in 15 minutes.'), { statusCode: 429 });

async function callAIService(endpoint, file, extraFields = {}) {
  const formData = new FormData();
  const blob = new Blob([file.buffer], { type: file.mimetype });
  formData.append('file', blob, file.originalname);

  for (const [key, value] of Object.entries(extraFields)) {
    formData.append(key, value);
  }

  let response, result;
  try {
    response = await fetch(`${AI_BASE}${endpoint}`, { method: 'POST', body: formData, signal: AbortSignal.timeout(30000) });
    result = await response.json();
  } catch {
    throw Object.assign(new Error('Face service is unavailable. Please try again.'), { statusCode: 503 });
  }
  if (!response.ok || !result.success) throw Object.assign(new Error(result.message || 'Face service unavailable'), { statusCode: response.status >= 500 ? 503 : response.status === 429 ? 429 : 400 });
  return result;
}

async function enrollFace(userId, file, label) {
  const ensureOpen = async tx => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { faceEnrolled: true } });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    const count = await tx.faceEmbedding.count({ where: { userId } });
    if (user.faceEnrolled || count >= REQUIRED_PHOTOS) throw Object.assign(new Error('Face is already registered. Ask your mentor or administrator to reset it.'), { statusCode: 409 });
    return count;
  };
  await ensureOpen(prisma);
  const result = await callAIService('/enroll', file);
  return prisma.$transaction(async tx => {
    // Serializable isolation prevents concurrent requests from exceeding the cap.
    const count = (await ensureOpen(tx)) + 1;
    await tx.faceEmbedding.create({
      data: { userId, embedding: result.embedding, label: label || 'front' },
    });
    if (count >= REQUIRED_PHOTOS) {
      await tx.user.update({ where: { id: userId }, data: { faceEnrolled: true } });
    }
    return { enrolled: count, remaining: Math.max(0, REQUIRED_PHOTOS - count) };
  }, { isolationLevel: 'Serializable', timeout: 15000 });
}

async function verifyFace(userId, file, date) {
  parseDateOnly(date);
  const embeddings = await prisma.faceEmbedding.findMany({
    where: { userId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: REQUIRED_PHOTOS, select: { id: true, embedding: true },
  });
  if (embeddings.length < REQUIRED_PHOTOS) throw Object.assign(new Error('Complete all 15 enrollment photos first.'), { statusCode: 400 });
  const attempt = await prisma.faceAttempt.upsert({ where: { userId }, create: { userId }, update: {} });
  if (attempt.blockedUntil && attempt.blockedUntil <= new Date()) await prisma.faceAttempt.updateMany({ where: { userId, blockedUntil: { lte: new Date() } }, data: { failures: 0, blockedUntil: null } });
  const reservation = await prisma.faceAttempt.updateMany({ where: { userId, failures: { lt: 5 }, OR: [{ blockedUntil: null }, { blockedUntil: { lte: new Date() } }] }, data: { failures: { increment: 1 } } });
  if (!reservation.count) throw blocked();
  await prisma.faceAttempt.updateMany({ where: { userId, failures: { gte: 5 } }, data: { blockedUntil: new Date(Date.now() + 15 * 60000) } });

  const storedEmbeddings = embeddings.map((e) => e.embedding);
  let result;
  try {
    result = await callAIService('/verify', file, { stored_embeddings: JSON.stringify(storedEmbeddings) });
  } catch (err) {
    if (err.statusCode === 429 || err.statusCode >= 500) {
      // Busy/offline providers are not failed identity checks.
      await prisma.faceAttempt.updateMany({ where: { userId, failures: { gt: 0 } }, data: { failures: { decrement: 1 } } });
      await prisma.faceAttempt.updateMany({ where: { userId, failures: { lt: 5 } }, data: { blockedUntil: null } });
    }
    throw err;
  }

  let faceProof = null;
  if (result.match) {
    faceProof = await prisma.$transaction(async tx => {
      const count = await tx.faceEmbedding.count({ where: { userId, id: { in: embeddings.map(e => e.id) } } });
      const user = await tx.user.findUnique({ where: { id: userId }, select: { faceEnrolled: true } });
      if (count !== REQUIRED_PHOTOS || !user?.faceEnrolled) throw Object.assign(new Error('Face enrollment changed. Please verify again.'), { statusCode: 409 });
      await tx.faceAttempt.updateMany({ where: { userId }, data: { failures: 0, blockedUntil: null } });
      return tokenService.issue(userId, 'face', date, 2 * 60000, tx);
    }, { isolationLevel: 'Serializable', timeout: 15000 });
  }
  return {
    faceProof,
    match: result.match,
    similarity: result.similarity,
    threshold: result.threshold,
  };
}

async function getEnrollmentStatus(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { faceEnrolled: true },
  });

  const count = await prisma.faceEmbedding.count({ where: { userId } });

  return {
    enrolled: user?.faceEnrolled || false,
    photoCount: count,
    required: REQUIRED_PHOTOS,
  };
}

async function resetEnrollment(userId) {
  return prisma.$transaction(async tx => {
    await tx.oneTimeToken.deleteMany({ where: { userId, purpose: 'face' } });
    await tx.faceAttempt.deleteMany({ where: { userId } });
    await tx.faceEmbedding.deleteMany({ where: { userId } });
    await tx.user.update({ where: { id: userId }, data: { faceEnrolled: false } });
    return { reset: true };
  }, { isolationLevel: 'Serializable', timeout: 15000 });
}

module.exports = { enrollFace, verifyFace, getEnrollmentStatus, resetEnrollment };
