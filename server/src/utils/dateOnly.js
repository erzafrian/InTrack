// Prisma represents PostgreSQL DATE values as UTC midnight, without local time.
function parseDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw Object.assign(new Error('Date must use YYYY-MM-DD format'), { statusCode: 400 });
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw Object.assign(new Error('Invalid calendar date'), { statusCode: 400 });
  }
  return date;
}

module.exports = { parseDateOnly };
