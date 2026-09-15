import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const moduleUrl = new URL('../src/utils/calendarDate.js', import.meta.url).href;

for (const timezone of ['Asia/Jakarta', 'UTC', 'America/Los_Angeles']) {
  test(`calendar selection stays on the displayed day in ${timezone}`, () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { toLocalDateKey, fromLocalDateKey, shiftCalendarMonth } from ${JSON.stringify(moduleUrl)};
      // Local midnight must not select the next/previous numbered cell.
      assert.equal(toLocalDateKey(new Date(2026, 8, 15, 0, 30)), '2026-09-15');
      const cells = Array.from({ length: 30 }, (_, i) => new Date(2026, 8, i + 1));
      const selected = cells.filter(date => toLocalDateKey(date) === '2026-09-15');
      assert.equal(selected.length, 1);
      assert.equal(selected[0].getDate(), 15);
      assert.equal(selected[0].getDay(), 2); // Tuesday
      assert.equal(fromLocalDateKey('2026-09-15').getDate(), 15);
      assert.equal(fromLocalDateKey('2026-09-01').getMonth(), 8);
      // Logbook month filters and database DATE labels must retain calendar days.
      assert.equal(toLocalDateKey(new Date(2026, 8, 1)), '2026-09-01');
      const storedDate = '2026-09-15T00:00:00.000Z';
      assert.equal(fromLocalDateKey(storedDate.split('T')[0]).getDate(), 15);
      assert.equal(shiftCalendarMonth('2026-01-31', 1), '2026-02-28');
      assert.equal(shiftCalendarMonth('2024-01-31', 1), '2024-02-29');
      assert.equal(shiftCalendarMonth('2026-03-31', -1), '2026-02-28');
      assert.equal(shiftCalendarMonth('2026-12-15', 1), '2027-01-15');
    `], { encoding: 'utf8', env: { ...process.env, TZ: timezone } });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
}
