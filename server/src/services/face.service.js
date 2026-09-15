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

  const response = await fetch(`${AI_BASE}${endpoint}`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30000),
  });

  const result = await response.json();
  if (!response.ok || !result.success) throw Object.assign(new Error(result.message || 'Face service unavailable'), { statusCode: response.status >= 500 ? 503 : 400 });
  return result;
}

async function enrollFace(userId, file, label) {
  const result = await callAIService('/enroll', file);

  await prisma.faceEmbedding.create({
    data: {
      userId,
      embedding: result.embedding,
      label: label || 'front',
    },
  });

  const count = await prisma.faceEmbedding.count({ where: { userId } });
  if (count >= REQUIRED_PHOTOS) {
    await prisma.user.update({
      where: { id: userId },
      data: { faceEnrolled: true },
    });
  }

  return { enrolled: count, remaining: Math.max(0, REQUIRED_PHOTOS - count) };
}

async function verifyFace(userId, file, date) {
  parseDateOnly(date);
  const attempt = await prisma.faceAttempt.upsert({ where: { userId }, create: { userId }, update: {} });
  if (attempt.blockedUntil && attempt.blockedUntil <= new Date()) await prisma.faceAttempt.updateMany({ where: { userId, blockedUntil: { lte: new Date() } }, data: { failures: 0, blockedUntil: null } });
  const reservation = await prisma.faceAttempt.updateMany({ where: { userId, failures: { lt: 5 }, OR: [{ blockedUntil: null }, { blockedUntil: { lte: new Date() } }] }, data: { failures: { increment: 1 } } });
  if (!reservation.count) throw blocked();
  await prisma.faceAttempt.updateMany({ where: { userId, failures: { gte: 5 } }, data: { blockedUntil: new Date(Date.now() + 15 * 60000) } });

  const embeddings = await prisma.faceEmbedding.findMany({
    where: { userId },
    select: { embedding: true },
  });

  if (embeddings.length < REQUIRED_PHOTOS) {
    throw Object.assign(new Error('Complete all 15 enrollment photos first.'), { statusCode: 400 });
  }

  const storedEmbeddings = embeddings.map((e) => e.embedding);

  const result = await callAIService('/verify', file, {
    stored_embeddings: JSON.stringify(storedEmbeddings),
  });

  let faceProof = null;
  if (result.match) {
    await prisma.faceAttempt.update({ where: { userId }, data: { failures: 0, blockedUntil: null } });
    faceProof = await tokenService.issue(userId, 'face', date, 2 * 60000);
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
  await prisma.oneTimeToken.deleteMany({ where: { userId, purpose: 'face' } });
  await prisma.faceAttempt.deleteMany({ where: { userId } });
  await prisma.faceEmbedding.deleteMany({ where: { userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { faceEnrolled: false },
  });
  return { reset: true };
}

module.exports = { enrollFace, verifyFace, getEnrollmentStatus, resetEnrollment };
