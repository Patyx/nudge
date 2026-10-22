// Renders the hand-picked links with thumbs up/down. Used on the new tab and the pause screen.
import { pickGolden, rate, domainOf } from './golden.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UP = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M6.3 1.6c.3-.6 1.1-.8 1.6-.4.6.4.9 1.1.8 1.8L8.4 5.5h4.3c1 0 1.7.9 1.5 1.8l-1 5.3c-.2.8-.9 1.4-1.7 1.4H5V6.6zM1.5 6.6H4V14H1.5a.5.5 0 0 1-.5-.5v-6.4c0-.3.2-.5.5-.5"/></svg>';
const DOWN = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" style="transform:rotate(180deg)"><path fill="currentColor" d="M6.3 1.6c.3-.6 1.1-.8 1.6-.4.6.4.9 1.1.8 1.8L8.4 5.5h4.3c1 0 1.7.9 1.5 1.8l-1 5.3c-.2.8-.9 1.4-1.7 1.4H5V6.6zM1.5 6.6H4V14H1.5a.5.5 0 0 1-.5-.5v-6.4c0-.3.2-.5.5-.5"/></svg>';

async function getStore() {
  const r = await chrome.storage.local.get(['goldenRecent', 'goldenRatings']);
  return { recent: r.goldenRecent || [], ratings: r.goldenRatings || {} };
}

// opts: { count, heading, ensure, cats }
export function mountGolden(section, opts = {}) {
  const { count = 3, heading = 'Somewhere a feed would never take you', ensure = null, cats, compact = false } = opts;
  section.classList.add('golden');
  if (compact) section.classList.add('compact');
  section.innerHTML = `
    <div class="golden-head">
      <h2>${esc(heading)}</h2>
      <button class="btn quiet" data-act="shuffle">Shuffle</button>
    </div>
    <ul></ul>
    <p class="golden-status" aria-live="polite"></p>`;
  const list = section.querySelector('ul');
  const status = section.querySelector('.golden-status');

  async function draw() {
    const { recent, ratings } = await getStore();
    const picks = pickGolden(count, { recent, ratings, ensure, cats });
    list.innerHTML = picks.map((p) => {
      const score = ratings[p.url] || 0;
      return `<li data-url="${esc(p.url)}">
        <div class="g-main">
          <a href="${esc(p.url)}">${esc(p.title)}</a>${p.also ? ` <span class="also">or <a href="${esc(p.also.url)}">${esc(p.also.title)}</a></span>` : ''}
          <span class="about"${p.lang ? ` lang="${esc(p.lang)}"` : ''}>${esc(p.about)}</span>
          <span class="meta">${esc(p.categoryLabel)}, ${esc(domainOf(p.url))}${p.lang === 'pl' ? ', po polsku' : ''}</span>
        </div>
        <div class="thumbs">
          <button class="thumb" data-dir="1" aria-pressed="${score > 0}" title="Show more often${score > 0 ? ` (liked ${score}×)` : ''}" aria-label="More like ${esc(p.title)}">${UP}</button>
          <button class="thumb" data-dir="-1" aria-pressed="${score < 0}" title="Show less often" aria-label="Less of ${esc(p.title)}">${DOWN}</button>
        </div>
      </li>`;
    }).join('');
    const next = [...recent.filter((u) => !picks.some((p) => p.url === u)), ...picks.map((p) => p.url)].slice(-40);
    await chrome.storage.local.set({ goldenRecent: next });
  }

  section.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'shuffle') { status.textContent = ''; draw(); return; }
    if (!b.dataset.dir) return;
    const li = b.closest('li');
    const url = li.dataset.url;
    const dir = Number(b.dataset.dir);
    const { ratings } = await getStore();
    const updated = rate(ratings, url, dir);
    await chrome.storage.local.set({ goldenRatings: updated });
    const score = updated[url] || 0;
    const name = li.querySelector('a').textContent;
    li.querySelector('[data-dir="1"]').setAttribute('aria-pressed', String(score > 0));
    li.querySelector('[data-dir="-1"]').setAttribute('aria-pressed', String(score < 0));
    if (score <= -2) {
      li.classList.add('gone');
      status.textContent = `${name} is hidden. Bring it back in Settings.`;
    } else if (score < 0) {
      li.classList.add('dim');
      status.textContent = `${name} will show up rarely now.`;
    } else if (score > 0) {
      li.classList.remove('dim');
      status.textContent = `${name} will show up ${score + 1}× as often.`;
    } else {
      li.classList.remove('dim');
      status.textContent = `${name} is back to normal.`;
    }
  });

  draw();
}
