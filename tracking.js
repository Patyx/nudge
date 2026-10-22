// Focus and break time. Pure functions so the maths can be tested.
import { minutesFromLabels } from './engine.js';

export const UNLABELED_TASK_MIN = 30;

// Tasks finished without the focus timer count their estimate (30m if unlabeled).
// Anything the timer already counted (the task itself, or a "worked on it" subtask) is skipped.
export function taskWork(done = [], focusLog = []) {
  const seen = new Set(focusLog.flatMap((f) => [f.taskId, f.subtaskId]).filter(Boolean).map(String));
  return done
    .filter((t) => !seen.has(String(t.id)) && !seen.has(String(t.task_id)))
    .map((t) => ({ at: new Date(t.completed_at).getTime(), minutes: minutesFromLabels(t.labels) ?? UNLABELED_TASK_MIN }));
}
//
// focusLog: [{ at, minutes, taskId, title, outcome: 'done' | 'partial' }]   at = when it ended
// breakLog: [{ at, minutes, endedAt?, actualMinutes? }]                     at = when it started

export const MAX_FOCUS_MIN = 240; // a timer left running overnight shouldn't count as 14 hours

export function focusMinutes(startedAt, now = Date.now()) {
  const m = Math.round((now - startedAt) / 60000);
  return Math.max(1, Math.min(MAX_FOCUS_MIN, m));
}

export function breakMinutes(b, now = Date.now()) {
  if (b.actualMinutes != null) return b.actualMinutes;
  const elapsed = Math.max(0, Math.round((now - b.at) / 60000));
  return Math.min(b.minutes, elapsed);
}

function dayStart(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Last 7 calendar days including today, oldest first.
// done: completed Todoist tasks; those not timed count their estimate as work.
export function stats7(focusLog = [], breakLog = [], now = Date.now(), done = []) {
  const today = dayStart(now);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const start = d.getTime();
    const next = new Date(d); next.setDate(next.getDate() + 1);
    days.push({
      start,
      label: i === 0 ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short' }),
      date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      focus: 0, brk: 0, done: 0,
      end: next.getTime(),
    });
  }
  const dayOf = (ms) => days.find((x) => ms >= x.start && ms < x.end);
  for (const f of focusLog) {
    const d = dayOf(f.at);
    if (!d) continue;
    d.focus += f.minutes;
    if (f.outcome === 'done') d.done += 1;
  }
  for (const w of taskWork(done, focusLog)) {
    const d = dayOf(w.at);
    if (!d) continue;
    d.focus += w.minutes;
    d.done += 1;
  }
  for (const b of breakLog) {
    const d = dayOf(b.at);
    if (d) d.brk += breakMinutes(b, now);
  }
  const total = days.reduce((a, d) => ({ focus: a.focus + d.focus, brk: a.brk + d.brk, done: a.done + d.done }), { focus: 0, brk: 0, done: 0 });
  return { days, total };
}

export function fmtDuration(min) {
  min = Math.round(min);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function prune(log, now = Date.now(), keepDays = 60) {
  return log.filter((x) => now - x.at < keepDays * 86400000);
}

// What the partial-work subtask is called when you leave the note empty.
export function partialTitle(note, minutes) {
  const n = (note || '').trim();
  return n || `Worked on it for ${fmtDuration(minutes)}`;
}
