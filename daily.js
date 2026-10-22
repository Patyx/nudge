// Daily rhythm: Top 3, done today, streaks, break budget, two-minute tasks,
// end-of-day shutdown and the weekly review. Pure functions.
import { taskInArea, minutesFromLabels, cleanTitle } from './engine.js';
import { breakMinutes } from './tracking.js';

const DAY = 86400000;
// A day runs 04:00 to 04:00 by default, so midnight work still counts as "today". Settings can move it.
export let DAY_STARTS_AT = 4;
export function setDayStart(h) { const n = Number(h); if (Number.isInteger(n) && n >= 0 && n <= 8) DAY_STARTS_AT = n; }

// ---------- logical day ----------

export function logicalDate(now = Date.now()) {
  const d = new Date(now);
  if (d.getHours() < DAY_STARTS_AT) d.setDate(d.getDate() - 1);
  d.setHours(DAY_STARTS_AT, 0, 0, 0);
  return d; // start of the logical day, local time
}

export function dayId(now = Date.now()) {
  const d = logicalDate(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function nextDayId(now = Date.now()) {
  const d = logicalDate(now);
  d.setDate(d.getDate() + 1);
  return dayId(d.getTime() + 3600000);
}

export function dayStartMs(now = Date.now()) {
  return logicalDate(now).getTime();
}

// ---------- Top 3 ----------
// stored: { [dayId]: [taskId, ...] } (keeps today and tomorrow)

export const TOP_MAX = 3;

export function topFor(stored, now = Date.now()) {
  return (stored && stored[dayId(now)]) || [];
}

export function setTop(stored, ids, day) {
  const keep = {};
  const today = dayId();
  for (const [k, v] of Object.entries(stored || {})) if (k >= today) keep[k] = v; // drop past days
  keep[day] = [...new Set(ids)].slice(0, TOP_MAX);
  return keep;
}

// Today's picks with their status. Picks deleted in Todoist simply drop out.
export function topItems(state, ids, now = Date.now()) {
  const start = dayStartMs(now);
  return ids.map((id) => {
    const open = state.open.find((t) => t.id === id);
    if (open) return { id, task: open, done: false };
    const done = state.done.find((t) => t.id === id && new Date(t.completed_at).getTime() >= start);
    if (done) return { id, task: done, done: true };
    return null;
  }).filter(Boolean);
}

// ---------- done today & streaks ----------

export function doneToday(state, now = Date.now()) {
  const start = dayStartMs(now);
  return state.done
    .filter((t) => new Date(t.completed_at).getTime() >= start)
    .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
}

// Consecutive logical days, ending today or yesterday, with at least one completion in the area.
export function areaStreak(state, area, now = Date.now()) {
  const days = new Set(state.done.filter((t) => taskInArea(t, area)).map((t) => dayId(new Date(t.completed_at).getTime())));
  if (!days.size) return 0;
  let cursor = logicalDate(now).getTime() + 3600000;
  if (!days.has(dayId(cursor))) cursor -= DAY; // today not done yet: streak can still continue from yesterday
  let n = 0;
  while (days.has(dayId(cursor))) { n++; cursor -= DAY; }
  return n;
}

// ---------- break budget ----------

export function breakUsedToday(breakLog = [], now = Date.now()) {
  const start = dayStartMs(now);
  return breakLog.filter((b) => b.at >= start).reduce((s, b) => s + breakMinutes(b, now), 0);
}

// Which break lengths to offer. Once the budget is used, only short ones.
export function breakOptions(budgetMin, usedMin, choices = [30, 60, 120, 180], fallback = 15) {
  const left = Math.max(0, budgetMin - usedMin);
  if (left < fallback) return { left, over: true, options: [fallback] };
  const fit = choices.filter((c) => c <= left);
  const opts = fit.length ? fit : [Math.max(fallback, Math.floor(left / 5) * 5)];
  return { left, over: false, options: opts };
}

// ---------- two-minute rule ----------

export function twoMinuteTask(state, lastShownAt = 0, now = Date.now(), skip = []) {
  if (now - lastShownAt < 3600000) return null;
  const list = state.open.filter((t) => {
    const m = minutesFromLabels(t.labels);
    return m != null && m <= 2 && !skip.includes(t.id);
  });
  return list.sort((a, b) => new Date(a.added_at || 0) - new Date(b.added_at || 0))[0] || null;
}

// ---------- shutdown ----------

// "HH:MM" → minutes after midnight
function hm(s) { const [h, m] = String(s || '00:00').split(':').map(Number); return (h || 0) * 60 + (m || 0); }

// Card shows from 30 minutes before shutdown until 04:00 (the logical day's end), if not done yet.
export function inShutdownWindow(shutdownTime, now = Date.now()) {
  const d = new Date(now);
  const mins = d.getHours() * 60 + d.getMinutes();
  let start = hm(shutdownTime) - 30;
  const end = DAY_STARTS_AT * 60;
  // Express everything as minutes since 04:00, so the window can cross midnight.
  const rel = (x) => ((x - end) % 1440 + 1440) % 1440;
  start = rel(start);
  return rel(mins) >= start;
}

// ---------- weekly review ----------

export function weekId(now = Date.now()) {
  const d = logicalDate(now);
  const dow = (d.getDay() + 6) % 7; // Monday 0
  d.setDate(d.getDate() - dow);
  return dayId(d.getTime() + 3600000);
}

// Sunday from the given time onward counts as review time.
export function isReviewTime(reviewTime, now = Date.now()) {
  const d = new Date(now);
  const ld = logicalDate(now);
  if (ld.getDay() !== 0) return false;
  if (d.getDay() === 1) return true; // after midnight, still Sunday's logical day
  return d.getHours() * 60 + d.getMinutes() >= hm(reviewTime);
}

export function reviewData(state, settings, focusLog = [], breakLog = [], now = Date.now()) {
  const weekStart = now - 7 * DAY;
  const done = state.done.filter((t) => new Date(t.completed_at).getTime() >= weekStart);
  const inbox = state.open.filter((t) => {
    const p = state.projects?.find((x) => x.id === t.project_id);
    return p?.inbox_project && !t.parent_id;
  });
  const byArea = state.areas.filter((a) => a.tracked).map((a) => ({
    area: a,
    done: done.filter((t) => taskInArea(t, a)).length,
  }));
  const stuck = state.areas
    .filter((a) => a.tracked && a.next && a.nextAgeDays >= settings.actionStaleDays)
    .map((a) => ({ area: a, task: a.next, age: Math.floor(a.nextAgeDays) }));
  const focus = focusLog.filter((f) => f.at >= weekStart).reduce((s, f) => s + f.minutes, 0);
  const brk = breakLog.filter((b) => b.at >= weekStart).reduce((s, b) => s + breakMinutes(b, now), 0);
  return { done, inbox, byArea, stuck, focus, brk, title: (t) => cleanTitle(t.content) };
}
