import {
  DEFAULT_SETTINGS, DAY, HOUR, computeState, nudgeCandidates, pickNudge, briefing,
  OWN_TASK_RE,
  deadlineAlerts, deadlineNotification, breakEndText, LEVEL_FACTOR,
} from './engine.js';
import { fetchSnapshot, addTask, closeTask, deleteTask, taskUrl, syncCommands } from './todoist.js';
import { topFor, dayId, breakUsedToday, breakOptions, inShutdownWindow, isReviewTime, weekId, doneToday } from './daily.js';
import { say } from './voice.js';
import { fmtDuration as fmtDur } from './tracking.js';
import { buildCreateCommands, buildReorderCommand, siblingsOf } from './taskform.js';
import { focusMinutes, prune, partialTitle, taskWork } from './tracking.js';
import { aiWord } from './ai.js';

// Bump when pages start sending new message types, so a page can spot a stale background.
const PROTOCOL = 5;
const TICK_MIN = 5;          // activity sampling interval
const SYNC_MIN = 15;         // Todoist refresh interval
const IDLE_SECONDS = 300;    // no input for 5 min = away

// ---------- storage helpers ----------

const local = chrome.storage.local;
async function load(key, fallback) {
  const r = await local.get(key);
  return r[key] ?? fallback;
}
const save = (obj) => local.set(obj);

async function getSettings() {
  return { ...DEFAULT_SETTINGS, ...(await load('settings', {})) };
}

// ---------- data ----------

async function refresh({ force = false } = {}) {
  const settings = await getSettings();
  const cached = await load('snapshot', null);
  if (!force && cached && Date.now() - cached.fetchedAt < 2 * 60000) return cached;
  if (!settings.token) return cached;
  try {
    const snap = await fetchSnapshot(settings.token);
    await save({ snapshot: snap, lastError: null });
    return snap;
  } catch (e) {
    await save({ lastError: { message: e.message, at: Date.now() } });
    return cached;
  }
}

async function getTop3() {
  try { return topFor((await chrome.storage.sync.get('top3')).top3 || {}); } catch { return []; }
}

async function currentState(opts) {
  const snap = await refresh(opts);
  if (!snap) return null;
  return computeState({ ...snap, top3: await getTop3() }, await getSettings());
}

// ---------- notifications ----------

const KIND_SETTING = { nudge: 'notifyNudges', briefing: 'notifyBriefing', deadline: 'notifyDeadlines', shutdown: 'notifyShutdown', review: 'notifyReview' };

async function notify({ title, body, taskId, kind = 'nudge', sticky = false, force = false }) {
  const key = KIND_SETTING[kind];
  if (key && !force && (await getSettings())[key] === false) return; // switched off in Settings
  const id = `${kind}-${Date.now()}`;
  const buttons = taskId ? [{ title: 'Open in Todoist' }, { title: 'Snooze 2h' }] : [{ title: 'Snooze 2h' }];
  await chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: 'icons/128.png',
    title,
    message: body,
    priority: sticky ? 2 : 0,
    requireInteraction: sticky,
    buttons,
  });
  const map = await load('notifMap', {});
  map[id] = { taskId: taskId || null };
  const keys = Object.keys(map);
  if (keys.length > 30) for (const k of keys.slice(0, keys.length - 30)) delete map[k];
  await save({ notifMap: map });
}

chrome.notifications.onClicked.addListener(async (id) => {
  chrome.notifications.clear(id);
  const win = await chrome.windows.getLastFocused().catch(() => null);
  await chrome.tabs.create(win ? { windowId: win.id } : {}); // no url = your new tab page
});

chrome.notifications.onButtonClicked.addListener(async (id, idx) => {
  chrome.notifications.clear(id);
  const { taskId } = (await load('notifMap', {}))[id] || {};
  const isSnooze = taskId ? idx === 1 : idx === 0;
  if (isSnooze) {
    await save({ snoozeUntil: Date.now() + 2 * HOUR });
  } else if (taskId) {
    await chrome.tabs.create({ url: taskUrl(taskId) });
  }
});

// ---------- nudges ----------

async function sendNudge({ ignoreHistory = false } = {}) {
  const state = await currentState();
  if (!state) return null;
  const cands = nudgeCandidates(state);
  const history = await load('history', []);
  const pick = ignoreHistory ? cands[0] : pickNudge(cands, history);
  if (!pick) return null;
  const worded = await aiWord(state.settings, state, cands, 'nudge', pick);
  await notify({ title: worded.title, body: worded.body, taskId: pick.taskId, force: ignoreHistory });
  history.push({ key: pick.key, areaId: pick.areaId, at: Date.now() });
  await save({ history: history.slice(-50), currentNudge: { ...worded, at: Date.now() } });
  return worded;
}

async function sessionStart(reason) {
  const last = await load('lastBriefingAt', 0);
  if (Date.now() - last < 30 * 60000) return; // startup + return-from-idle can both fire
  await save({ lastBriefingAt: Date.now() });
  const state = await currentState({ force: true });
  if (!state) return;
  const lastSessionAt = await load('lastSessionAt', null);
  const b = briefing(state, lastSessionAt);
  if (!state.top3.length) { b.lines.push('Pick your Top 3 for today on the new tab.'); b.body = b.lines.join(' '); }
  const cands = nudgeCandidates(state);
  const worded = await aiWord(state.settings, state, cands, 'briefing', { title: b.title, body: b.body, taskId: b.best?.taskId });
  await notify({ title: worded.title, body: worded.body, taskId: b.best?.taskId, kind: 'briefing', force: reason === 'test' });
  // The briefing already named today's and tomorrow's deadlines; don't repeat them five minutes later.
  const mentioned = deadlineAlerts(state, await load('deadlineSent', {})).filter((a) => a.info.daysLeft <= 1).slice(0, 3);
  await markSent(mentioned.map((a) => a.key));
  await save({
    lastSessionAt: Date.now(),
    activeMinutes: 0,
    lastBriefing: { title: worded.title, lines: b.lines, body: worded.body, at: Date.now(), reason },
  });
}

// ---------- break blocks ----------

async function startBreak(minutes) {
  // Daily budget: once it's used up, only short breaks.
  const { breakBudgetMin } = await getSettings();
  const opts = breakOptions(breakBudgetMin, breakUsedToday(await load('breakLog', [])));
  if (!opts.options.includes(minutes)) minutes = Math.min(minutes, Math.max(...opts.options));
  const until = Date.now() + minutes * 60000;
  const log = prune(await load('breakLog', []));
  log.push({ at: Date.now(), minutes });
  await save({ breakBlock: { startedAt: Date.now(), until, minutes }, breakLog: log });
  await chrome.alarms.create('breakEnd', { when: until });
  return minutes;
}

async function endBreak({ early = false } = {}) {
  const block = await load('breakBlock', null);
  await chrome.alarms.clear('breakEnd');
  await save({ breakBlock: null, activeMinutes: 0 });
  if (block && early) {
    // Count only the time actually taken.
    const log = await load('breakLog', []);
    const entry = [...log].reverse().find((b) => Math.abs(b.at - block.startedAt) < 5000 && b.actualMinutes == null);
    if (entry) {
      entry.actualMinutes = Math.max(0, Math.round((Date.now() - block.startedAt) / 60000));
      entry.endedAt = Date.now();
      await save({ breakLog: log });
    }
  }
  if (!block || early) return;
  const state = await currentState({ force: true });
  const txt = breakEndText(state, block.minutes);
  await notify({ kind: 'break', sticky: true, title: txt.title, body: txt.body, taskId: txt.taskId });
}

// ---------- deadlines ----------

async function markSent(keys) {
  const sent = await load('deadlineSent', {});
  for (const k of keys) sent[k] = Date.now();
  for (const [k, at] of Object.entries(sent)) if (Date.now() - at > 45 * DAY) delete sent[k];
  await save({ deadlineSent: sent });
}

// Runs on every active tick. Ignores the nudge cadence and snooze: deadlines always get through.
async function checkDeadlines() {
  const state = await currentState();
  if (!state) return;
  const alerts = deadlineAlerts(state, await load('deadlineSent', {}));
  if (!alerts.length) return;
  const n = deadlineNotification(state, alerts);
  const urgent = alerts.some((a) => a.stage === 'overdue' || a.stage === 'today');
  await notify({ kind: 'deadline', sticky: urgent, title: n.title, body: n.body, taskId: n.taskId });
  await markSent(alerts.map((a) => a.key));
}

// ---------- old phone reminder tasks ----------

// Older versions added "X: 4 days without progress" tasks to the Todoist Inbox. Delete any still open, once.
async function deleteOldReminderTasks() {
  if (await load('removedReminderTasks', false)) return;
  const settings = await getSettings();
  if (!settings.token) return;
  const snap = await refresh({ force: true });
  if (!snap) return;
  const recorded = new Set(Object.values(await load('phoneTasks', {})).map((c) => String(c.taskId)));
  const inbox = new Set((snap.projects || []).filter((p) => p.inbox_project).map((p) => p.id));
  const mine = (snap.tasks || []).filter((t) => recorded.has(String(t.id)) || (inbox.has(t.project_id) && OWN_TASK_RE.test(t.content)));
  for (const t of mine) { try { await deleteTask(settings.token, t.id); } catch {} }
  await save({ removedReminderTasks: true, phoneTasks: {} });
  if (mine.length) await refresh({ force: true });
}

// ---------- activity ----------

async function tick() {
  const state = await chrome.idle.queryState(IDLE_SECONDS);
  if (state !== 'active') return;
  await save({ lastActiveAt: Date.now() });
  if (await load('breakBlock', null)) return;
  await checkDeadlines();
  await checkShutdown();
  await checkReview();
  if (await load('focus', null)) return; // no nudges while you're focusing
  if ((await load('snoozeUntil', 0)) > Date.now()) return;
  const settings = await getSettings();
  // Ease off on a good day: 3 done doubles the gap, 5 done stops regular nudges (deadlines still come).
  const st = await currentState();
  const doneN = st ? doneToday(st).length : 0;
  if (doneN >= 5) return;
  if (settings.notifyNudges === false) return;
  const every = settings.nudgeEveryActiveMinutes * (LEVEL_FACTOR[settings.notifyLevel] || 1) * (doneN >= 3 ? 2 : 1);
  const active = (await load('activeMinutes', 0)) + TICK_MIN;
  if (active >= every) {
    const sent = await sendNudge();
    await save({ activeMinutes: sent ? 0 : active - 30 }); // nothing to say: try again in 30 active min
  } else {
    await save({ activeMinutes: active });
  }
}

chrome.idle.onStateChanged.addListener(async (s) => {
  if (s !== 'active') return;
  const lastActiveAt = await load('lastActiveAt', Date.now());
  const settings = await getSettings();
  if (Date.now() - lastActiveAt >= settings.newSessionGapHours * HOUR) await sessionStart('return');
  await save({ lastActiveAt: Date.now() });
});

// ---------- distraction pause ----------

function hostMatches(host, sites) {
  host = host.replace(/^www\./, '').toLowerCase();
  return sites.some((s) => {
    s = s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    return s && (host === s || host.endsWith('.' + s));
  });
}

// A single reddit post (from a web search, say) opens freely; the front page and subreddit feeds pause.
function isRedditPost(url) {
  if (!/(^|\.)reddit\.com$/.test(url.hostname)) return false;
  return /^\/(r\/[^/]+\/)?(comments|s)\/|^\/gallery\//.test(url.pathname);
}

async function maybePause(d) {
  if (d.frameId !== 0 || !/^https?:/.test(d.url)) return;
  const { blockedSites } = await getSettings();
  let url;
  try { url = new URL(d.url); } catch { return; }
  if (!hostMatches(url.hostname, blockedSites)) return;
  if (isRedditPost(url)) return;
  const block = await load('breakBlock', null);
  if (block && block.until > Date.now()) return;
  chrome.tabs.update(d.tabId, { url: chrome.runtime.getURL(`pause.html?u=${encodeURIComponent(d.url)}`) });
}
chrome.webNavigation.onBeforeNavigate.addListener(maybePause);
// Reddit changes pages without reloading, so clicking from a post into its subreddit is caught here.
chrome.webNavigation.onHistoryStateUpdated.addListener(maybePause);

// ---------- lifecycle ----------

async function ensureAlarms() {
  chrome.idle.setDetectionInterval(IDLE_SECONDS);
  const have = new Set((await chrome.alarms.getAll()).map((a) => a.name));
  if (!have.has('tick')) chrome.alarms.create('tick', { periodInMinutes: TICK_MIN });
  if (!have.has('sync')) chrome.alarms.create('sync', { periodInMinutes: SYNC_MIN });
  const block = await load('breakBlock', null);
  if (block && !have.has('breakEnd')) {
    if (block.until > Date.now()) chrome.alarms.create('breakEnd', { when: block.until });
    else await endBreak();
  }
}

chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name === 'tick') await tick();
  else if (a.name === 'sync') { await refresh({ force: true }); await deleteOldReminderTasks(); }
  else if (a.name === 'breakEnd') await endBreak();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureAlarms();
  await save({ lastActiveAt: Date.now() });
  await sessionStart('startup');
});

chrome.runtime.onInstalled.addListener(async (info) => {
  await ensureAlarms();
  if (info.reason === 'update') {
    // Older versions only paused reddit: add the current defaults unless you changed the list yourself.
    // 0.4: YouTube comes off the default list.
    const saved = await load('settings', {});
    if (Array.isArray(saved.blockedSites)) {
      let sites = saved.blockedSites.join() === 'reddit.com' ? [...DEFAULT_SETTINGS.blockedSites] : saved.blockedSites;
      if (!(await load('migratedNoYoutube', false))) {
        sites = sites.filter((x) => !/(^|\.)youtube\.com$/i.test(x.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')));
        await save({ migratedNoYoutube: true });
      }
      await save({ settings: { ...saved, blockedSites: sites } });
    }
  }
  if (info.reason === 'install') {
    await save({ installedAt: Date.now() });
    chrome.runtime.openOptionsPage();
  }
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

// ---------- creating tasks from the new tab ----------

async function createTask(form) {
  const settings = await getSettings();
  if (!settings.token) throw new Error('Connect Todoist in Settings first');
  const snapshot = await load('snapshot', null);
  const uuid = () => crypto.randomUUID();
  const { commands, taskTemp, sectionTemp } = buildCreateCommands(form, uuid);
  const res = await syncCommands(settings.token, commands);
  const map = res.temp_id_mapping || {};
  const taskId = map[taskTemp];

  if (form.nextStep && taskId) {
    const siblings = siblingsOf(snapshot, form.target);
    if (siblings.length) await syncCommands(settings.token, [buildReorderCommand(taskId, siblings, uuid)]);
  }

  // A new project you made here should be watched. Auto mode picks it up by itself;
  // a hand-picked list needs it added.
  if (sectionTemp && map[sectionTemp] && settings.trackedAreaIds?.length) {
    const saved = await load('settings', {});
    await save({ settings: { ...saved, trackedAreaIds: [...settings.trackedAreaIds, `s:${map[sectionTemp]}`] } });
  }

  await refresh({ force: true });
  return { ok: true, taskId, sectionId: sectionTemp ? map[sectionTemp] : null };
}

// ---------- end of day & weekly review ----------

function plusMinutes(hhmm, add) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = (h * 60 + m + add + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

async function daySummary(state) {
  const done = state ? doneToday(state).length : 0;
  const start = Date.now() - 20 * 3600000;
  const log = await load('focusLog', []);
  const focus = [...log, ...taskWork(state?.done || [], log)].filter((f) => f.at >= start).reduce((s, f) => s + f.minutes, 0);
  const parts = [`${done} done today`];
  if (focus) parts.push(`about ${fmtDur(focus)} of work`);
  return parts.join(', ') + '.';
}

async function checkShutdown() {
  const { shutdownTime } = await getSettings();
  // inShutdownWindow opens 30 min early for the card; the notification waits for the exact time.
  if (!inShutdownWindow(plusMinutes(shutdownTime, 30))) return;
  const today = dayId();
  if ((await load('shutdownNotified', null)) === today || (await load('shutdownDone', null)) === today) return;
  await save({ shutdownNotified: today });
  const state = await currentState();
  const txt = say('shutdown', { summary: await daySummary(state) }, today);
  await notify({ kind: 'shutdown', sticky: true, title: txt.title, body: txt.body });
}

async function checkReview() {
  const { reviewTime } = await getSettings();
  if (!isReviewTime(reviewTime)) return;
  const week = weekId();
  if ((await load('reviewedWeek', null)) === week || (await load('reviewNotified', null)) === week) return;
  await save({ reviewNotified: week });
  const state = await currentState();
  const log = await load('focusLog', []);
  const focus = [...log, ...taskWork(state?.done || [], log)].filter((f) => f.at >= Date.now() - 7 * DAY).reduce((s, f) => s + f.minutes, 0);
  const done = state ? state.done.filter((t) => Date.now() - new Date(t.completed_at) < 7 * DAY).length : 0;
  const txt = say('review', { summary: `${done} done this week${focus ? `, about ${fmtDur(focus)} of work` : ''}.` }, week);
  await notify({ kind: 'review', sticky: true, title: txt.title, body: txt.body });
}

async function nextMorning() {
  const d = new Date();
  if (d.getHours() >= 4) d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d.getTime();
}

// ---------- focus timer ----------
// One timer at a time. Time only counts when it ends in something completed:
// the task itself, or a completed subtask describing the part you did.

async function logFocus(entry) {
  const log = prune(await load('focusLog', []));
  log.push(entry);
  await save({ focusLog: log });
}

async function focusStart({ taskId, title, area }) {
  const cur = await load('focus', null);
  if (cur) throw new Error(`Already focusing on "${cur.title}". Finish or stop it first.`);
  const focus = { taskId, title, area: area || null, startedAt: Date.now() };
  await save({ focus });
  return { ok: true, focus };
}

async function focusDone() {
  const f = await load('focus', null);
  if (!f) throw new Error('No focus session running');
  const { token } = await getSettings();
  await closeTask(token, f.taskId);
  const minutes = focusMinutes(f.startedAt);
  await logFocus({ at: Date.now(), minutes, taskId: f.taskId, title: f.title, outcome: 'done' });
  await save({ focus: null });
  await refresh({ force: true });
  return { ok: true, minutes };
}

async function focusStop({ note, discard }) {
  const f = await load('focus', null);
  if (!f) throw new Error('No focus session running');
  const minutes = focusMinutes(f.startedAt);
  if (discard) { await save({ focus: null }); return { ok: true, minutes: 0 }; }
  const { token } = await getSettings();
  const sub = await addTask(token, { content: partialTitle(note, minutes), parent_id: f.taskId, description: `Focus session, ${minutes} min.` });
  await closeTask(token, sub.id);
  await logFocus({ at: Date.now(), minutes, taskId: f.taskId, subtaskId: sub.id, title: f.title, outcome: 'partial' });
  await save({ focus: null });
  await refresh({ force: true });
  return { ok: true, minutes };
}

// ---------- messages from pages ----------

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  (async () => {
    switch (msg.type) {
      case 'getData': {
        const snapshot = await refresh({ force: !!msg.force });
        const [settings, breakBlock, currentNudge, lastBriefing, lastError, focus, focusLog, breakLog] = await Promise.all([
          getSettings(), load('breakBlock', null), load('currentNudge', null), load('lastBriefing', null), load('lastError', null),
          load('focus', null), load('focusLog', []), load('breakLog', []),
        ]);
        const [shutdownDone, reviewedWeek, twoMinShownAt] = await Promise.all([load('shutdownDone', null), load('reviewedWeek', null), load('twoMinShownAt', 0)]);
        return { snapshot, settings, breakBlock, currentNudge, lastBriefing, lastError, focus, focusLog, breakLog, shutdownDone, reviewedWeek, twoMinShownAt };
      }
      case 'startBreak': return { ok: true, minutes: await startBreak(msg.minutes) };
      case 'shutdownDone': {
        await save({ shutdownDone: dayId(), snoozeUntil: await nextMorning() });
        return { ok: true };
      }
      case 'reviewDone': await save({ reviewedWeek: weekId() }); return { ok: true };
      case 'moveTask': {
        const { token } = await getSettings();
        const args = msg.sectionId ? { id: msg.taskId, section_id: msg.sectionId } : { id: msg.taskId, project_id: msg.projectId };
        await syncCommands(token, [{ type: 'item_move', uuid: crypto.randomUUID(), args }]);
        await refresh({ force: true });
        return { ok: true };
      }
      case 'deleteTask': {
        const { token } = await getSettings();
        await deleteTask(token, msg.taskId);
        await refresh({ force: true });
        return { ok: true };
      }
      case 'endBreak': await endBreak({ early: true }); return { ok: true };
      case 'complete': {
        // Ticking off the task you're focusing on counts as finishing the session.
        const f = await load('focus', null);
        if (f && f.taskId === msg.taskId) return await focusDone();
        const { token } = await getSettings();
        await closeTask(token, msg.taskId);
        await refresh({ force: true });
        return { ok: true };
      }
      case 'hello': return { protocol: PROTOCOL };
      case 'focusStart': return await focusStart(msg);
      case 'focusDone': return await focusDone();
      case 'focusStop': return await focusStop(msg);
      case 'createTask': return await createTask(msg.form);
      case 'saveSettings': {
        await save({ settings: { ...(await load('settings', {})), ...msg.settings } });
        if (msg.settings.token !== undefined) await refresh({ force: true });
        return { ok: true };
      }
      case 'testNudge': return { nudge: await sendNudge({ ignoreHistory: true }) };
      case 'testBriefing': await save({ lastBriefingAt: 0 }); await sessionStart('test'); return { ok: true };
      default: return { error: 'unknown message' };
    }
  })().then(reply, (e) => reply({ error: e.message }));
  return true;
});
