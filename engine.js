// Nudge engine: pure functions, no chrome.* calls, so it can be unit-tested in Node.
// Input data uses Todoist API v1 field names (snake_case).
import { say, rngFrom } from './voice.js';

export const DAY = 86400000;
export const HOUR = 3600000;

export const DEFAULT_SETTINGS = {
  token: '',
  // Feeds that open the pause screen first. Fully editable in Settings; YouTube is left off on purpose (people learn there).
  blockedSites: ['reddit.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'x.com', 'twitter.com', 'threads.net', 'pinterest.com', '9gag.com', 'twitch.tv'],
  projectStaleDays: 4,
  actionStaleDays: 7,
  nudgeEveryActiveMinutes: 150,
  newSessionGapHours: 6,
  trackedAreaIds: null, // null = automatic
  aiEnabled: false,
  anthropicKey: '',
  aiModel: 'claude-haiku-5-5',
  breakBudgetMin: 180,
  shutdownTime: '00:00',
  reviewTime: '21:00',
  notifyLevel: 'normal', // quiet | normal | chatty: how often regular nudges come
  notifyNudges: true,
  notifyBriefing: false,
  notifyDeadlines: true,
  notifyShutdown: true,
  notifyReview: true,
  farOffDays: 14, // tasks dated further out are notes: no nudges until they come closer
  onHoldAreaIds: [], // projects paused on purpose: no quiet nudges, shown as "on hold"
  dayStartHour: 4,
  goldenCount: 4,
  showPraise: true,
  // parts of the new tab that can be hidden
  showWeather: true, showTip: true, showNote: true, showSites: true, showMusic: true,
  showChart: true, showDoneToday: true, showFits: true, showShutdown: true,
};

export const LEVEL_FACTOR = { quiet: 2, normal: 1, chatty: 0.5 };

const LEISURE_RE = /\b(fun|watch|play|games?|movies?|books?|leisure)\b/i;

// ---------- small helpers ----------

export function minutesFromLabels(labels = []) {
  for (const l of labels) {
    const m = /^(\d+(?:\.\d+)?)\s*(m|min|mins|h|hr|hrs)$/i.exec(l.trim());
    if (m) return Math.round(parseFloat(m[1]) * (m[2].toLowerCase().startsWith('h') ? 60 : 1));
  }
  return null;
}

export function isLowEnergy(labels = []) {
  return labels.some((l) => /^(low|low[-_ ]?energy|easy)$/i.test(l.trim()));
}

export function fmtMinutes(min) {
  if (min == null) return '';
  if (min < 60) return `${min}m`;
  const h = min / 60;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}

export function fmtDays(d) {
  const n = Math.floor(d);
  if (n <= 0) return 'today';
  if (n === 1) return '1 day';
  return `${n} days`;
}

function ts(s) {
  return s ? new Date(s).getTime() : null;
}

function short(s, n = 60) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

// Strip Todoist markdown links and leading "* " (uncompletable) from task titles.
export function cleanTitle(s = '') {
  return s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/^\*\s+/, '').trim();
}

// ---------- areas ----------

// An "area" is what you'd call a project in conversation: a Todoist section
// (e.g. "Satellite" inside "Big Projects") or a project with no sections.
export function buildAreas({ projects = [], sections = [] }) {
  const areas = [];
  for (const p of projects) {
    if (p.inbox_project || p.is_archived || p.is_deleted) continue;
    const secs = sections
      .filter((s) => s.project_id === p.id && !s.is_archived && !s.is_deleted)
      .sort((a, b) => (a.section_order ?? 0) - (b.section_order ?? 0));
    if (secs.length) {
      for (const s of secs) {
        areas.push({
          id: `s:${s.id}`,
          kind: 'section',
          sectionId: s.id,
          projectId: p.id,
          name: s.name,
          projectName: p.name,
          createdAt: ts(s.added_at) ?? ts(p.created_at),
        });
      }
    } else {
      areas.push({
        id: `p:${p.id}`,
        kind: 'project',
        projectId: p.id,
        name: p.name,
        projectName: p.name,
        createdAt: ts(p.created_at),
      });
    }
  }
  return areas;
}

export function autoTrackedIds(areas) {
  const proj = areas.filter((a) => /project/i.test(a.projectName));
  if (proj.length) return proj.map((a) => a.id);
  return areas.filter((a) => !LEISURE_RE.test(a.projectName) && !LEISURE_RE.test(a.name)).map((a) => a.id);
}

export function isLeisure(area) {
  return LEISURE_RE.test(area.projectName) || LEISURE_RE.test(area.name);
}

export function taskInArea(task, area) {
  if (area.kind === 'section') return task.section_id === area.sectionId;
  return task.project_id === area.projectId;
}

// ---------- state ----------

// Builds everything the UI and the nudges need from one Todoist snapshot.
export function computeState(data, settings, now = Date.now()) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const areas = buildAreas(data);
  const trackedIds = new Set(s.trackedAreaIds?.length ? s.trackedAreaIds : autoTrackedIds(areas));
  const open = (data.tasks || []).filter((t) => !t.checked && !t.is_deleted);
  const done = data.completed || [];
  const lookbackDays = data.completedLookbackDays ?? 30;

  const areaStates = areas.map((a) => {
    const openIn = open.filter((t) => taskInArea(t, a));
    const topLevel = openIn
      .filter((t) => !t.parent_id || !openIn.some((p) => p.id === t.parent_id))
      .sort((x, y) => (x.child_order ?? 0) - (y.child_order ?? 0));
    const doneIn = done.filter((t) => taskInArea(t, a));
    const lastDone = doneIn.reduce((m, t) => Math.max(m, ts(t.completed_at) || 0), 0) || null;
    const quietSince = lastDone ?? Math.max(a.createdAt ?? 0, now - lookbackDays * DAY);
    const daysQuiet = Math.max(0, (now - quietSince) / DAY);
    const doneLast24h = doneIn.filter((t) => now - ts(t.completed_at) < DAY).length;
    const next = topLevel[0] || null;
    return {
      ...a,
      tracked: trackedIds.has(a.id),
      onHold: (s.onHoldAreaIds || []).includes(a.id),
      leisure: isLeisure(a),
      openCount: openIn.length,
      next,
      nextActions: topLevel.slice(0, 3),
      lastDone,
      daysQuiet,
      quietIsLowerBound: !lastDone,
      doneLast24h,
      stale: trackedIds.has(a.id) && !(s.onHoldAreaIds || []).includes(a.id) && daysQuiet >= s.projectStaleDays,
      nextAgeDays: next?.added_at ? (now - ts(next.added_at)) / DAY : 0,
    };
  });

  return { areas: areaStates, open, done, settings: s, now, projects: data.projects || [], top3: data.top3 || [] };
}

// Tasks that fit in the time you have. Untagged tasks are left out on purpose:
// the point is to trust the estimate, so only estimated tasks qualify.
export function fitsIn(state, minutes, limit = 5) {
  const areaOf = (t) => state.areas.find((a) => taskInArea(t, a));
  return state.open
    .map((t) => ({ t, min: minutesFromLabels(t.labels), area: areaOf(t) }))
    .filter((x) => x.min != null && x.min <= minutes && x.area && !x.area.leisure)
    .sort((a, b) => {
      const sa = (a.area.stale ? 2 : 0) + (a.area.tracked ? 1 : 0);
      const sb = (b.area.stale ? 2 : 0) + (b.area.tracked ? 1 : 0);
      return sb - sa || b.min - a.min;
    })
    .slice(0, limit);
}

function tag(t) {
  const m = minutesFromLabels(t.labels);
  return m ? ` (${fmtMinutes(m)})` : '';
}

export function dayKey(now) {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function areaOfTask(state, t) {
  return state.areas.find((a) => taskInArea(t, a)) || null;
}

// Reminder tasks older versions created in your Inbox; ignored everywhere and deleted on update.
export const OWN_TASK_RE = /: (\d+\+? days without progress|no next step)/;

function taskVars(state, t, extra = {}) {
  const area = t ? areaOfTask(state, t) : null;
  const min = t ? minutesFromLabels(t.labels) : null;
  return {
    task: t ? short(cleanTitle(t.content), 48) : '',
    est: t ? tag(t) : '',
    estRaw: min ? fmtMinutes(min) : '',
    where: area ? area.name : 'Inbox',
    area: area ? area.name : 'Inbox',
    age: t?.added_at ? Math.max(1, Math.floor((state.now - ts(t.added_at)) / DAY)) : 'a few',
    ...extra,
  };
}

// ---------- deadlines ----------

function localMidnight(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// The deadline field wins (Todoist Pro); otherwise a non-recurring due date counts.
// Label a task "soft" to keep its due date out of deadline reminders.
export function deadlineInfo(task, now = Date.now()) {
  if ((task.labels || []).some((l) => /^soft$/i.test(l.trim()))) return null;
  let raw = task.deadline?.date || null;
  let source = 'deadline';
  if (!raw && task.due && !task.due.is_recurring) {
    raw = task.due.datetime || task.due.date;
    source = 'due';
  }
  if (!raw) return null;
  const hasTime = /T\d\d:\d\d/.test(raw);
  const at = hasTime ? new Date(raw).getTime() : new Date(`${raw.slice(0, 10)}T00:00:00`).getTime();
  if (Number.isNaN(at)) return null;
  const daysLeft = Math.round((localMidnight(at) - localMidnight(now)) / DAY);
  const time = hasTime ? new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  return { at, daysLeft, hasTime, time, source, dateStr: raw.slice(0, 10) };
}

export function deadlineStage(daysLeft) {
  if (daysLeft < 0) return 'overdue';
  if (daysLeft === 0) return 'today';
  if (daysLeft === 1) return '1d';
  if (daysLeft <= 3) return '3d';
  if (daysLeft <= 7) return 'week';
  return null;
}

const STAGE_KIND = { overdue: 'deadlineOverdue', today: 'deadlineToday', '1d': 'deadline1d', '3d': 'deadline3d', week: 'deadlineWeek' };
// Scores: overdue/today beat everything; project nudges are capped below them.
const STAGE_SCORE = { overdue: 5.5, today: 5, '1d': 4, '3d': 2.6, week: 1.4 };

export function whenText(daysLeft, at) {
  if (daysLeft === 0) return 'today';
  if (daysLeft === 1) return 'tomorrow';
  if (daysLeft > 1 && daysLeft < 7) return `on ${new Date(at).toLocaleDateString('en-GB', { weekday: 'long' })}`;
  return `in ${daysLeft} days`;
}

function lateText(daysLeft) {
  const n = -daysLeft;
  return n === 1 ? '1 day' : `${n} days`;
}

// Open tasks with a deadline within a week, or overdue, soonest first.
export function deadlines(state) {
  return state.open
    .filter((t) => !OWN_TASK_RE.test(t.content))
    .map((t) => ({ t, info: deadlineInfo(t, state.now) }))
    .filter((d) => d.info && deadlineStage(d.info.daysLeft))
    .map((d) => ({ ...d, stage: deadlineStage(d.info.daysLeft) }))
    .sort((a, b) => a.info.at - b.info.at);
}

function deadlineVars(d) {
  return {
    when: whenText(d.info.daysLeft, d.info.at),
    late: d.info.daysLeft < 0 ? lateText(d.info.daysLeft) : '',
    time: d.info.time ? ` at ${d.info.time}` : '',
  };
}

export function deadlineLabel(d) {
  if (d.stage === 'overdue') return `${lateText(d.info.daysLeft)} late`;
  const w = whenText(d.info.daysLeft, d.info.at);
  return (w[0].toUpperCase() + w.slice(1)) + (d.info.time ? ` ${d.info.time}` : '');
}

// Reminders not sent yet: one per stage (week, 3d, 1d, today), then daily while overdue,
// weekly once it's more than two weeks late. Moving the date resets the stages.
export function deadlineAlerts(state, sent = {}) {
  const today = dayKey(state.now);
  return deadlines(state)
    .map((d) => {
      let key;
      if (d.stage === 'overdue') {
        key = -d.info.daysLeft <= 14
          ? `${d.t.id}:overdue:${today}`
          : `${d.t.id}:overdue:w${Math.floor(state.now / (7 * DAY))}`;
      } else {
        key = `${d.t.id}:${d.stage}:${d.info.dateStr}`;
      }
      return { ...d, key };
    })
    .filter((d) => !sent[d.key]);
}

export function deadlineNotification(state, alerts) {
  if (!alerts.length) return null;
  if (alerts.length === 1) {
    const d = alerts[0];
    const txt = say(STAGE_KIND[d.stage], taskVars(state, d.t, deadlineVars(d)), `${d.key}`);
    return { ...txt, taskId: d.t.id };
  }
  const shown = alerts.slice(0, 3).map((d) => `${deadlineLabel(d)}: "${short(cleanTitle(d.t.content), 36)}"`);
  const more = alerts.length > 3 ? ` And ${alerts.length - 3} more.` : '';
  const urgent = alerts.filter((d) => d.stage === 'overdue' || d.stage === 'today').length;
  return {
    title: urgent ? `${alerts.length} deadlines, ${urgent} need you today` : `${alerts.length} deadlines coming up`,
    body: shown.join('. ') + '.' + more,
    taskId: alerts[0].t.id,
  };
}

// ---------- nudges ----------

// Every candidate carries its reason inside the wording.
// A task dated more than farOffDays ahead is a note for later, not something to nudge about.
export function isFarOff(t, now = Date.now(), days = DEFAULT_SETTINGS.farOffDays) {
  if (!t) return false;
  const raw = t.deadline?.date || t.due?.datetime || t.due?.date;
  if (!raw) return false;
  const at = new Date(/T\d\d:\d\d/.test(raw) ? raw : `${raw.slice(0, 10)}T00:00:00`).getTime();
  return !Number.isNaN(at) && at - now > days * DAY;
}

export function nudgeCandidates(state) {
  const { areas, settings: s, now } = state;
  const far = (t) => isFarOff(t, now, s.farOffDays ?? 14);
  const day = dayKey(now);
  const out = [];
  const used = new Set();
  const push = (kind, key, score, extra, vars) => {
    const txt = say(kind, vars, `${key}|${day}`);
    out.push({ key, kind, score, ...extra, ...txt });
    if (extra.taskId) used.add(extra.taskId);
  };

  // Today's Top 3 come right after urgent deadlines.
  (state.top3 || []).forEach((id, i) => {
    const t = state.open.find((x) => x.id === id);
    if (!t) return;
    push('top', `top:${id}`, 4.6 - i * 0.1, { taskId: id, areaId: areaOfTask(state, t)?.id },
      taskVars(state, t, { n: i + 1 }));
  });

  for (const d of deadlines(state)) {
    push(STAGE_KIND[d.stage], `deadline:${d.t.id}`, STAGE_SCORE[d.stage],
      { taskId: d.t.id, areaId: areaOfTask(state, d.t)?.id, deadline: d.stage },
      taskVars(state, d.t, deadlineVars(d)));
  }

  for (const a of areas) {
    if (!a.tracked || a.onHold) continue;
    const days = `${Math.floor(a.daysQuiet)}${a.quietIsLowerBound ? '+' : ''}`;

    if (a.openCount === 0 && a.daysQuiet >= s.projectStaleDays) {
      push('empty', `empty:${a.id}`, Math.min(4.5, 3 + a.daysQuiet / s.projectStaleDays / 4), { areaId: a.id }, { area: a.name, days });
      continue;
    }
    if (a.next && far(a.next)) continue; // the next step is a note for later
    if (a.stale && a.next) {
      push('stale', `stale:${a.id}`, Math.min(3.8, 2 + a.daysQuiet / s.projectStaleDays / 2), { areaId: a.id, taskId: a.next.id },
        taskVars(state, a.next, { area: a.name, days, limit: s.projectStaleDays }));
    }
    if (a.next && a.nextAgeDays >= s.actionStaleDays) {
      const min = minutesFromLabels(a.next.labels);
      const kind = min == null ? 'agingVague' : min > 60 ? 'agingBig' : 'agingPlain';
      push(kind, `aging:${a.next.id}`, Math.min(3, 1.5 + a.nextAgeDays / s.actionStaleDays / 2), { areaId: a.id, taskId: a.next.id },
        taskVars(state, a.next, { area: a.name, age: Math.floor(a.nextAgeDays) }));
    }
    if (a.doneLast24h > 0 && a.next && !a.stale) {
      push('momentum', `momentum:${a.id}`, 1.2 + 0.1 * a.doneLast24h, { areaId: a.id, taskId: a.next.id },
        taskVars(state, a.next, { area: a.name, n: a.doneLast24h }));
    }
  }

  const work = state.open.filter((t) => {
    const a = areaOfTask(state, t);
    return !(a && (a.leisure || a.onHold)) && !OWN_TASK_RE.test(t.content) && !far(t);
  });

  // Quick wins: short or low-energy tasks.
  work
    .filter((t) => { const m = minutesFromLabels(t.labels); return (m != null && m <= 15) || isLowEnergy(t.labels); })
    .slice(0, 3)
    .forEach((t) => push('quick', `quick:${t.id}`, 1, { areaId: areaOfTask(state, t)?.id, taskId: t.id }, taskVars(state, t)));

  // A random task from anywhere, so forgotten things resurface. Changes every 3 hours.
  const rng = rngFrom(`random|${day}|${Math.floor(new Date(now).getHours() / 3)}`);
  const pool = work.filter((t) => !used.has(t.id));
  if (pool.length) {
    const t = pool[Math.floor(rng() * pool.length)];
    push('random', `random:${t.id}`, 0.8 + rng() * 0.6, { areaId: areaOfTask(state, t)?.id, taskId: t.id }, taskVars(state, t));
  }

  // Evenings: something from your leisure lists instead of scrolling.
  const hour = new Date(now).getHours();
  if (hour >= 19 || hour < 2) {
    const fun = leisurePick(state, `evening|${day}`);
    if (fun) push('leisure', `leisure:${fun.id}`, 1.3, { areaId: areaOfTask(state, fun)?.id, taskId: fun.id, leisure: true }, taskVars(state, fun));
  }

  return out.sort((a, b) => b.score - a.score);
}

export function leisurePick(state, seed) {
  const fun = state.open.filter((t) => areaOfTask(state, t)?.leisure);
  if (!fun.length) return null;
  return fun[Math.floor(rngFrom(seed)() * fun.length)];
}

// Picks the best candidate that hasn't been shown recently.
// history: [{key, areaId, at}]
export function pickNudge(cands, history = [], now = Date.now()) {
  const keyCooldown = 6 * HOUR;
  const areaCooldown = 3 * HOUR;
  for (const c of cands) {
    const sameKey = history.some((h) => h.key === c.key && now - h.at < keyCooldown);
    const sameArea = history.some((h) => h.areaId && h.areaId === c.areaId && now - h.at < areaCooldown);
    if (!sameKey && !sameArea) return c;
  }
  return null;
}

export function nothingText(now = Date.now()) {
  return say('nothing', {}, dayKey(now));
}

export function breakEndText(state, minutes) {
  const dur = minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`;
  const top = state ? nudgeCandidates(state).find((c) => c.taskId && !c.leisure) : null;
  const t = top && state.open.find((x) => x.id === top.taskId);
  const seed = `${Date.now()}`; // a fresh line each break
  if (!t) return say('breakEndNoTask', { dur }, seed);
  return { ...say('breakEnd', taskVars(state, t, { dur }), seed), taskId: t.id };
}

// ---------- session briefing ----------

export function briefing(state, lastSessionAt, now = Date.now()) {
  const since = lastSessionAt || now - DAY;
  const doneSince = state.done.filter((t) => ts(t.completed_at) > since);
  const addedSince = state.open.filter((t) => ts(t.added_at) > since && !OWN_TASK_RE.test(t.content));

  const byArea = new Map();
  for (const t of doneSince) {
    const a = areaOfTask(state, t);
    const name = a ? a.name : 'Inbox';
    byArea.set(name, (byArea.get(name) || 0) + 1);
  }
  const doneTxt = [...byArea.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([n, c]) => (c > 1 ? `${n} ×${c}` : n))
    .join(', ');

  const gap = now - since;
  const gapTxt = gap < DAY ? `${Math.max(1, Math.round(gap / HOUR))}h` : fmtDays(gap / DAY);
  const stale = state.areas.filter((a) => a.stale).sort((a, b) => b.daysQuiet - a.daysQuiet);
  const dl = deadlines(state).filter((d) => d.info.daysLeft <= 1);
  const cands = nudgeCandidates(state).filter((c) => !c.leisure);
  const best = cands.find((c) => c.taskId) || cands[0] || null;

  const lines = [];
  if (dl.length) lines.push(`Deadlines: ${dl.slice(0, 3).map((d) => `"${short(cleanTitle(d.t.content), 30)}" ${deadlineLabel(d).toLowerCase()}`).join(', ')}.`);
  lines.push(doneSince.length ? `Done in the last ${gapTxt}: ${doneTxt}.` : `Nothing completed in the last ${gapTxt}.`);
  if (addedSince.length) lines.push(`${addedSince.length} new item${addedSince.length > 1 ? 's' : ''} added.`);
  if (stale.length) lines.push(`Quiet: ${stale.slice(0, 3).map((a) => `${a.name} ${Math.floor(a.daysQuiet)}d${a.quietIsLowerBound ? '+' : ''}`).join(', ')}.`);
  if (best?.taskId) {
    const t = state.open.find((x) => x.id === best.taskId);
    if (t) lines.push(`Start with: "${short(cleanTitle(t.content), 50)}"${tag(t)}.`);
  }

  const urgent = dl.filter((d) => d.info.daysLeft <= 0).length;
  const title = urgent
    ? `${urgent} deadline${urgent > 1 ? 's' : ''} today or overdue`
    : doneSince.length
      ? `${doneSince.length} done since last session`
      : stale.length ? `${stale.length} project${stale.length > 1 ? 's' : ''} need${stale.length > 1 ? '' : 's'} a push` : 'Fresh start';

  return { title, body: lines.join(' '), lines, best, doneCount: doneSince.length, staleCount: stale.length };
}

// ---------- AI prompt ----------

export function aiPayload(state, cands, mode) {
  const areas = state.areas
    .filter((a) => a.tracked)
    .map((a) => ({
      name: a.name,
      daysSinceLastCompletion: Math.floor(a.daysQuiet),
      openSteps: a.openCount,
      nextSteps: a.nextActions.map((t) => ({ title: cleanTitle(t.content), estimate: fmtMinutes(minutesFromLabels(t.labels)) || null, ageDays: Math.floor((state.now - ts(t.added_at)) / DAY) })),
      doneLast24h: a.doneLast24h,
    }));
  return {
    mode,
    localTime: new Date(state.now).toString().slice(0, 21),
    staleThresholdDays: state.settings.projectStaleDays,
    deadlines: deadlines(state).map((d) => ({ title: cleanTitle(d.t.content), when: deadlineLabel(d) })),
    areas,
    ruleBasedSuggestions: cands.slice(0, 4).map((c) => ({ kind: c.kind, title: c.title, reason: c.body })),
  };
}

export const AI_SYSTEM = `You write one short desktop notification that nudges a person back to their own projects.
Rules:
- Pick ONE concrete next step from the data. Say why it, and why now, in plain words (staleness, momentum, size).
- Calm and direct. No exclamation marks, no emoji, no praise, no guilt.
- Never invent tasks or facts not in the data.
- Reply as JSON only: {"title": "...", "body": "..."}. Title max 50 characters, body max 170 characters.
- For mode "briefing": summarise what changed since the last session (done, quiet projects) in the body, then name the best first step.`;
