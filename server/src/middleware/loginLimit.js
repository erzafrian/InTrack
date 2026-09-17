const crypto = require('crypto');
const { error } = require('../utils/response');

function createLoginLimit({ windowMs = 15 * 60000, accountLimit = 10, ipLimit = 60, maxKeys = 10000, now = Date.now } = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const time = now();
    for (const [key, bucket] of buckets) if (bucket.expires <= time) buckets.delete(key);
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const identity = crypto.createHash('sha256').update(ip + '\0' + email).digest('hex');
    const keys = [[`ip:${ip}`, ipLimit], [`account:${identity}`, accountLimit]];
    const limited = keys.map(([key, limit]) => ({ bucket: buckets.get(key), limit }))
      .find(({ bucket, limit }) => bucket && bucket.count >= limit);
    if (limited || buckets.size + keys.filter(([key]) => !buckets.has(key)).length > maxKeys) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil(((limited?.bucket.expires || time + windowMs) - time) / 1000))));
      return error(res, 'Too many login attempts. Please try again later.', 429);
    }
    const reserved = keys.map(([key]) => {
      if (!buckets.has(key)) buckets.set(key, { count: 0, expires: time + windowMs });
      const bucket = buckets.get(key);
      bucket.count++;
      return [key, bucket];
    });
    res.once('finish', () => {
      if (res.statusCode >= 400) return;
      for (const [key, bucket] of reserved) {
        if (buckets.get(key) !== bucket) continue;
        bucket.count--;
        if (!bucket.count) buckets.delete(key);
      }
    });
    next();
  };
}

module.exports = { createLoginLimit };
