import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINES } from '../voice.js';
import {
  deadlineInfo, deadlineAlerts, deadlineNotification, deadlines, breakEndText, dayKey,
  DAY, HOUR, computeState, nudgeCandidates, pickNudge, briefing, fitsIn,
  minutesFromLabels, autoTrackedIds, buildAreas, cleanTitle,
} from '../engine.js';

const NOW = Date.parse('2026-10-13T10:00:00Z');
const ago = (d) => new Date(NOW - d * DAY).toISOString();

function fixture() {
  return {
    projects: [
      { id: 'inbox', name: 'Inbox', inbox_project: true },
      { id: 'big', name: 'Big Projects', created_at: ago(60) },
      { id: 'small', name: 'Small Projects', created_at: ago(60) },
      { id: 'life', name: 'Life', created_at: ago(60) },
      { id: 'fun', name: 'Fun', created_at: ago(60) },
    ],
    sections: [
      { id: 'sat', name: 'Satellite', project_id: 'big', section_order: 1, added_at: ago(60) },
      { id: 'go', name: 'Gokart', project_id: 'big', section_order: 2, added_at: ago(60) },
      { id: 'roc', name: 'Rocket', project_id: 'big', section_order: 3, added_at: ago(60) },
      { id: 'nov', name: 'Novel', project_id: 'big', section_order: 4, added_at: ago(60) },
      { id: 'home', name: 'Home', project_id: 'life', section_order: 1, added_at: ago(60) },
      { id: 'mov', name: 'Movies', project_id: 'fun', section_order: 1, added_at: ago(60) },
    ],
    tasks: [
      { id: 't1', content: 'Solder IMU board', project_id: 'big', section_id: 'sat', child_order: 1, labels: ['30m'], added_at: ago(3) },
      { id: 't2', content: 'Order bearings', project_id: 'big', section_id: 'go', child_order: 1, labels: ['15m'], added_at: ago(2) },
      { id: 't3', content: 'Design nozzle', project_id: 'big', section_id: 'roc', child_order: 1, labels: ['3h'], added_at: ago(12) },
      { id: 't3b', content: 'Sub of nozzle', project_id: 'big', section_id: 'roc', parent_id: 't3', child_order: 1, labels: [], added_at: ago(1) },
      { id: 't5', content: 'Fix tap', project_id: 'life', section_id: 'home', child_order: 1, labels: ['low'], added_at: ago(20) },
      { id: 't6', content: 'Watch Dune 2', project_id: 'fun', section_id: 'mov', child_order: 1, labels: ['3h'], added_at: ago(30) },
      { id: 't7', content: 'Renew domain', project_id: 'small', child_order: 1, labels: ['15m'], added_at: ago(1) },
    ],
    completed: [
      { id: 'c1', content: 'Buy frame', project_id: 'big', section_id: 'go', completed_at: ago(0.3) },
      { id: 'c2', content: 'Wire servo', project_id: 'big', section_id: 'sat', completed_at: ago(6) },
      { id: 'c3', content: 'Fuel calc', project_id: 'big', section_id: 'roc', completed_at: ago(2) },
    ],
    completedLookbackDays: 30,
  };
}

const settings = { projectStaleDays: 4, actionStaleDays: 7 };

test('labels parse to minutes', () => {
  assert.equal(minutesFromLabels(['15m']), 15);
  assert.equal(minutesFromLabels(['x', '1h']), 60);
  assert.equal(minutesFromLabels(['1.5h']), 90);
  assert.equal(minutesFromLabels(['2 hrs']), 120);
  assert.equal(minutesFromLabels(['urgent']), null);
});

test('sections become areas, inbox skipped, auto-tracking picks *Projects*', () => {
  const areas = buildAreas(fixture());
  assert.deepEqual(areas.map((a) => a.name), ['Satellite', 'Gokart', 'Rocket', 'Novel', 'Small Projects', 'Home', 'Movies']);
  const tracked = autoTrackedIds(areas);
  assert.deepEqual(tracked, ['s:sat', 's:go', 's:roc', 's:nov', 'p:small']);
});

test('staleness: Satellite 6d quiet is stale, Gokart moving, Novel empty', () => {
  const st = computeState(fixture(), settings, NOW);
  const by = Object.fromEntries(st.areas.map((a) => [a.name, a]));
  assert.ok(by.Satellite.stale);
  assert.equal(Math.floor(by.Satellite.daysQuiet), 6);
  assert.ok(!by.Gokart.stale);
  assert.equal(by.Gokart.doneLast24h, 1);
  assert.equal(by.Novel.openCount, 0);
  assert.ok(by.Novel.stale, 'no completions in lookback → quiet since creation, capped');
  assert.ok(!by.Home.tracked);
  assert.equal(by.Rocket.next.id, 't3', 'subtask is not the next step');
});

test('candidates carry reasons and rank empty > stale > aging', () => {
  const st = computeState(fixture(), settings, NOW);
  const c = nudgeCandidates(st);
  assert.equal(c[0].kind, 'empty');
  const stale = c.find((x) => x.key === 'stale:s:sat');
  assert.ok(stale.body.includes('Solder IMU board'), stale.body);
  const aging = c.find((x) => x.key === 'aging:t3');
  assert.equal(aging.kind, 'agingBig', '3h task waiting 12 days is "too big"');
  assert.ok(c.some((x) => x.kind === 'momentum' && x.areaId === 's:go'));
  assert.ok(!c.some((x) => x.taskId === 't6' && x.kind !== 'leisure'), 'leisure tasks only appear as leisure');
  assert.ok(c.some((x) => x.kind === 'random'), 'a random task is offered');
  for (const x of c) {
    assert.ok(!/[{}]/.test(x.title + x.body), `unfilled placeholder: ${x.title} ${x.body}`);
    assert.ok(x.body.length <= 230, `body too long: ${x.body}`);
  }
});

test('wording is stable within a day and varies across days', () => {
  const a = nudgeCandidates(computeState(fixture(), settings, NOW)).find((x) => x.key === 'stale:s:sat');
  const b = nudgeCandidates(computeState(fixture(), settings, NOW + 60000)).find((x) => x.key === 'stale:s:sat');
  assert.equal(a.title, b.title);
  const lines = new Set();
  for (let d = 0; d < 20; d++) lines.add(nudgeCandidates(computeState(fixture(), settings, NOW + d * DAY)).find((x) => x.key === 'stale:s:sat').line);
  assert.ok(lines.size >= 4, `only ${lines.size} variants over 20 days`);
});

test('pickNudge respects key and area cooldowns', () => {
  const st = computeState(fixture(), settings, NOW);
  const c = nudgeCandidates(st);
  const first = pickNudge(c, [], NOW);
  const second = pickNudge(c, [{ key: first.key, areaId: first.areaId, at: NOW - HOUR }], NOW);
  assert.notEqual(second.key, first.key);
  assert.notEqual(second.areaId, first.areaId);
  const later = pickNudge(c, [{ key: first.key, areaId: first.areaId, at: NOW - 7 * HOUR }], NOW);
  assert.equal(later.key, first.key);
});

test('briefing summarises progress and quiet projects', () => {
  const st = computeState(fixture(), settings, NOW);
  const b = briefing(st, NOW - 3 * DAY, NOW);
  assert.equal(b.doneCount, 2);
  assert.match(b.body, /Gokart/);
  assert.match(b.body, /Rocket/);
  assert.match(b.body, /Quiet: .*Satellite 6d/);
  assert.match(b.body, /Start with:/);
  const empty = briefing(st, NOW - 2 * HOUR, NOW);
  assert.match(empty.body, /Nothing completed in the last 2h/);
});

test('fitsIn: only estimated, non-leisure tasks, stale areas first', () => {
  const st = computeState(fixture(), settings, NOW);
  const r = fitsIn(st, 30).map((x) => x.t.id);
  assert.equal(r[0], 't1', 'Satellite is stale so its 30m step leads');
  assert.ok(r.includes('t2') && r.includes('t7'));
  assert.ok(!r.includes('t6') && !r.includes('t3'));
});

test('cleanTitle strips markdown links', () => {
  assert.equal(cleanTitle('Read [spec](https://x.y) now'), 'Read spec now');
});

// ---------- deadlines ----------

function local(y, m, d, h = 12, min = 0) { return new Date(y, m - 1, d, h, min).getTime(); }
const pad = (n) => String(n).padStart(2, '0');
const dateStr = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

function dlFixture(now) {
  const f = fixture();
  const at = (days) => dateStr(now + days * DAY);
  f.tasks.push(
    { id: 'd0', content: 'Pay invoice', project_id: 'life', section_id: 'home', child_order: 2, labels: [], added_at: ago(5), due: { date: at(0) } },
    { id: 'd1', content: 'Send report', project_id: 'small', child_order: 2, labels: ['30m'], added_at: ago(5), due: { date: at(1) } },
    { id: 'd2', content: 'Book flights', project_id: 'small', child_order: 3, labels: [], added_at: ago(5), due: { date: at(2) } },
    { id: 'd5', content: 'Register for race', project_id: 'small', child_order: 4, labels: [], added_at: ago(5), deadline: { date: at(5) }, due: { date: at(1) } },
    { id: 'd9', content: 'Far away thing', project_id: 'small', child_order: 5, labels: [], added_at: ago(5), due: { date: at(9) } },
    { id: 'dl', content: 'Renew passport', project_id: 'life', section_id: 'home', child_order: 3, labels: [], added_at: ago(30), due: { date: at(-3) } },
    { id: 'dr', content: 'Water plants', project_id: 'life', section_id: 'home', child_order: 4, labels: [], added_at: ago(30), due: { date: at(0), is_recurring: true } },
    { id: 'ds', content: 'Maybe paint fence', project_id: 'life', section_id: 'home', child_order: 5, labels: ['soft'], added_at: ago(30), due: { date: at(0) } },
  );
  return f;
}

test('deadline info: deadline field wins, recurring and soft are ignored, days are calendar days', () => {
  const now = local(2026, 10, 13, 23, 30);
  const f = dlFixture(now);
  const get = (id) => deadlineInfo(f.tasks.find((t) => t.id === id), now);
  assert.equal(get('d0').daysLeft, 0);
  assert.equal(get('d1').daysLeft, 1, '23:30 today → tomorrow is 1 day, not 0');
  assert.equal(get('d5').daysLeft, 5, 'deadline field beats due date');
  assert.equal(get('d5').source, 'deadline');
  assert.equal(get('dl').daysLeft, -3);
  assert.equal(get('dr'), null);
  assert.equal(get('ds'), null);
  const timed = deadlineInfo({ labels: [], due: { date: '2026-10-14T15:00:00' } }, now);
  assert.equal(timed.daysLeft, 1);
  assert.ok(timed.hasTime);
});

test('deadline stages and list order', () => {
  const now = local(2026, 10, 13, 9);
  const st = computeState(dlFixture(now), settings, now);
  const list = deadlines(st).map((d) => `${d.t.id}:${d.stage}`);
  assert.deepEqual(list, ['dl:overdue', 'd0:today', 'd1:1d', 'd2:3d', 'd5:week']);
});

test('deadline alerts: once per stage, daily while overdue, weekly after two weeks', () => {
  const now = local(2026, 10, 13, 9);
  const st = computeState(dlFixture(now), settings, now);
  const first = deadlineAlerts(st, {});
  assert.equal(first.length, 5);
  const sent = Object.fromEntries(first.map((a) => [a.key, now]));
  assert.equal(deadlineAlerts(st, sent).length, 0, 'nothing repeats the same day');

  const next = now + DAY;
  const st2 = computeState(dlFixture(now), settings, next);
  const again = deadlineAlerts(st2, sent).map((a) => `${a.t.id}:${a.stage}`).sort();
  // d0 became overdue, dl overdue again (new day), d1 now today, d2 now 1d. d5 still 'week' stage: no repeat.
  assert.deepEqual(again, ['d0:overdue', 'd1:today', 'd2:1d', 'dl:overdue']);

  const longLate = { ...dlFixture(now) };
  longLate.tasks = longLate.tasks.map((t) => (t.id === 'dl' ? { ...t, due: { date: dateStr(now - 20 * DAY) } } : t));
  const st3 = computeState(longLate, settings, now);
  const k1 = deadlineAlerts(st3, {}).find((a) => a.t.id === 'dl').key;
  const st4 = computeState(longLate, settings, now + DAY);
  const k2 = deadlineAlerts(st4, {}).find((a) => a.t.id === 'dl').key;
  assert.match(k1, /:overdue:w\d+$/);
  assert.ok(k1 === k2 || /:overdue:w/.test(k2), 'weekly bucket after 14 days late');
});

test('deadline notification: single gets a voiced line, several are batched', () => {
  const now = local(2026, 10, 13, 9);
  const st = computeState(dlFixture(now), settings, now);
  const alerts = deadlineAlerts(st, {});
  const one = deadlineNotification(st, alerts.filter((a) => a.t.id === 'd1'));
  assert.equal(one.taskId, 'd1');
  assert.ok(/Send report/.test(one.title + one.body));
  const many = deadlineNotification(st, alerts);
  assert.match(many.title, /^5 deadlines, 2 need you today$/);
  assert.match(many.body, /3 days late: "Renew passport"\. Today: "Pay invoice"\. Tomorrow: "Send report"\. And 2 more\./);
});

test('deadlines outrank project nudges and lead the briefing', () => {
  const now = local(2026, 10, 13, 9);
  const st = computeState(dlFixture(now), settings, now);
  const c = nudgeCandidates(st);
  assert.equal(c[0].key, 'deadline:dl');
  assert.equal(c[1].key, 'deadline:d0');
  const b = briefing(st, now - DAY, now);
  assert.match(b.title, /2 deadlines today or overdue/);
  assert.match(b.lines[0], /^Deadlines: "Renew passport" 3 days late, "Pay invoice" today, "Send report" tomorrow\.$/);
});

test('evening adds a leisure suggestion, daytime does not', () => {
  const f = fixture();
  const day = computeState(f, settings, local(2026, 10, 13, 14));
  const eve = computeState(f, settings, local(2026, 10, 13, 20));
  assert.ok(!nudgeCandidates(day).some((c) => c.kind === 'leisure'));
  const l = nudgeCandidates(eve).find((c) => c.kind === 'leisure');
  assert.equal(l.taskId, 't6');
});

test('break end names a real next step', () => {
  const st = computeState(fixture(), settings, NOW);
  const t = breakEndText(st, 60);
  assert.ok(t.taskId);
  assert.match(t.title, /1h/);
  const none = breakEndText(null, 30);
  assert.match(none.title, /30m/);
});

test('every line renders cleanly with worst-case values', () => {
  const vars = { summary: '4 done today, 1h 50m focused.', area: 'Satellite ground station', task: 'x'.repeat(48), est: ' (1.5h)', estRaw: '1.5h', days: '30+', limit: 4, age: 120, n: 3, when: 'on Wednesday', late: '14 days', where: 'Small Projects', dur: '3h', time: ' at 14:00', last: 'x'.repeat(48) };
  for (const [kind, pool] of Object.entries(LINES)) {
    for (const [t, b] of pool) {
      if (kind === 'quick') assert.ok(!/estRaw/.test(t + b), 'quick wins may have no estimate (@low), so no {estRaw}');
      const fill = (s) => s.replace(/\{(\w+)\}/g, (_, k) => { assert.ok(k in vars, `${kind}: unknown {${k}}`); return String(vars[k]); });
      const title = fill(t), body = fill(b);
      assert.ok(title.length <= 75, `${kind} title too long (${title.length}): ${title}`);
      assert.ok(body.length <= 230, `${kind} body too long (${body.length}): ${body}`);
    }
  }
});
