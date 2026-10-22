// Runs background.js against a fake chrome.* and a fake Todoist/Claude API,
// to exercise the real event flows end to end in Node.
import assert from 'node:assert/strict';

const DAY = 86400000;
const now = Date.now();
const ago = (d) => new Date(now - d * DAY).toISOString().replace(/\.\d{3}Z$/, 'Z');

// ---- fake Todoist ----
const db = {
  projects: [
    { id: 'inbox', name: 'Inbox', inbox_project: true },
    { id: 'big', name: 'Big Projects', created_at: ago(60) },
    { id: 'fun', name: 'Fun', created_at: ago(60) },
  ],
  sections: [
    { id: 'sat', name: 'Satellite', project_id: 'big', section_order: 1, added_at: ago(60) },
    { id: 'go', name: 'Gokart', project_id: 'big', section_order: 2, added_at: ago(60) },
    { id: 'mov', name: 'Movies', project_id: 'fun', section_order: 1, added_at: ago(60) },
  ],
  tasks: [
    { id: 't1', content: 'Solder IMU board', project_id: 'big', section_id: 'sat', child_order: 1, labels: ['30m'], added_at: ago(9), checked: false },
    { id: 't2', content: 'Order bearings', project_id: 'big', section_id: 'go', child_order: 1, labels: ['15m'], added_at: ago(1), checked: false },
    { id: 'dd', content: 'Submit grant form', project_id: 'big', section_id: 'go', child_order: 5, labels: [], added_at: ago(3), checked: false, due: { date: new Date(now + 2 * DAY).toISOString().slice(0, 10) } },
    { id: 't6', content: 'Watch Dune 2', project_id: 'fun', section_id: 'mov', child_order: 1, labels: [], added_at: ago(30), checked: false },
  ],
  completed: [{ id: 'c1', project_id: 'big', section_id: 'go', completed_at: ago(0.2) }],
};
const calls = [];
let pageSize = 2; // force pagination
globalThis.fetch = async (url, opts = {}) => {
  url = new URL(url);
  calls.push({ method: opts.method || 'GET', path: url.pathname, query: Object.fromEntries(url.searchParams), body: opts.body && JSON.parse(opts.body), headers: opts.headers });
  const json = (o, status = 200) => ({ ok: status < 300, status, text: async () => JSON.stringify(o), json: async () => o });
  if (url.pathname === '/api/v1/sync') {
    const { commands } = JSON.parse(opts.body);
    const status = {}, map = {};
    for (const c of commands) {
      if (c.type === 'section_add') {
        if (db.sections.length >= 20) { status[c.uuid] = { error: 'Maximum number of sections reached', error_extra: { max_count: 20 } }; continue; }
        const id = `sec${db.sections.length}`; map[c.temp_id] = id;
        db.sections.push({ id, name: c.args.name, project_id: c.args.project_id, section_order: 9, added_at: ago(0) });
      } else if (c.type === 'item_add') {
        const id = `new${db.tasks.length}`; map[c.temp_id] = id;
        const a = { ...c.args };
        for (const k of ['section_id', 'parent_id']) if (a[k] && map[a[k]]) a[k] = map[a[k]];
        db.tasks.push({ id, labels: [], child_order: 99, added_at: ago(0), checked: false, ...a });
      } else if (c.type === 'item_move') {
        const t = db.tasks.find((x) => x.id === c.args.id);
        if (c.args.section_id) { t.section_id = c.args.section_id; t.project_id = db.sections.find((x) => x.id === c.args.section_id).project_id; }
        else { t.project_id = c.args.project_id; t.section_id = null; }
      } else if (c.type === 'item_reorder') {
        for (const it of c.args.items) db.tasks.find((t) => t.id === it.id).child_order = it.child_order;
      }
      status[c.uuid] = status[c.uuid] || 'ok';
    }
    return json({ sync_status: status, temp_id_mapping: map });
  }
  if (url.hostname === 'api.anthropic.com') {
    return json({ content: [{ type: 'text', text: '{"title":"Satellite needs ten minutes","body":"Nine days quiet. Solder the IMU board, 30m."}' }] });
  }
  if (opts.headers.Authorization !== 'Bearer tok') return json({ error: 'auth' }, 401);
  const p = url.pathname.replace('/api/v1/', '');
  const page = (arr, key) => {
    const start = Number(url.searchParams.get('cursor') || 0);
    const slice = arr.slice(start, start + pageSize);
    return json({ [key]: slice, next_cursor: start + pageSize < arr.length ? String(start + pageSize) : null });
  };
  if (p === 'projects') return page(db.projects, 'results');
  if (p === 'sections') return page(db.sections, 'results');
  if (p === 'tasks' && (opts.method || 'GET') === 'GET') return page(db.tasks.filter((t) => !t.checked), 'results');
  if (p === 'tasks/completed/by_completion_date') {
    assert.match(url.searchParams.get('since'), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    return page(db.completed, 'items');
  }
  if (p === 'tasks' && opts.method === 'POST') {
    const b = JSON.parse(opts.body);
    const t = { id: `n${db.tasks.length}`, ...b, project_id: 'inbox', labels: [], child_order: 9, added_at: ago(0), checked: false };
    db.tasks.push(t);
    return json(t);
  }
  const del = /^tasks\/([^/]+)$/.exec(p);
  if (del && opts.method === 'DELETE') { db.tasks = db.tasks.filter((t) => t.id !== del[1]); return { ok: true, status: 204, text: async () => '' }; }
  const m = /^tasks\/(.+)\/close$/.exec(p);
  if (m) { const t = db.tasks.find((x) => x.id === m[1]); t.checked = true; db.completed.push({ ...t, completed_at: ago(0) }); return { ok: true, status: 204, text: async () => '' }; }
  return json({ error: 'nope' }, 404);
};

// ---- fake chrome ----
const store = {};
const listeners = {};
const on = (name) => ({ addListener: (fn) => (listeners[name] = fn) });
const notifications = [];
const alarms = {};
const tabUpdates = [];
let idleState = 'active';
globalThis.chrome = {
  storage: { local: {
    get: async (k) => (typeof k === 'string' ? { [k]: structuredClone(store[k]) } : structuredClone(store)),
    set: async (o) => Object.assign(store, structuredClone(o)),
  } },
  notifications: { create: async (id, o) => notifications.push({ id, ...o }), clear: () => {}, onClicked: on('nClick'), onButtonClicked: on('nButton') },
  alarms: {
    create: async (n, o) => (alarms[n] = o), clear: async (n) => delete alarms[n],
    getAll: async () => Object.keys(alarms).map((name) => ({ name })), onAlarm: on('alarm'),
  },
  idle: { queryState: async () => idleState, setDetectionInterval: () => {}, onStateChanged: on('idle') },
  tabs: { update: (id, o) => tabUpdates.push({ id, ...o }), create: async () => {} },
  windows: { getLastFocused: async () => ({ id: 1 }) },
  webNavigation: { onBeforeNavigate: on('nav'), onHistoryStateUpdated: on('navHistory') },
  runtime: { onStartup: on('startup'), onInstalled: on('installed'), onMessage: on('msg'), getURL: (p) => `chrome-extension://abc/${p}`, openOptionsPage: () => {} },
  action: { onClicked: on('action') },
};

await import('../background.js');
const msg = (m) => new Promise((res) => listeners.msg(m, {}, res));

// install with no token: no crash, alarms set
await listeners.installed({ reason: 'install' });
assert.ok(alarms.tick && alarms.sync, 'alarms created');
let d = await msg({ type: 'getData' });
assert.equal(d.snapshot, null);

// save token → fetch with pagination
await msg({ type: 'saveSettings', settings: { token: 'tok', notifyBriefing: true } }); // briefing is off by default since 0.5.6
d = await msg({ type: 'getData' });
assert.equal(d.snapshot.tasks.length, 4, 'all pages fetched');
assert.equal(d.snapshot.projects.length, 3);
console.log('ok  fetch + pagination');

// startup → one briefing notification, mentions Gokart progress and quiet Satellite
await listeners.startup();
assert.equal(notifications.length, 1);
assert.match(notifications[0].message, /Gokart/);
assert.match(notifications[0].message, /Satellite/);
await listeners.startup(); // duplicate guard
assert.equal(notifications.length, 1, 'no double briefing');
console.log('ok  briefing:', notifications[0].title, '|', notifications[0].message);

// nothing pops up in the first 10 minutes after Chrome starts
await listeners.alarm({ name: 'tick' });
assert.equal(notifications.length, 1, 'startup grace');
store.startedAt = Date.now() - 11 * 60000;

// first active tick: deadline 2 days out gets its "3 days" reminder, once
store.activeMinutes = 0;
store.snoozeUntil = Date.now() + 3600000; // deadlines ignore snooze
await listeners.alarm({ name: 'tick' });
assert.equal(notifications.length, 2);
assert.ok(/Submit grant form/.test(notifications[1].title + notifications[1].message), notifications[1].title);
console.log('ok  deadline:', notifications[1].title, '|', notifications[1].message);
await listeners.alarm({ name: 'tick' });
assert.equal(notifications.length, 2, 'deadline reminder not repeated');
store.snoozeUntil = 0;
notifications.splice(1, 1); // keep later indexes as before

// ticks: no nudge until 150 active minutes
store.activeMinutes = 0;
for (let i = 0; i < 29; i++) await listeners.alarm({ name: 'tick' });
assert.equal(notifications.length, 1);
await listeners.alarm({ name: 'tick' });
assert.equal(notifications.length, 2, 'nudge after 150 active min');
assert.equal(store.activeMinutes, 0);
console.log('ok  nudge:', notifications[1].title, '|', notifications[1].message);

// idle ticks don't count
idleState = 'idle';
for (let i = 0; i < 30; i++) await listeners.alarm({ name: 'tick' });
assert.equal(store.activeMinutes, 0);
idleState = 'active';
console.log('ok  idle time ignored');

// return after long absence → new briefing
store.lastActiveAt = Date.now() - 7 * 3600000;
store.lastBriefingAt = Date.now() - 7 * 3600000;
await listeners.idle('active');
assert.equal(notifications.length, 3);
console.log('ok  return-from-away briefing');

// pause list: reddit redirected, other sites not, subframes not
await listeners.nav({ frameId: 0, tabId: 5, url: 'https://old.reddit.com/r/all' });
await listeners.nav({ frameId: 0, tabId: 6, url: 'https://example.com/' });
await listeners.nav({ frameId: 1, tabId: 7, url: 'https://reddit.com/' });
assert.equal(tabUpdates.length, 1);
await listeners.nav({ frameId: 0, tabId: 8, url: 'https://m.youtube.com/watch?v=x' });
await listeners.nav({ frameId: 0, tabId: 9, url: 'https://www.facebook.com/' });
await listeners.nav({ frameId: 0, tabId: 10, url: 'https://notfacebook.com/' });
assert.equal(tabUpdates.length, 2, 'facebook paused, YouTube no longer, lookalike domain not');
tabUpdates.splice(1);
assert.match(tabUpdates[0].url, /pause\.html\?u=https%3A%2F%2Fold\.reddit\.com/);
console.log('ok  pause redirect');

// break: sites open freely, nudges paused, sticky reminder at end
await msg({ type: 'startBreak', minutes: 30 });
assert.ok(alarms.breakEnd);
await listeners.nav({ frameId: 0, tabId: 5, url: 'https://reddit.com/' });
assert.equal(tabUpdates.length, 1, 'no redirect during break');
store.activeMinutes = 500;
await listeners.alarm({ name: 'tick' });
assert.equal(notifications.length, 3, 'no nudges during break');
await listeners.alarm({ name: 'breakEnd' });
const endN = notifications[3];
assert.ok(endN.requireInteraction);
assert.match(endN.title, /30m/);
assert.equal(store.breakBlock, null);
console.log('ok  break end:', endN.title, '|', endN.message);

// snooze button stops nudges
const nid = notifications[1].id;
await listeners.nButton(nid, 1);
assert.ok(store.snoozeUntil > Date.now());
store.activeMinutes = 500;
await listeners.alarm({ name: 'tick' });
assert.equal(notifications.length, 4, 'snoozed');
store.snoozeUntil = 0;
console.log('ok  snooze');

// complete from new tab
await msg({ type: 'complete', taskId: 't1' });
d = await msg({ type: 'getData' });
assert.ok(!d.snapshot.tasks.some((t) => t.id === 't1'));
console.log('ok  complete task');

// AI wording when enabled
await msg({ type: 'saveSettings', settings: { aiEnabled: true, anthropicKey: 'sk-test' } });
const r = await msg({ type: 'testNudge' });
assert.equal(r.nudge.title, 'Satellite needs ten minutes');
const ai = calls.find((c) => c.path === '/v1/messages');
assert.equal(ai.headers['anthropic-dangerous-direct-browser-access'], 'true');
assert.equal(JSON.parse(JSON.stringify(ai.body)).model, 'claude-haiku-5-5');
console.log('ok  AI wording');

// bad token surfaces an error and keeps cached data
await msg({ type: 'saveSettings', settings: { token: 'wrong' } });
d = await msg({ type: 'getData', force: true });
assert.ok(d.lastError, 'error recorded');
assert.ok(d.snapshot, 'cache kept');
console.log('ok  bad token:', d.lastError.message);
// create a task from the new tab: next step in Gokart, with labels, due, steps
store.settings = { ...store.settings, token: 'tok' };
let cr = await msg({ type: 'createTask', form: {
  content: 'Order bearings', description: '', subtasks: ['measure axle'],
  target: { kind: 'section', projectId: 'big', sectionId: 'go' },
  estimate: '15m', low: false, dueDate: '2026-10-20', dueTime: null, soft: true, nextStep: true,
} });
assert.ok(cr.ok, JSON.stringify(cr));
const made = db.tasks.find((t) => t.id === cr.taskId);
assert.deepEqual(made.labels, ['15m', 'soft']);
assert.equal(made.child_order, 1, 'moved to the top');
assert.ok(db.tasks.find((t) => t.id === 't2').child_order > 1, 'old top step pushed down');
assert.equal(db.tasks.find((t) => t.content === 'measure axle').parent_id, cr.taskId);
d = await msg({ type: 'getData' });
assert.ok(d.snapshot.tasks.some((t) => t.id === cr.taskId), 'snapshot refreshed');
console.log('ok  create task as next step');

// new project with a hand-picked watch list gets added to it
store.settings.trackedAreaIds = ['s:sat'];
cr = await msg({ type: 'createTask', form: { content: 'Pick mirror size', target: { kind: 'new', newName: 'Telescope', parentProjectId: 'big' } } });
assert.ok(cr.ok && cr.sectionId);
assert.ok(store.settings.trackedAreaIds.includes(`s:${cr.sectionId}`));
console.log('ok  new project section + watched');

// Todoist refusing (section limit) comes back as a readable error
while (db.sections.length < 20) db.sections.push({ id: `f${db.sections.length}`, name: 'x', project_id: 'big' });
cr = await msg({ type: 'createTask', form: { content: 'x', target: { kind: 'new', newName: 'Too many', parentProjectId: 'big' } } });
assert.match(cr.error, /Maximum number of sections reached \(limit 20\)/);
cr = await msg({ type: 'createTask', form: { content: '', target: { kind: 'project', projectId: 'inbox' } } });
assert.match(cr.error, /Write what the task is/);
console.log('ok  errors surface');

// focus timer: done completes the task and logs time; stop saves a completed subtask
store.settings.token = 'tok';
const tgt = db.tasks.find((t) => !t.checked && t.id === 't2') || db.tasks.find((t) => !t.checked);
let fr = await msg({ type: 'focusStart', taskId: tgt.id, title: 'Order bearings', area: 'Gokart' });
assert.ok(fr.ok);
fr = await msg({ type: 'focusStart', taskId: 'x', title: 'Other' });
assert.match(fr.error, /Already focusing/);
store.activeMinutes = 500;
const before = notifications.length;
await listeners.alarm({ name: 'tick' });
assert.equal(notifications.filter((n, i) => i >= before && n.id.startsWith('nudge')).length, 0, 'no nudges while focusing');
store.focus.startedAt = Date.now() - 25 * 60000;
fr = await msg({ type: 'focusDone' });
assert.equal(fr.minutes, 25);
assert.ok(db.tasks.find((t) => t.id === tgt.id).checked, 'task closed');
assert.equal(store.focus, null);

const tgt2 = db.tasks.find((t) => !t.checked && !t.parent_id && t.id !== tgt.id);
await msg({ type: 'focusStart', taskId: tgt2.id, title: 'Solder' });
store.focus.startedAt = Date.now() - 40 * 60000;
fr = await msg({ type: 'focusStop', note: 'Power rail soldered' });
assert.equal(fr.minutes, 40);
const sub = db.tasks.find((t) => t.content === 'Power rail soldered');
assert.equal(sub.parent_id, tgt2.id);
assert.ok(sub.checked, 'subtask completed');
assert.ok(!db.tasks.find((t) => t.id === tgt2.id).checked, 'parent stays open');

await msg({ type: 'focusStart', taskId: tgt2.id, title: 'Solder' });
fr = await msg({ type: 'focusStop', discard: true });
assert.equal(fr.minutes, 0);

// ticking off the focused task elsewhere counts as Done
await msg({ type: 'focusStart', taskId: tgt2.id, title: 'Solder' });
store.focus.startedAt = Date.now() - 10 * 60000;
fr = await msg({ type: 'complete', taskId: tgt2.id });
assert.equal(fr.minutes, 10);
assert.deepEqual(store.focusLog.map((x) => [x.minutes, x.outcome]), [[25, 'done'], [40, 'partial'], [10, 'done']]);
console.log('ok  focus timer: done, partial step, discard, tick-off');

// break ended early counts the real minutes
await msg({ type: 'startBreak', minutes: 60 });
store.breakBlock.startedAt -= 12 * 60000;
store.breakLog.at(-1).at = store.breakBlock.startedAt;
await msg({ type: 'endBreak' });
assert.equal(store.breakLog.at(-1).actualMinutes, 12);
d = await msg({ type: 'getData' });
assert.ok(Array.isArray(d.focusLog) && Array.isArray(d.breakLog));
console.log('ok  break actual minutes');

// break budget: after 3h used today, only 15-minute breaks
store.breakLog = [{ at: Date.now() - 60000 * 200, minutes: 180, actualMinutes: 180 }];
let br = await msg({ type: 'startBreak', minutes: 60 });
assert.equal(br.minutes, 15, 'clamped to 15');
await msg({ type: 'endBreak' });
store.breakLog = [];
br = await msg({ type: 'startBreak', minutes: 60 });
assert.equal(br.minutes, 60);
await msg({ type: 'endBreak' });
console.log('ok  break budget');

// move and delete (weekly review)
const inboxTask = db.tasks.find((t) => !t.checked && t.project_id === 'big' && !t.parent_id);
let mv = await msg({ type: 'moveTask', taskId: inboxTask.id, sectionId: 'sat', projectId: 'big' });
assert.ok(mv.ok);
assert.equal(db.tasks.find((t) => t.id === inboxTask.id).section_id, 'sat');
mv = await msg({ type: 'deleteTask', taskId: inboxTask.id });
assert.ok(mv.ok && !db.tasks.some((t) => t.id === inboxTask.id));
console.log('ok  move + delete');

// shutdown notification fires once when the time passes
{
  const d = new Date(Date.now() - 60000);
  store.settings.shutdownTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  delete store.shutdownNotified; delete store.shutdownDone;
  store.breakBlock = null; store.focus = null;
  const n0 = notifications.length;
  await listeners.alarm({ name: 'tick' });
  const sd = notifications.slice(n0).filter((n) => n.id.startsWith('shutdown'));
  assert.equal(sd.length, 1, 'shutdown sent');
  assert.match(sd[0].message, /done today/);
  await listeners.alarm({ name: 'tick' });
  assert.equal(notifications.slice(n0).filter((n) => n.id.startsWith('shutdown')).length, 1, 'only once');
  store.settings.shutdownTime = '00:00';
  console.log('ok  shutdown notification:', sd[0].title, '|', sd[0].message);
}

// shutdown & review markers
await msg({ type: 'shutdownDone' });
assert.ok(store.shutdownDone && store.snoozeUntil > Date.now());
await msg({ type: 'reviewDone' });
assert.ok(store.reviewedWeek);
store.snoozeUntil = 0;
console.log('ok  shutdown + review done');

// pages can detect a stale background
assert.equal((await msg({ type: 'hello' })).protocol, 5);
assert.equal((await msg({ type: 'nope' })).error, 'unknown message');
console.log('ok  stale-background check');

// update from an old version that only paused reddit → new defaults; YouTube always removed once
store.settings = { ...store.settings, blockedSites: ['reddit.com'] };
delete store.migratedNoYoutube;
await listeners.installed({ reason: 'update' });
assert.deepEqual(store.settings.blockedSites, ['reddit.com', 'facebook.com']);
store.settings.blockedSites = ['reddit.com', 'www.youtube.com', 'x.com'];
delete store.migratedNoYoutube;
await listeners.installed({ reason: 'update' });
assert.deepEqual(store.settings.blockedSites, ['reddit.com', 'x.com']);
store.settings.blockedSites = ['reddit.com', 'youtube.com'];
await listeners.installed({ reason: 'update' });
assert.deepEqual(store.settings.blockedSites, ['reddit.com', 'youtube.com'], 'if you add it back later, it stays');
console.log('ok  pause-list migration');

console.log('\nALL PASSED');
