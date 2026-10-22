import { buildAreas, autoTrackedIds } from './engine.js';
import { allSites } from './golden.js';
import { loadPlace, savePlace, searchPlaces } from './weather.js';

const $ = (s) => document.querySelector(s);
const send = (msg) => chrome.runtime.sendMessage(msg);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NUM = ['projectStaleDays', 'actionStaleDays', 'nudgeEveryActiveMinutes', 'newSessionGapHours', 'breakBudgetMin', 'farOffDays'];
const CHECKS = ['notifyNudges', 'notifyDeadlines', 'notifyBriefing', 'notifyShutdown', 'notifyReview'];
const TIMES = ['shutdownTime', 'reviewTime'];

let settings = null;

function status(id, text, kind = '') {
  const el = $(id);
  el.textContent = text;
  el.className = `status ${kind}`;
}

function renderAreas(snapshot) {
  const el = $('#areas');
  if (!snapshot) return;
  const areas = buildAreas(snapshot);
  const tracked = new Set(settings.trackedAreaIds?.length ? settings.trackedAreaIds : autoTrackedIds(areas));
  el.innerHTML = areas.map((a) => `<div class="inline">
      <input type="checkbox" id="a-${esc(a.id)}" data-area="${esc(a.id)}" ${tracked.has(a.id) ? 'checked' : ''}>
      <label for="a-${esc(a.id)}">${esc(a.name)}${a.kind === 'section' ? ` <span class="hint">in ${esc(a.projectName)}</span>` : ''}</label>
    </div>`).join('') || '<span class="hint">No projects found in Todoist.</span>';
}

async function init() {
  const data = await send({ type: 'getData' });
  settings = data.settings;
  $('#token').value = settings.token;
  for (const k of NUM) $(`#${k}`).value = settings[k];
  for (const k of TIMES) $(`#${k}`).value = settings[k];
  for (const k of CHECKS) $(`#${k}`).checked = settings[k] !== false;
  $('#notifyLevel').value = settings.notifyLevel || 'normal';
  $('#blockedSites').value = settings.blockedSites.join('\n');
  $('#aiEnabled').checked = settings.aiEnabled;
  $('#anthropicKey').value = settings.anthropicKey;
  $('#aiModel').value = settings.aiModel;
  renderAreas(data.snapshot);
  if (data.lastError) status('#teststatus', data.lastError.message, 'bad');
}

function collect() {
  const out = {
    token: $('#token').value.trim(),
    notifyLevel: $('#notifyLevel').value,
    ...Object.fromEntries(CHECKS.map((k) => [k, $(`#${k}`).checked])),
    blockedSites: $('#blockedSites').value.split(/\s*\n\s*/).map((s) => s.trim()).filter(Boolean),
    aiEnabled: $('#aiEnabled').checked,
    anthropicKey: $('#anthropicKey').value.trim(),
    aiModel: $('#aiModel').value.trim() || 'claude-haiku-5-5',
  };
  for (const k of NUM) {
    const v = Number($(`#${k}`).value);
    if (Number.isFinite(v) && v > 0) out[k] = v;
  }
  for (const k of TIMES) if (/^\d\d:\d\d$/.test($(`#${k}`).value)) out[k] = $(`#${k}`).value;
  const boxes = [...document.querySelectorAll('[data-area]')];
  if (boxes.length) out.trackedAreaIds = boxes.filter((b) => b.checked).map((b) => b.dataset.area);
  return out;
}

$('#save').onclick = async () => {
  const s = collect();
  if (s.aiEnabled && !s.anthropicKey) { status('#savestatus', 'Add an API key or turn off Claude wording.', 'bad'); return; }
  await send({ type: 'saveSettings', settings: s });
  settings = { ...settings, ...s };
  status('#savestatus', 'Saved.', 'ok');
};

$('#test').onclick = async () => {
  status('#teststatus', 'Checking…');
  await send({ type: 'saveSettings', settings: { token: $('#token').value.trim() } });
  const data = await send({ type: 'getData', force: true });
  settings = data.settings;
  if (data.lastError && (!data.snapshot || data.lastError.at > data.snapshot.fetchedAt)) {
    status('#teststatus', data.lastError.message, 'bad');
  } else if (data.snapshot) {
    const n = data.snapshot.tasks.length;
    status('#teststatus', `Connected. ${n} open task${n === 1 ? '' : 's'}.`, 'ok');
    renderAreas(data.snapshot);
  } else {
    status('#teststatus', 'Paste a token first.', 'bad');
  }
};

$('#testNudge').onclick = async () => {
  await $('#save').onclick();
  const r = await send({ type: 'testNudge' });
  status('#trystatus', r?.nudge ? 'Sent. Check your Windows notifications.' : (r?.error || 'Nothing to nudge about right now.'), r?.nudge ? 'ok' : 'bad');
};

$('#testBriefing').onclick = async () => {
  await $('#save').onclick();
  const r = await send({ type: 'testBriefing' });
  status('#trystatus', r?.error || 'Sent.', r?.error ? 'bad' : 'ok');
};

async function renderRatings() {
  const ratings = (await chrome.storage.local.get('goldenRatings')).goldenRatings || {};
  const byUrl = Object.fromEntries(allSites().map((x) => [x.url, x]));
  const rows = Object.entries(ratings).filter(([u]) => byUrl[u]).sort((a, b) => b[1] - a[1]);
  const el = $('#ratings');
  if (!rows.length) { el.innerHTML = '<span class="hint">No ratings yet. Use the thumbs under any link.</span>'; return; }
  const label = (n) => (n <= -2 ? 'hidden' : n < 0 ? 'rare' : `${n + 1}× as often`);
  el.innerHTML = `<ul class="rated">${rows.map(([u, n]) => `<li>
      <span>${esc(byUrl[u].title)}</span>
      <span class="hint">${label(n)}</span>
      <button class="btn quiet" data-reset="${esc(u)}">${n <= -2 ? 'Bring back' : 'Reset'}</button>
    </li>`).join('')}</ul>`;
  el.querySelectorAll('[data-reset]').forEach((b) => (b.onclick = async () => {
    const r = (await chrome.storage.local.get('goldenRatings')).goldenRatings || {};
    delete r[b.dataset.reset];
    await chrome.storage.local.set({ goldenRatings: r });
    renderRatings();
  }));
}

$('#resetRatings').onclick = async () => {
  await chrome.storage.local.set({ goldenRatings: {} });
  renderRatings();
};

renderRatings();
init();

// ---------- weather place ----------
const placeLabel = (p) => [p.name, p.admin, p.country].filter(Boolean).join(', ');
async function showPlace() {
  const p = await loadPlace();
  $('#placeNow').innerHTML = p
    ? `Showing weather for <b>${esc(placeLabel(p))}</b>. <button class="btn quiet" id="placeClear">Remove</button>`
    : 'No place set, so the weather is hidden.';
  const c = $('#placeClear');
  if (c) c.onclick = async () => { await savePlace(null); showPlace(); };
}
async function runPlaceSearch() {
  const q = $('#placeQuery').value.trim();
  const out = $('#placeResults');
  if (!q) return;
  out.textContent = 'Searching…';
  try {
    const list = await searchPlaces(q);
    if (!list.length) { out.textContent = 'Nothing found. Try the city name in its own language.'; return; }
    out.innerHTML = list.map((p, i) => `<button class="btn" data-place="${i}">${esc(placeLabel(p))}</button>`).join(' ');
    out.querySelectorAll('[data-place]').forEach((b) => (b.onclick = async () => {
      await savePlace(list[Number(b.dataset.place)]);
      out.innerHTML = '';
      $('#placeQuery').value = '';
      showPlace();
    }));
  } catch (e) {
    out.textContent = `Search failed: ${e.message}`;
  }
}
$('#placeSearch').onclick = runPlaceSearch;
$('#placeQuery').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runPlaceSearch(); } });
showPlace();
