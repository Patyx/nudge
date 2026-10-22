import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeState } from '../engine.js';
import {
  dayId, nextDayId, topFor, setTop, topItems, doneToday, areaStreak, breakUsedToday, breakOptions,
  twoMinuteTask, inShutdownWindow, isReviewTime, weekId, reviewData,
} from '../daily.js';

const L = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const iso = (ms) => new Date(ms).toISOString();

test('logical day runs 04:00 to 04:00', () => {
  assert.equal(dayId(L(2026, 10, 14, 23, 50)), '2026-10-14');
  assert.equal(dayId(L(2026, 10, 15, 0, 30)), '2026-10-14', 'just after midnight is still Wednesday');
  assert.equal(dayId(L(2026, 10, 15, 4, 1)), '2026-10-15');
  assert.equal(nextDayId(L(2026, 10, 15, 0, 30)), '2026-10-15');
  assert.equal(nextDayId(L(2026, 10, 31, 12)), '2026-11-01');
});

test('top 3: per day, max three, old days dropped', () => {
  const now = Date.now();
  let s = setTop({ '2000-01-01': ['old'] }, ['a', 'b', 'c', 'd', 'a'], dayId(now));
  assert.deepEqual(topFor(s, now), ['a', 'b', 'c']);
  assert.ok(!('2000-01-01' in s));
  s = setTop(s, ['x'], nextDayId(now));
  assert.deepEqual(topFor(s, now), ['a', 'b', 'c'], 'tomorrow does not overwrite today');
});

function fixture(now) {
  return {
    projects: [{ id: 'inbox', name: 'Inbox', inbox_project: true }, { id: 'big', name: 'Big Projects', created_at: iso(now - 60 * 864e5) }],
    sections: [{ id: 'sat', name: 'Satellite', project_id: 'big', added_at: iso(now - 60 * 864e5) }],
    tasks: [
      { id: 'a', content: 'Solder', project_id: 'big', section_id: 'sat', child_order: 1, labels: ['30m'], added_at: iso(now - 9 * 864e5) },
      { id: 'b', content: 'Reply to Marek', project_id: 'inbox', child_order: 1, labels: ['2m'], added_at: iso(now - 3 * 864e5) },
      { id: 'c', content: 'Bin day', project_id: 'inbox', child_order: 2, labels: ['2m'], added_at: iso(now - 5 * 864e5) },
    ],
    completed: [
      { id: 'd1', content: 'Wire servo', project_id: 'big', section_id: 'sat', completed_at: iso(now - 2 * 3600e3) },
      { id: 'd2', content: 'Buy flux', project_id: 'big', section_id: 'sat', completed_at: iso(now - 864e5) },
      { id: 'd3', content: 'Order PCB', project_id: 'big', section_id: 'sat', completed_at: iso(now - 2 * 864e5) },
      { id: 'd5', content: 'Old', project_id: 'big', section_id: 'sat', completed_at: iso(now - 5 * 864e5) },
    ],
  };
}

test('top items include done-today ones, drop deleted ones', () => {
  const now = L(2026, 10, 14, 18);
  const st = computeState({ ...fixture(now), top3: ['a', 'd1', 'gone'] }, {}, now);
  const items = topItems(st, ['a', 'd1', 'gone'], now);
  assert.deepEqual(items.map((x) => [x.id, x.done]), [['a', false], ['d1', true]]);
  assert.equal(st.top3.length, 3);
});

test('top 3 candidates come right after urgent deadlines', async () => {
  const { nudgeCandidates } = await import('../engine.js');
  const now = L(2026, 10, 14, 18);
  const st = computeState({ ...fixture(now), top3: ['a'] }, {}, now);
  const c = nudgeCandidates(st);
  assert.equal(c[0].key, 'top:a');
  assert.ok(!/[{}]/.test(c[0].title + c[0].body));
});

test('done today and streak', () => {
  const now = L(2026, 10, 14, 18);
  const st = computeState(fixture(now), {}, now);
  assert.deepEqual(doneToday(st, now).map((t) => t.id), ['d1']);
  const sat = st.areas.find((a) => a.name === 'Satellite');
  assert.equal(areaStreak(st, sat, now), 3);
  const noToday = computeState({ ...fixture(now), completed: fixture(now).completed.filter((t) => t.id !== 'd1') }, {}, now);
  assert.equal(areaStreak(noToday, sat, now), 2, 'not done yet today: yesterday streak still counts');
});

test('break budget', () => {
  const now = L(2026, 10, 14, 18);
  const log = [{ at: L(2026, 10, 14, 10), minutes: 60, actualMinutes: 50 }, { at: L(2026, 10, 14, 15), minutes: 120 }, { at: L(2026, 10, 13, 15), minutes: 180 }];
  assert.equal(breakUsedToday(log, now), 170);
  assert.deepEqual(breakOptions(180, 0), { left: 180, over: false, options: [30, 60, 120, 180] });
  assert.deepEqual(breakOptions(180, 100), { left: 80, over: false, options: [30, 60] });
  assert.deepEqual(breakOptions(180, 160), { left: 20, over: false, options: [20] });
  assert.deepEqual(breakOptions(180, 170), { left: 10, over: true, options: [15] });
  assert.deepEqual(breakOptions(180, 400), { left: 0, over: true, options: [15] });
});

test('two-minute task: oldest first, at most hourly, skips dismissed', () => {
  const now = L(2026, 10, 14, 18);
  const st = computeState(fixture(now), {}, now);
  assert.equal(twoMinuteTask(st, 0, now).id, 'c');
  assert.equal(twoMinuteTask(st, now - 30 * 60000, now), null);
  assert.equal(twoMinuteTask(st, 0, now, ['c']).id, 'b');
});

test('shutdown window crosses midnight', () => {
  assert.ok(!inShutdownWindow('00:00', L(2026, 10, 14, 23, 0)));
  assert.ok(inShutdownWindow('00:00', L(2026, 10, 14, 23, 40)));
  assert.ok(inShutdownWindow('00:00', L(2026, 10, 15, 1, 0)));
  assert.ok(!inShutdownWindow('00:00', L(2026, 10, 15, 4, 30)));
  assert.ok(inShutdownWindow('22:00', L(2026, 10, 14, 21, 45)));
  assert.ok(!inShutdownWindow('22:00', L(2026, 10, 14, 12, 0)));
});

test('review time: Sunday from 21:00 until the logical day ends', () => {
  assert.ok(!isReviewTime('21:00', L(2026, 10, 18, 20, 0)));
  assert.ok(isReviewTime('21:00', L(2026, 10, 18, 21, 5)));
  assert.ok(isReviewTime('21:00', L(2026, 10, 19, 1, 0)), 'Sunday night after midnight');
  assert.ok(!isReviewTime('21:00', L(2026, 10, 19, 9, 0)));
  assert.equal(weekId(L(2026, 10, 18, 22)), '2026-10-12');
  assert.equal(weekId(L(2026, 10, 19, 9)), '2026-10-19');
});

test('review data', () => {
  const now = L(2026, 10, 14, 18);
  const st = computeState(fixture(now), { actionStaleDays: 7 }, now);
  const r = reviewData(st, st.settings, [{ at: now - 864e5, minutes: 40 }], [{ at: now - 864e5, minutes: 30 }], now);
  assert.deepEqual(r.inbox.map((t) => t.id).sort(), ['b', 'c']);
  assert.equal(r.done.length, 4);
  assert.equal(r.stuck[0].task.id, 'a');
  assert.equal(r.focus, 40);
  assert.equal(r.brk, 30);
});
