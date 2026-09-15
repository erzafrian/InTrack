const { parseDateOnly } = require('./dateOnly');
const TIME_ZONE = 'Asia/Jakarta';
function todayKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = key => parts.find(p => p.type === key).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function minutesNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  return Number(parts.find(p => p.type === 'hour').value) * 60 + Number(parts.find(p => p.type === 'minute').value);
}
function dayStart(key) { parseDateOnly(key); return new Date(`${key}T00:00:00+07:00`); }
function nextDate(key) { const date = parseDateOnly(key); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); }
module.exports = { TIME_ZONE, todayKey, minutesNow, dayStart, nextDate };
