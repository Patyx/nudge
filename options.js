import { buildAreas, autoTrackedIds } from './engine.js';
import { allSites } from './golden.js';
import { loadPlace, savePlace, searchPlaces } from './weather.js';

const $ = (s) => document.querySelector(s);
const send = (msg) => chrome.runtime.sendMessage(msg);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NUM = ['projectStaleDays', 'actionStaleDays', 'nudgeEveryActiveMinutes', 'newSessionGapHours', 'breakBudgetMin', 'farOffDays'];
const CHECKS = ['notifyNudges', 'notifyDeadlines', 'notifyBriefing', 'notifyShutdown', 'notifyReview'];
const TIMES = ['shutdownTime', 'reviewTime'];
const SHOW = ['showPraise', 'showWeather', 'showTip', 'showNote', 'showSites', 'showMusic', 'showChart', 'showDoneToday', 'showFits', 'showShutdown'];

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
  for (const k of SHOW) $(`#${k}`).checked = settings[k] !== false;
  $('#goldenCount').value = settings.goldenCount ?? 4;
  $('#showPolishSites').checked = settings.showPolishSites ?? navigator.language.toLowerCase().startsWith('pl');
  $('#dayStartHour').value = String(settings.dayStartHour ?? 4);
  renderAreas(data.snapshot);
  if (data.lastError) status('#teststatus', data.lastError.message, 'bad');
}

function collect() {
  const out = {
    token: $('#token').value.trim(),
    notifyLevel: $('#notifyLevel').value,
    ...Object.fromEntries(CHECKS.map((k) => [k, $(`#${k}`).checked])),
    ...Object.fromEntries(SHOW.map((k) => [k, $(`#${k}`).checked])),
    showPolishSites: $('#showPolishSites').checked,
    goldenCount: Math.max(2, Math.min(8, Number($('#goldenCount').value) || 4)),
    dayStartHour: Number($('#dayStartHour').value),
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

// ---------- backup ----------
const SYNC_KEYS = ['shortcuts', 'postit', 'weatherPlace', 'top3'];
const LOCAL_KEYS = ['goldenRatings'];
const SECRET = ['token', 'anthropicKey'];

$('#exportBtn').onclick = async () => {
  const local = await chrome.storage.local.get(['settings', ...LOCAL_KEYS]);
  const sync = await chrome.storage.sync.get(SYNC_KEYS);
  const s = { ...(local.settings || {}) };
  for (const k of SECRET) delete s[k];
  const file = { app: 'nudge', version: chrome.runtime.getManifest().version, exportedAt: new Date().toISOString(), settings: s, sync, local: { goldenRatings: local.goldenRatings || {} } };
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `nudge-settings-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status('#backupstatus', 'Exported.', 'ok');
};

$('#importFile').onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (j.app !== 'nudge' || typeof j.settings !== 'object') throw new Error('This is not a Nudge settings file');
    const keep = (await chrome.storage.local.get('settings')).settings || {};
    const incoming = { ...j.settings };
    for (const k of SECRET) delete incoming[k]; // never take secrets from a file
    await chrome.storage.local.set({ settings: { ...keep, ...incoming, token: keep.token || '', anthropicKey: keep.anthropicKey || '' } });
    const sync = Object.fromEntries(Object.entries(j.sync || {}).filter(([k]) => SYNC_KEYS.includes(k)));
    if (Object.keys(sync).length) await chrome.storage.sync.set(sync);
    if (j.local?.goldenRatings) await chrome.storage.local.set({ goldenRatings: j.local.goldenRatings });
    status('#backupstatus', 'Imported. Reloading…', 'ok');
    setTimeout(() => location.reload(), 700);
  } catch (err) {
    status('#backupstatus', `Import failed: ${err.message}`, 'bad');
  }
};
