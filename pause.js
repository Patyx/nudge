import { computeState, nudgeCandidates, leisurePick, cleanTitle, dayKey, nothingText } from './engine.js';
import { mountGolden } from './goldenui.js';
import { mountSpotifyCorner } from './corner.js';
import { breakUsedToday, breakOptions } from './daily.js';
import { fmtDuration } from './tracking.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const target = params.get('u') || '';
let host = '';
try { host = new URL(target).hostname.replace(/^www\./, ''); } catch {}

$('#site').textContent = host ? `You opened ${host}.` : 'You opened a site on your pause list.';
if (host) $('#break-intro').textContent = `Still want ${host}? Make it a proper break. It ends with a reminder.`;

// On YouTube, one of the three is always a music site: better places for music than its feed.
mountGolden(document.getElementById('golden-section'), {
  heading: 'Or wander somewhere a feed would never take you',
  ensure: /youtube/.test(host) ? 'music' : null,
});
mountSpotifyCorner();

(async () => {
  const data = await chrome.runtime.sendMessage({ type: 'getData' });
  if (!data?.snapshot) {
    $('#title').textContent = 'Is this the plan?';
    $('#body').textContent = 'Connect Todoist in settings and this page will show what is waiting for you.';
    return;
  }
  const state = computeState(data.snapshot, data.settings);
  const cands = nudgeCandidates(state).filter((x) => !x.leisure);
  const c = cands.find((x) => x.taskId) || cands[0];
  if (c) {
    $('#title').textContent = c.title;
    $('#body').textContent = c.body;
    if (c.taskId) {
      const a = $('#open');
      a.href = `https://app.todoist.com/app/task/${encodeURIComponent(c.taskId)}`;
      a.hidden = false;
    }
  } else {
    const n = nothingText();
    $('#title').textContent = n.title;
    $('#body').textContent = n.body;
  }
  const fun = leisurePick(state, `pause|${dayKey(Date.now())}|${new Date().getHours()}`);
  if (fun) $('#fun').textContent = `Or skip the scrolling: "${cleanTitle(fun.content)}" is on your list.`;
})();

$('#back').onclick = () => { location.href = chrome.runtime.getURL('newtab.html'); };

// Break buttons follow the daily budget.
async function showBreaks() {
  const r = await chrome.storage.local.get(['breakLog', 'settings']);
  const budget = (r.settings && r.settings.breakBudgetMin) || 180;
  const used = breakUsedToday(r.breakLog || []);
  const { left, over, options } = breakOptions(budget, used);
  const label = (m) => (m >= 60 ? `${m / 60} hour${m > 60 ? 's' : ''}` : `${m} min`);
  $('#break-buttons').innerHTML = options.map((m) => `<button class="btn" data-min="${m}">${label(m)}</button>`).join('');
  $('#budget').textContent = over
    ? `Today's ${fmtDuration(budget)} break budget is used (${fmtDuration(used)} so far). Short breaks only from here.`
    : `Break time left today: ${fmtDuration(left)} of ${fmtDuration(budget)}.`;
  if (over) $('#break-intro').textContent = 'Budget spent. One short breather is still fine.';
  document.querySelectorAll('[data-min]').forEach((b) => (b.onclick = async () => {
    await chrome.runtime.sendMessage({ type: 'startBreak', minutes: Number(b.dataset.min) });
    if (/^https?:\/\//.test(target)) location.href = target;
    else location.href = chrome.runtime.getURL('newtab.html');
  }));
}
showBreaks();
