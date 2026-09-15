const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { parseDateOnly } = require('../src/utils/dateOnly');

for (const timezone of ['Asia/Jakarta', 'UTC', 'America/Los_Angeles']) {
  test(`logbook create and date filter agree in ${timezone}`, () => {
    const result = spawnSync(process.execPath, ['-e', `
      const assert = require('node:assert/strict');
      const authPath = ${JSON.stringify(require.resolve('../src/middleware/auth'))};
      const rows = [];
      const prisma = { logbookEntry: {
        async upsert({ where, create }) {
          assert.equal(where.userId_date.date.toISOString(), '2026-09-15T00:00:00.000Z');
          // Mimic the date-only storage boundary used by PostgreSQL/Prisma.
          const date = new Date(create.date.toISOString().slice(0, 10) + 'T00:00:00.000Z');
          const row = { ...create, date };
          rows.push(row);
          return row;
        },
        async findMany({ where }) {
          return rows.filter(row => row.userId === where.userId &&
            row.date >= where.date.gte && row.date <= where.date.lte);
        }
      }};
      require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { prisma } };
      const service = require(${JSON.stringify(require.resolve('../src/services/logbook.service'))});
      (async () => {
        const entry = await service.getOrCreateEntry('test-user', '2026-09-15');
        assert.equal(entry.date.toISOString(), '2026-09-15T00:00:00.000Z');
        assert.equal((await service.getEntries('test-user', 'INTERN', {
          startDate: '2026-09-15', endDate: '2026-09-15'
        })).length, 1);
        assert.equal((await service.getEntries('test-user', 'INTERN', {
          startDate: '2026-09-14', endDate: '2026-09-14'
        })).length, 0);
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `], { encoding: 'utf8', env: { ...process.env, TZ: timezone } });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
}

test('date-only input rejects impossible dates and timestamps', () => {
  assert.equal(parseDateOnly('2024-02-29').toISOString(), '2024-02-29T00:00:00.000Z');
  for (const input of ['2026-02-29', '2026-09-31', '', '2026-09-15T00:00:00+07:00']) {
    assert.throws(() => parseDateOnly(input), { statusCode: 400 });
  }
});
