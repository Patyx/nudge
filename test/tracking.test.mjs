import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stats7, focusMinutes, breakMinutes, fmtDuration, prune, partialTitle, MAX_FOCUS_MIN } from '../tracking.js';

const now = new Date(2026, 9, 14, 21, 0).getTime();
const at = (daysAgo, h = 12) => { const d = new Date(now); d.setDate(d.getDate() - daysAgo); d.setHours(h, 0, 0, 0); return d.getTime(); };

test('focus minutes: at least 1, capped', () => {
  assert.equal(focusMinutes(now - 25 * 60000, now), 25);
  assert.equal(focusMinutes(now - 10000, now), 1);
  assert.equal(focusMinutes(now - 14 * 3600000, now), MAX_FOCUS_MIN);
});

test('break minutes: actual if ended early, else elapsed up to planned', () => {
  assert.equal(breakMinutes({ at: now - 3600000, minutes: 30 }, now), 30);
  assert.equal(breakMinutes({ at: now - 10 * 60000, minutes: 30 }, now), 10, 'running break counts so far');
  assert.equal(breakMinutes({ at: now - 3600000, minutes: 60, actualMinutes: 12 }, now), 12);
});

test('stats7: buckets by local day, ignores older than 7 days', () => {
  const focus = [
    { at: at(0, 10), minutes: 30, outcome: 'done' },
    { at: at(0, 15), minutes: 45, outcome: 'partial' },
    { at: at(6, 9), minutes: 20, outcome: 'done' },
    { at: at(7, 9), minutes: 999, outcome: 'done' },
  ];
  const breaks = [{ at: at(1, 18), minutes: 60, actualMinutes: 40 }, { at: at(0, 20), minutes: 30 }];
  const { days, total } = stats7(focus, breaks, now);
  assert.equal(days.length, 7);
  assert.equal(days[6].label, 'Today');
  assert.equal(days[6].focus, 75);
  assert.equal(days[6].done, 1);
  assert.equal(days[5].brk, 40);
  assert.equal(days[6].brk, 30);
  assert.equal(days[0].focus, 20);
  assert.deepEqual(total, { focus: 95, brk: 70, done: 2 });
});

test('formatting and helpers', () => {
  assert.equal(fmtDuration(45), '45m');
  assert.equal(fmtDuration(60), '1h');
  assert.equal(fmtDuration(380), '6h 20m');
  assert.equal(partialTitle('  ', 25), 'Worked on it for 25m');
  assert.equal(partialTitle('Soldered rail', 25), 'Soldered rail');
  assert.equal(prune([{ at: now - 61 * 86400000 }, { at: now }], now).length, 1);
});
