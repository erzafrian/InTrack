const { prisma } = require('../config/database');
const config = require('../config/env');
const { validTime, badRequest } = require('../utils/validation');
const KEYS = ['absen_start_time','absen_end_time','office_latitude','office_longitude'];
async function getSettings(tx = prisma) {
  const settings = { absen_start_time: '10:00', absen_end_time: '17:00', office_latitude: String(config.office.latitude), office_longitude: String(config.office.longitude) };
  for (const row of await tx.appSetting.findMany({ where: { key: { in: KEYS } } })) settings[row.key] = row.value;
  return settings;
}
async function updateSettings(updates) {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates) || Object.keys(updates).some(key => !KEYS.includes(key))) throw badRequest('Unknown setting');
  const values = { ...await getSettings(), ...updates };
  if (!validTime(values.absen_start_time) || !validTime(values.absen_end_time) || values.absen_end_time <= values.absen_start_time) throw badRequest('Attendance end time must be later than start time.');
  for (const [key, limit] of [['office_latitude',90],['office_longitude',180]]) if (String(values[key]).trim() === '' || !Number.isFinite(Number(values[key])) || Math.abs(Number(values[key])) > limit) throw badRequest('Office coordinates are invalid.');
  await prisma.$transaction(Object.entries(updates).map(([key,value]) => prisma.appSetting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } })));
  return values;
}
module.exports = { getSettings, updateSettings, KEYS };
