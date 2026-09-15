const crypto = require('crypto');
const { prisma } = require('../config/database');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const denied = () => Object.assign(new Error('Verification is invalid or expired. Please try again.'), { statusCode: 401 });

async function issue(userId, purpose, context, lifetimeMs) {
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.oneTimeToken.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await prisma.oneTimeToken.create({ data: { id: hash(token), userId, purpose, context, expiresAt: new Date(Date.now() + lifetimeMs) } });
  return token;
}

async function consume(token, purpose, context, userId, tx = prisma) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw denied();
  const id = hash(token);
  const row = await tx.oneTimeToken.findFirst({ where: { id, purpose, context, ...(userId ? { userId } : {}), expiresAt: { gt: new Date() } } });
  if (!row) throw denied();
  const consumed = await tx.oneTimeToken.deleteMany({ where: { id, purpose, context, expiresAt: { gt: new Date() } } });
  if (consumed.count !== 1) throw denied();
  return row.userId;
}
module.exports = { issue, consume, hash };
