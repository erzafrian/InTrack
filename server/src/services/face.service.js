const { prisma } = require('../middleware/auth');
const config = require('../config/env');

const AI_BASE = config.faceService.baseUrl;

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
  });

  const result = await response.json();
  if (!result.success) throw new Error(result.message);
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
  if (count >= 15) {
    await prisma.user.update({
      where: { id: userId },
      data: { faceEnrolled: true },
    });
  }

  return { enrolled: count, remaining: Math.max(0, 3 - count) };
}

async function verifyFace(userId, file) {
  const embeddings = await prisma.faceEmbedding.findMany({
    where: { userId },
    select: { embedding: true },
  });

  if (embeddings.length === 0) {
    throw new Error('Face not enrolled. Please enroll your face first.');
  }

  const storedEmbeddings = embeddings.map((e) => e.embedding);

  const result = await callAIService('/verify', file, {
    stored_embeddings: JSON.stringify(storedEmbeddings),
  });

  return {
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
    required: 3,
  };
}

async function resetEnrollment(userId) {
  await prisma.faceEmbedding.deleteMany({ where: { userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { faceEnrolled: false },
  });
  return { reset: true };
}

module.exports = { enrollFace, verifyFace, getEnrollmentStatus, resetEnrollment };
