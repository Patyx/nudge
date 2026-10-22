import { computeState, nudgeCandidates, fitsIn, minutesFromLabels, fmtMinutes, cleanTitle, HOUR, deadlines, deadlineLabel, nothingText, areaOfTask } from './engine.js';
import { stats7, fmtDuration, focusMinutes } from './tracking.js';
import { dayId, nextDayId, topFor, topItems, doneToday, areaStreak, twoMinuteTask, inShutdownWindow, isReviewTime, weekId, setTop } from './daily.js';
import { mountPicker, loadTop3, saveTop3 } from './today.js';
import { mountReview } from './review.js';
import { mountShortcuts } from './shortcuts.js';
import { say } from './voice.js';
import { mountSpotifyCorner } from './corner.js';
import { mountGolden } from './goldenui.js';
import { mountPostit } from './postit.js';
import { tipFor } from './wellness.js';
import { mountWeather } from './weather.js';
import { mountAddTask } from './addtask.js';

const $ = (s) => document.querySelector(s);
const send = (msg) => chrome.runtime.sendMessage(msg);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const taskUrl = (id) => `https://app.todoist.com/app/task/${encodeURIComponent(id)}`;

let data = null;
let state = null;
let skip = 0;          // "Not now" cycles through candidates
let chosenMin = null;
let top3Store = {};
let twoMinSkip = [];

$('#date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

async function load(force = false) {
  data = await send({ type: 'getData', force });
  top3Store = await loadTop3();
  state = data.snapshot ? computeState({ ...data.snapshot, top3: topFor(top3Store) }, data.settings) : null;
  render();
}

const PLAY = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M4 2.6v10.8a.6.6 0 0 0 .9.5l8.6-5.4a.6.6 0 0 0 0-1L4.9 2.1a.6.6 0 0 0-.9.5"/></svg>';
function playBtn(t) {
  if (data?.focus) return '';
  const title = cleanTitle(t.content);
  return `<button class="play" data-focus="${esc(t.id)}" title="Start focus timer" aria-label="Start focus on “${esc(title)}”">${PLAY}</button>`;
}
function wirePlay(el) {
  el.querySelectorAll('[data-focus]').forEach((b) => (b.onclick = () => startFocus(b.dataset.focus)));
}

function heroCandidate() {
  const cands = nudgeCandidates(state);
  const cur = data.currentNudge;
  const curValid = cur && Date.now() - cur.at < 3 * HOUR && (!cur.taskId || state.open.some((t) => t.id === cur.taskId));
  const list = curValid ? [cur, ...cands.filter((c) => c.key !== cur.key)] : cands;
  return list.length ? list[skip % list.length] : null;
}

// Today's tally leads the centre once anything is done.
function praiseHtml() {
  const list = doneToday(state);
  if (!list.length) return '';
  const n = list.length;
  const kind = n >= 5 ? 'praise5' : n >= 3 ? 'praise3' : n === 2 ? 'praise2' : 'praise1';
  const p = say(kind, { n, last: cleanTitle(list[0].content) }, `${dayId()}|${n}`);
  const recent = list.slice(0, 3).map((t) => `<li>${esc(cleanTitle(t.content))}</li>`).join('');
  return `<h1 class="praise-title">${esc(p.title)}</h1><p class="praise-body">${esc(p.body)}</p><ul class="praise-list">${recent}${n > 3 ? `<li class="more">and ${n - 3} more</li>` : ''}</ul>`;
}

function renderNudge() {
  const el = $('#nudge');
  if (!data.settings.token) {
    el.innerHTML = `<h1>Connect Todoist to start.</h1>
      <p>Paste your Todoist API token in settings. Everything else works from your existing projects.</p>
      <div class="actions"><button class="btn solid" id="opts">Open settings</button></div>`;
    $('#opts').onclick = () => chrome.runtime.openOptionsPage();
    return;
  }
  if (!state) {
    el.innerHTML = `<h1>Loading your projects…</h1>`;
    return;
  }
  const c = heroCandidate();
  const praise = praiseHtml();
  el.classList.toggle('praised', !!praise);
  if (!c) {
    const n = nothingText();
    el.innerHTML = praise || `<h1>${esc(n.title)}</h1><p>${esc(n.body)}</p>`;
    return;
  }
  el.innerHTML = `${praise ? `${praise}<div class="next-label">Next, if you want</div><h3>${esc(c.title)}</h3>` : `<h1>${esc(c.title)}</h1>`}<p>${esc(c.body)}</p>
    <div class="actions">
      ${c.taskId ? `${data.focus ? '' : `<button class="btn solid" id="hero-focus">${PLAY} Start focus</button>`}
      <a class="btn ${data.focus ? 'solid' : ''}" href="${taskUrl(c.taskId)}">Open in Todoist</a>
      <button class="btn" id="hero-done">Mark done</button>` : ''}
      <button class="btn quiet" id="hero-skip">Not now</button>
    </div>
    ${c.ai ? '<div class="ai-note">Worded by Claude from your Todoist data.</div>' : ''}`;
  $('#hero-skip').onclick = () => { skip++; renderNudge(); };
  if (c.taskId) $('#hero-done').onclick = (e) => complete(c.taskId, e.currentTarget, el);
  if (c.taskId && $('#hero-focus')) $('#hero-focus').onclick = () => startFocus(c.taskId);
}

function renderDeadlines() {
  const el = $('#deadlines');
  const list = state ? deadlines(state) : [];
  if (!list.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<h2>Deadlines</h2><ul>${list.map((d) => `<li class="${d.stage === 'overdue' || d.stage === 'today' ? 'urgent' : ''}">
      <button class="check" data-id="${esc(d.t.id)}" aria-label="Mark “${esc(cleanTitle(d.t.content))}” done"></button>
      <a href="${taskUrl(d.t.id)}">${esc(cleanTitle(d.t.content))}</a>
      ${playBtn(d.t)}
      <span class="when">${esc(deadlineLabel(d))}</span></li>`).join('')}</ul>`;
  el.querySelectorAll('.check').forEach((b) => (b.onclick = () => complete(b.dataset.id, b)));
  wirePlay(el);
}

function statusText(a) {
  if (a.openCount === 0) return a.stale ? 'no next step' : '';
  const streak = state ? areaStreak(state, a) : 0;
  if (streak >= 2) return `${streak}-day streak`;
  if (a.doneLast24h) return 'moving';
  const d = Math.floor(a.daysQuiet);
  if (d === 0) return 'today';
  return `${d}d${a.quietIsLowerBound ? '+' : ''} quiet`;
}

const expanded = new Set();
const UNLABELED_MIN = 30;

// Progress by time: finished work (last 30 days) against what's still open. Tasks without an estimate count 30m.
// Full when nothing is left; otherwise at least a third, so a fresh project doesn't look empty.
function progressOf(a) {
  const mins = (t) => minutesFromLabels(t.labels) ?? UNLABELED_MIN;
  const inArea = (t) => areaOfTask(state, t)?.id === a.id;
  const left = state.open.filter(inArea).reduce((m, t) => m + mins(t), 0);
  const done = state.done.filter(inArea).reduce((m, t) => m + mins(t), 0);
  if (!left && !done) return null;
  if (!left) return { pct: 100, full: true, label: 'Everything here is done' };
  const pct = Math.max(100 / 3, (done / (done + left)) * 100);
  return { pct, full: false, label: `${fmtMinutes(done)} done in the last 30 days, about ${fmtMinutes(left)} left` };
}

// All open tasks of one project, in Todoist order, subtasks under their parent.
function areaTasks(a) {
  const mine = state.open.filter((t) => areaOfTask(state, t)?.id === a.id);
  const ids = new Set(mine.map((t) => t.id));
  const byOrder = (x, y) => (x.child_order ?? 0) - (y.child_order ?? 0);
  const out = [];
  const walk = (parent, depth) => mine.filter((t) => (t.parent_id || null) === parent).sort(byOrder).forEach((t) => {
    out.push({ t, depth }); walk(t.id, depth + 1);
  });
  walk(null, 0);
  mine.filter((t) => t.parent_id && !ids.has(t.parent_id)).forEach((t) => out.push({ t, depth: 0 })); // orphans
  return out;
}

function dueShort(t) {
  const raw = t.deadline?.date || t.due?.date;
  if (!raw) return '';
  const d = new Date(`${raw.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function taskListHtml(a) {
  const rows = areaTasks(a);
  if (!rows.length) return '<div class="area-list"><p class="none">No open tasks.</p></div>';
  return `<ul class="area-list">${rows.map(({ t, depth }) => {
    const m = minutesFromLabels(t.labels);
    const due = dueShort(t);
    return `<li style="--depth:${Math.min(depth, 3)}">
      <button class="check" data-id="${esc(t.id)}" aria-label="Mark “${esc(cleanTitle(t.content))}” done"></button>
      <a href="${taskUrl(t.id)}">${esc(cleanTitle(t.content))}</a>
      ${m ? `<span class="est">${fmtMinutes(m)}</span>` : ''}
      ${due ? `<span class="due">${esc(due)}</span>` : ''}
      ${playBtn(t)}
    </li>`;
  }).join('')}</ul>`;
}

function renderAreas() {
  const el = $('#areas');
  if (!state) { el.innerHTML = ''; return; }
  const tracked = state.areas.filter((a) => a.tracked);
  el.innerHTML = tracked.map((a) => {
    const t = a.next;
    const min = t ? minutesFromLabels(t.labels) : null;
    const prog = progressOf(a);
    const cls = ['area', a.stale ? 'stale' : '', a.doneLast24h ? 'moving' : ''].join(' ');
    const open = expanded.has(a.id);
    return `<div class="${cls}${open ? ' open' : ''}">
      <button class="name" data-toggle="${esc(a.id)}" aria-expanded="${open}" title="Show all tasks">${esc(a.name)} <span class="chev">${open ? '▾' : '▸'}</span></button>
      <span class="step">${t
        ? `<button class="check" data-id="${esc(t.id)}" aria-label="Mark “${esc(cleanTitle(t.content))}” done"></button>
           <span class="t" title="${esc(cleanTitle(t.content))}">${esc(cleanTitle(t.content))}</span>
           ${min ? `<span class="est">${fmtMinutes(min)}</span>` : ''}
           ${playBtn(t)}`
        : `<button class="empty" data-add="${esc(a.id)}">Write the next step</button>`}</span>
      <span class="status">${statusText(a)}</span>
      ${prog ? `<span class="meter${prog.full ? ' full' : ''}" title="${esc(prog.label)}"><i style="width:${prog.pct}%"></i></span>` : ''}
      ${open ? taskListHtml(a) : ''}
    </div>`;
  }).join('') || `<p class="foot">No tracked projects yet. Choose them in settings.</p>`;
  el.querySelectorAll('.check').forEach((b) => (b.onclick = () => complete(b.dataset.id, b)));
  el.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => adder.open({ targetId: b.dataset.add, nextStep: true })));
  el.querySelectorAll('[data-toggle]').forEach((b) => (b.onclick = () => {
    const id = b.dataset.toggle;
    if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
    renderAreas();
  }));
  wirePlay(el);
}

function renderFits() {
  document.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.min) === chosenMin)));
  const el = $('#fits');
  if (!chosenMin || !state) { el.innerHTML = ''; return; }
  const list = fitsIn(state, chosenMin);
  if (!list.length) {
    el.innerHTML = `<p class="none">Nothing estimated at ${fmtMinutes(chosenMin)} or less. Add a label like 15m or 1h to tasks in Todoist and they'll show here.</p>`;
    return;
  }
  el.innerHTML = `<ul>${list.map(({ t, min, area }) => `<li>
      <button class="check" data-id="${esc(t.id)}" aria-label="Mark “${esc(cleanTitle(t.content))}” done"></button>
      <a href="${taskUrl(t.id)}">${esc(cleanTitle(t.content))}</a>
      <span class="est">${fmtMinutes(min)}</span>
      ${playBtn(t)}
      <span class="where">${esc(area.name)}${area.stale ? ', quiet' : ''}</span></li>`).join('')}</ul>`;
  el.querySelectorAll('.check').forEach((b) => (b.onclick = () => complete(b.dataset.id, b)));
  wirePlay(el);
}

let breakTimer = null;
function renderBreak() {
  const el = $('#breakbar');
  clearInterval(breakTimer);
  const b = data.breakBlock;
  const draw = () => {
    if (b && b.until > Date.now()) {
      const left = Math.ceil((b.until - Date.now()) / 60000);
      el.innerHTML = `<span>On break, ${left} min left</span><button class="btn quiet" id="endb">End break</button>`;
      $('#endb').onclick = async () => { await send({ type: 'endBreak' }); load(); };
    } else {
      el.innerHTML = '';
    }
  };
  draw();
  if (b) breakTimer = setInterval(draw, 30000);
}

function renderFoot() {
  const el = $('#foot');
  const parts = [];
  if (data.lastBriefing) parts.push(`<span title="${esc(data.lastBriefing.lines.join(' '))}">Session briefing at ${new Date(data.lastBriefing.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: ${esc(data.lastBriefing.title)}</span>`);
  if (data.lastError && data.snapshot && data.lastError.at > data.snapshot.fetchedAt) {
    parts.push(`<span class="err">${esc(data.lastError.message)}. Showing data from ${new Date(data.snapshot.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</span>`);
  }
  parts.push(`<a href="https://app.todoist.com/app/today">Open Todoist</a>`);
  el.innerHTML = parts.join('');
}

// ---------- focus timer ----------

let focusTick = null;
function renderFocus() {
  const el = $('#focus');
  clearInterval(focusTick);
  const f = data.focus;
  if (!f) { el.hidden = true; el.innerHTML = ''; return; }
  const task = state?.open.find((t) => t.id === f.taskId);
  const est = task ? minutesFromLabels(task.labels) : null;
  el.hidden = false;
  el.innerHTML = `
    <div class="focus-main">
      <span class="focus-label">Focusing${f.area ? ` in ${esc(f.area)}` : ''}</span>
      <span class="focus-title">${esc(f.title)}</span>
    </div>
    <span class="focus-clock" aria-label="Elapsed time"></span>
    <div class="focus-actions">
      <button class="btn solid" id="focus-done">Done</button>
      <button class="btn" id="focus-stop">Stop</button>
    </div>
    <form class="focus-stop" hidden>
      <label for="focus-note">What did you get done? It's saved as a completed step under the task.</label>
      <input id="focus-note" type="text" autocomplete="off" placeholder="e.g. Soldered the power rail, IMU still to go">
      <div class="focus-stop-actions">
        <button type="submit" class="btn solid">Save step</button>
        <button type="button" class="btn quiet" id="focus-discard">Discard the time</button>
        <button type="button" class="btn quiet" id="focus-keep">Keep going</button>
      </div>
      <p class="focus-err" role="alert"></p>
    </form>`;
  const clock = el.querySelector('.focus-clock');
  const draw = () => {
    const s = Math.max(0, Math.floor((Date.now() - f.startedAt) / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const t = h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
    clock.textContent = est ? `${t} of ${fmtMinutes(est)}` : t;
    clock.classList.toggle('over', !!est && s / 60 > est);
  };
  draw();
  focusTick = setInterval(draw, 1000);

  const form = el.querySelector('.focus-stop');
  const err = el.querySelector('.focus-err');
  el.querySelector('#focus-done').onclick = async (e) => {
    e.currentTarget.disabled = true;
    const r = await send({ type: 'focusDone' });
    if (r?.error) { err.textContent = r.error; form.hidden = false; e.currentTarget.disabled = false; return; }
    celebrate(el);
    toast(`Done. ${fmtDuration(r.minutes)} of focus logged.`);
    setTimeout(() => load(), 750);
  };
  el.querySelector('#focus-stop').onclick = () => { form.hidden = false; el.querySelector('#focus-note').focus(); };
  el.querySelector('#focus-keep').onclick = () => { form.hidden = true; };
  el.querySelector('#focus-discard').onclick = async () => {
    await send({ type: 'focusStop', discard: true });
    toast('Stopped. That time was not counted.');
    load();
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    const r = await send({ type: 'focusStop', note: el.querySelector('#focus-note').value });
    if (r?.error) { err.textContent = `${r.error}. Try again.`; btn.disabled = false; return; }
    celebrate(el);
    toast(`Saved the step. ${fmtDuration(r.minutes)} of focus logged.`);
    setTimeout(() => load(), 750);
  };
}

async function startFocus(taskId) {
  const t = state?.open.find((x) => x.id === taskId);
  if (!t) return;
  const area = areaOfTask(state, t);
  const r = await send({ type: 'focusStart', taskId, title: cleanTitle(t.content), area: area?.name || null });
  if (r?.error) { toast(r.error); return; }
  await load();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function celebrate(el) {
  el.classList.remove('celebrate');
  void el.offsetWidth;
  el.classList.add('celebrate');
}

// ---------- 7-day stats ----------

function renderStats() {
  const el = $('#stats');
  const { days, total } = stats7(data.focusLog || [], data.breakLog || [], Date.now(), state?.done || []);
  if (!total.focus && !total.brk) {
    el.innerHTML = `<p class="stats-line quiet">Start a focus timer with ▶ on any task. Focus time and breaks from the last 7 days show up here.</p>`;
    return;
  }
  const max = Math.max(30, ...days.map((d) => Math.max(d.focus, d.brk)));
  const h = (m) => (m ? Math.max(3, Math.round((m / max) * 100)) : 0);
  el.innerHTML = `
    <button class="stats-line" aria-expanded="false" aria-controls="stats-pop">
      Last 7 days: <b>${fmtDuration(total.focus)}</b> work, <b>${fmtDuration(total.brk)}</b> breaks${total.done ? `, ${total.done} finished` : ''}
    </button>
    <div class="stats-pop" id="stats-pop" role="group" aria-label="Focus and break time per day">
      <div class="legend"><span><i class="sw s-focus"></i>Focus</span><span><i class="sw s-brk"></i>Breaks</span></div>
      <div class="rows">
        ${days.map((d) => `<div class="day-row" title="${esc(`${d.label} ${d.date}: ${fmtDuration(d.focus)} focus${d.done ? `, ${d.done} done` : ''}, ${fmtDuration(d.brk)} breaks`)}">
            <span class="day-label">${esc(d.label)}</span>
            <span class="hbars">
              <span class="hbar s-focus" style="width:${h(d.focus)}%"></span>
              <span class="hbar s-brk" style="width:${h(d.brk)}%"></span>
            </span>
          </div>`).join('')}
      </div>
      <table class="sr-only"><caption>Minutes per day</caption>
        <tr><th>Day</th><th>Focus</th><th>Breaks</th></tr>
        ${days.map((d) => `<tr><td>${esc(d.label)} ${esc(d.date)}</td><td>${fmtDuration(d.focus)}</td><td>${fmtDuration(d.brk)}</td></tr>`).join('')}
      </table>
    </div>`;
  const btn = el.querySelector('.stats-line');
  btn.onclick = () => {
    const open = el.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  };
}

// ---------- Top 3 ----------

function renderToday() {
  const el = $('#today');
  if (!state) { el.innerHTML = ''; return; }
  const items = topItems(state, topFor(top3Store));
  if (!items.length) {
    el.innerHTML = `<div class="today-empty"><span>Pick up to 3 things that would make today count.</span> <button class="btn" id="pick-today">Pick Top 3</button><button class="btn add-task" title="Add a task (N)">+ Add task</button></div>`;
    $('#pick-today').onclick = () => picker.open(dayId());
    return;
  }
  const left = items.filter((x) => !x.done).length;
  el.innerHTML = `<div class="today-head"><h2>Today${left ? '' : ': all three done'}</h2><span class="today-btns"><button class="btn quiet" id="pick-today">Edit</button><button class="btn add-task" title="Add a task (N)">+ Add task</button></span></div>
    <ol>${items.map(({ task: t, done }) => {
      const m = minutesFromLabels(t.labels);
      return `<li class="${done ? 'is-done' : ''}">
        <button class="check ${done ? 'done' : ''}" data-id="${esc(t.id)}" ${done ? 'disabled' : ''} aria-label="Mark “${esc(cleanTitle(t.content))}” done"></button>
        <a class="t" href="${taskUrl(t.id)}">${esc(cleanTitle(t.content))}</a>
        ${m ? `<span class="est">${fmtMinutes(m)}</span>` : ''}
        ${done ? '' : playBtn(t)}
      </li>`;
    }).join('')}</ol>`;
  $('#pick-today').onclick = () => picker.open(dayId());
  el.querySelectorAll('.check:not([disabled])').forEach((b) => (b.onclick = () => complete(b.dataset.id, b)));
  wirePlay(el);
}

// ---------- done today ----------

function renderDoneToday() {
  const el = $('#done-today');
  if (!state) { el.innerHTML = ''; return; }
  const list = doneToday(state);
  if (!list.length) { el.innerHTML = ''; return; }
  const open = el.querySelector('details')?.open;
  el.innerHTML = `<details ${open ? 'open' : ''}><summary>Done today: <b>${list.length}</b></summary>
    <ul>${list.map((t) => {
      const a = state.areas.find((x) => x.projectId === t.project_id && (x.kind === 'project' || x.sectionId === t.section_id));
      return `<li><span class="tick" aria-hidden="true"></span>${esc(cleanTitle(t.content || ''))}${a ? ` <span class="where">${esc(a.name)}</span>` : ''}</li>`;
    }).join('')}</ul></details>`;
}

// ---------- two-minute rule ----------

function renderTwoMin() {
  const el = $('#twomin');
  // Keep showing the one already on screen while it's still open; otherwise maybe pick a new one.
  const shownId = el.dataset.shown;
  if (shownId && !el.hidden && state?.open.some((x) => x.id === shownId) && !twoMinSkip.includes(shownId)) return;
  const t = state && !data.focus ? twoMinuteTask(state, data.twoMinShownAt, Date.now(), twoMinSkip) : null;
  if (!t) { el.hidden = true; el.innerHTML = ''; delete el.dataset.shown; return; }
  el.dataset.shown = t.id;
  chrome.storage.local.set({ twoMinShownAt: Date.now() });
  const txt = say('twoMinute', { task: cleanTitle(t.content) }, `${t.id}|${dayId()}`);
  el.hidden = false;
  el.innerHTML = `<button class="check" data-id="${esc(t.id)}" aria-label="Mark “${esc(cleanTitle(t.content))}” done"></button>
    <div><b>${esc(txt.title)}</b> <span>${esc(txt.body)}</span></div>
    <button class="btn quiet" id="twomin-later">Later</button>`;
  el.querySelector('.check').onclick = (e) => complete(t.id, e.currentTarget, el);
  $('#twomin-later').onclick = () => { el.hidden = true; twoMinSkip.push(t.id); };
}

// ---------- shutdown ----------

function renderShutdown() {
  const el = $('#shutdown');
  const s = data.settings;
  if (!state || !inShutdownWindow(s.shutdownTime) || data.shutdownDone === dayId()) { el.hidden = true; el.innerHTML = ''; return; }
  const done = doneToday(state);
  const focusToday = (data.focusLog || []).filter((f) => f.at >= Date.now() - 20 * 3600000).reduce((a, f) => a + f.minutes, 0);
  const tomorrow = top3Store[nextDayId()] || [];
  const titleOf = (id) => cleanTitle(state.open.find((t) => t.id === id)?.content || '');
  el.hidden = false;
  el.innerHTML = `
    <h2>Time to shut down</h2>
    <p>${done.length} done today${focusToday ? `, ${fmtDuration(focusToday)} focused` : ''}. ${done.length ? `Last one: “${esc(cleanTitle(done[0].content || ''))}”.` : 'Tomorrow is a fresh page.'}</p>
    ${tomorrow.length ? `<p class="tomorrow">Tomorrow starts with: ${tomorrow.map((id) => `<b>${esc(titleOf(id))}</b>`).join(', ')}</p>` : ''}
    <div class="actions">
      <button class="btn" id="pick-tomorrow">${tomorrow.length ? "Change tomorrow's Top 3" : "Pick tomorrow's first step"}</button>
      <button class="btn solid" id="close-up">Close up for today</button>
    </div>`;
  $('#pick-tomorrow').onclick = () => picker.open(nextDayId(), { tomorrow: true });
  $('#close-up').onclick = async () => {
    await send({ type: 'shutdownDone' });
    el.innerHTML = '<h2>Good night.</h2><p>Nudges stay quiet until 08:00. The work will still be here.</p>';
    data.shutdownDone = dayId();
  };
}

function renderReviewButton() {
  const due = isReviewTime(data.settings.reviewTime) && data.reviewedWeek !== weekId();
  $('#review-open').classList.toggle('quiet', !due);
  $('#review-open').classList.toggle('solid', due);
}

function render() {
  renderShutdown();
  renderTwoMin();
  renderToday();
  renderDoneToday();
  renderReviewButton();
  renderFocus();
  renderStats();
  renderNudge();
  renderDeadlines();
  renderAreas();
  renderFits();
  renderBreak();
  renderFoot();
}

async function complete(id, btn, rowEl) {
  const row = rowEl || btn?.closest('li, .area');
  if (btn) { btn.classList.add('done'); btn.disabled = true; }
  if (row) row.classList.add('completing');
  const started = Date.now();
  const r = await send({ type: 'complete', taskId: id });
  if (r?.error) {
    if (btn) { btn.classList.remove('done'); btn.disabled = false; }
    if (row) row.classList.remove('completing');
    toast(r.error);
    return;
  }
  if (r?.minutes) toast(`Done. ${fmtDuration(r.minutes)} of focus logged.`);
  skip = 0;
  // Let the tick finish before the list redraws.
  setTimeout(load, Math.max(0, 750 - (Date.now() - started)));
}

document.querySelectorAll('.chip').forEach((b) => (b.onclick = () => {
  const m = Number(b.dataset.min);
  chosenMin = chosenMin === m ? null : m;
  renderFits();
}));

// After unzipping an update, Chrome keeps the old background running until the extension is reloaded.
const PROTOCOL = 5;
async function checkStale() {
  let r = null;
  try { r = await send({ type: 'hello' }); } catch {}
  if (r && r.protocol >= PROTOCOL) return;
  const bar = document.createElement('div');
  bar.className = 'stale-bar';
  bar.innerHTML = `<span>Nudge was updated but Chrome is still running the old version in the background.</span>
    <button class="btn solid" id="reload-ext">Reload Nudge</button>`;
  document.body.prepend(bar);
  bar.querySelector('#reload-ext').onclick = () => chrome.runtime.reload();
}
checkStale();

const adder = mountAddTask({
  dialog: $('#add'),
  getSnapshot: () => data?.snapshot,
  onCreated: (r) => {
    toast(`Added “${r.content}” to ${r.where}${r.nextStep ? ' as the next step' : ''}.`, r.taskId ? taskUrl(r.taskId) : null);
    skip = 0;
    load();
  },
});
const picker = mountPicker({
  dialog: $('#pick'),
  getSnapshot: () => data?.snapshot,
  onSaved: (ids, day) => {
    toast(day === dayId() ? (ids.length ? `Top 3 set: ${ids.length} for today.` : 'Top 3 cleared.') : 'Tomorrow is planned.');
    load();
  },
});
const review = mountReview({
  dialog: $('#review'),
  getData: () => data,
  reload: () => load(true),
  openAdd: (targetId) => adder.open({ targetId, nextStep: true }),
  openPicker: () => picker.open(nextDayId(), { tomorrow: true }),
});
$('#review-open').onclick = () => {
  if (!data?.settings?.token) { chrome.runtime.openOptionsPage(); return; }
  review.open();
};

$('#today').addEventListener('click', (e) => {
  if (!e.target.closest('.add-task')) return;
  if (!data?.settings?.token) { chrome.runtime.openOptionsPage(); return; }
  adder.open();
});
mountWeather($('#weather'));
document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t.closest?.('input, textarea, select, [contenteditable], dialog[open]') || document.querySelector('dialog[open]')) return;
  if (!data?.settings?.token) return;
  e.preventDefault();
  adder.open();
});

let toastTimer = null;
function toast(text, href) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(text)}</span>${href ? ` <a href="${href}">Open</a>` : ''}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 6000);
}

mountSpotifyCorner();
mountShortcuts($('#shortcuts'), $('#sc-dialog'));
mountGolden(document.getElementById('golden-section'), { heading: 'Elsewhere on the web', count: 4 });
mountPostit(document.getElementById('postit'));

let tipOffset = 0;
const showTip = () => { $('#wellness').textContent = tipFor(Date.now(), tipOffset); };
$('#wellness').onclick = () => { tipOffset++; showTip(); };
showTip();
$('#settings').onclick = () => chrome.runtime.openOptionsPage();
$('#tips-open').onclick = () => $('#tips').showModal();
$('#tips-close').onclick = () => $('#tips').close();
$('#tips').addEventListener('click', (e) => { if (e.target.id === 'tips') $('#tips').close(); });

load();
