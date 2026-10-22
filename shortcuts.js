// Shortcut tiles, like Chrome's new tab. Stored in Chrome sync storage.
// icon: 'site' (the site's own icon), 'letter', or one of ICONS (an emoji).

const KEY = 'shortcuts';
export const ICONS = ['📧', '📁', '💬', '🗓️', '🛠️', '💻', '🚀', '🛰️', '📚', '✏️', '🎵', '🎮', '🛒', '🏠', '💼', '📈'];
const DEFAULTS = [
  { name: 'Gmail', url: 'https://mail.google.com/', icon: 'site' },
  { name: 'Calendar', url: 'https://calendar.google.com/', icon: 'site' },
  { name: 'Todoist', url: 'https://app.todoist.com/app/today', icon: 'site' },
];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const area = () => chrome.storage.sync || chrome.storage.local;

async function load() {
  try {
    const r = await area().get(KEY);
    if (Array.isArray(r[KEY])) return r[KEY];
  } catch {}
  return DEFAULTS.map((d, i) => ({ ...d, id: `d${i}` }));
}
async function save(list) {
  try { await area().set({ [KEY]: list }); } catch { await chrome.storage.local.set({ [KEY]: list }); }
}

function normalizeUrl(u) {
  u = (u || '').trim();
  if (!u) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = `https://${u}`;
  try { return new URL(u).href; } catch { return ''; }
}
const hostOf = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
const faviconUrl = (u) => `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(hostOf(u))}`;

function iconHtml(s) {
  if (s.icon === 'site' && hostOf(s.url)) {
    return `<img src="${esc(faviconUrl(s.url))}" alt="" data-letter="${esc((s.name || '?').trim()[0]?.toUpperCase() || '?')}">`;
  }
  if (s.icon && s.icon !== 'letter' && s.icon !== 'site') return `<span class="emoji">${esc(s.icon)}</span>`;
  return `<span class="letter">${esc((s.name || '?').trim()[0]?.toUpperCase() || '?')}</span>`;
}

export function mountShortcuts(section, dialog) {
  let list = [];
  let editing = null; // shortcut being edited, or {} for new

  async function render() {
    list = await load();
    section.innerHTML = `<div class="tiles">
      ${list.map((s) => `<div class="tile" data-id="${esc(s.id)}">
          <a href="${esc(s.url)}" title="${esc(s.url)}"><span class="ico">${iconHtml(s)}</span><span class="name">${esc(s.name)}</span></a>
          <button class="edit" data-edit="${esc(s.id)}" aria-label="Edit ${esc(s.name)}" title="Edit">⋮</button>
        </div>`).join('')}
      <button class="tile add" data-add aria-label="Add shortcut"><span class="ico"><span class="letter">+</span></span><span class="name">Add shortcut</span></button>
    </div>`;
    // A site with no icon gets its first letter instead.
    section.querySelectorAll('img[data-letter]').forEach((img) => {
      img.onerror = () => { img.outerHTML = `<span class="letter">${esc(img.dataset.letter)}</span>`; };
    });
  }

  function renderDialog() {
    const s = editing;
    const pickedIcon = s.icon || 'site';
    dialog.innerHTML = `<form class="sc-form" novalidate>
      <div class="add-head"><h2 id="sc-title">${s.id ? 'Edit shortcut' : 'Add shortcut'}</h2><button type="button" class="btn quiet" data-close>Esc</button></div>
      <label>Name <input name="name" type="text" autocomplete="off" value="${esc(s.name || '')}" required></label>
      <label>URL <input name="url" type="text" autocomplete="off" spellcheck="false" placeholder="example.com" value="${esc(s.url || '')}" required></label>
      <fieldset><legend>Icon</legend>
        <div class="sc-icons">
          <button type="button" class="sc-icon" data-icon="site" aria-pressed="${pickedIcon === 'site'}" title="Site's own icon">${hostOf(normalizeUrl(s.url)) ? `<img src="${esc(faviconUrl(normalizeUrl(s.url)))}" alt="">` : '🌐'}</button>
          <button type="button" class="sc-icon" data-icon="letter" aria-pressed="${pickedIcon === 'letter'}" title="First letter">${esc((s.name || 'A').trim()[0]?.toUpperCase() || 'A')}</button>
          ${ICONS.map((e) => `<button type="button" class="sc-icon" data-icon="${e}" aria-pressed="${pickedIcon === e}">${e}</button>`).join('')}
        </div>
      </fieldset>
      <p class="add-error" role="alert"></p>
      <div class="add-foot">
        ${s.id ? '<button type="button" class="btn quiet" data-delete>Remove</button>' : ''}
        <span class="hint"></span>
        <button type="button" class="btn" data-close>Cancel</button>
        <button type="submit" class="btn solid">Save</button>
      </div>
    </form>`;
  }

  function readForm() {
    const f = dialog.querySelector('form');
    editing.name = f.elements.name.value;
    editing.url = f.elements.url.value;
  }

  section.addEventListener('click', (e) => {
    const b = e.target.closest('[data-edit],[data-add]');
    if (!b) return;
    e.preventDefault();
    editing = b.dataset.edit ? { ...list.find((x) => x.id === b.dataset.edit) } : { icon: 'site' };
    renderDialog();
    dialog.showModal();
    dialog.querySelector('[name=name]').focus();
  });
  section.addEventListener('contextmenu', (e) => {
    const t = e.target.closest('.tile[data-id]');
    if (!t) return;
    e.preventDefault();
    t.querySelector('[data-edit]').click();
  });

  dialog.addEventListener('click', async (e) => {
    if (e.target === dialog) { dialog.close(); return; }
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-close')) { dialog.close(); return; }
    if (b.dataset.icon) { readForm(); editing.icon = b.dataset.icon; renderDialog(); return; }
    if (b.hasAttribute('data-delete')) {
      await save(list.filter((x) => x.id !== editing.id));
      dialog.close();
      render();
    }
  });
  // Update the icon previews in place, without redrawing the form.
  dialog.addEventListener('input', (e) => {
    if (e.target.name === 'name') {
      const l = dialog.querySelector('[data-icon="letter"]');
      if (l) l.textContent = (e.target.value.trim()[0] || 'A').toUpperCase();
    }
  });
  dialog.addEventListener('change', (e) => {
    if (e.target.name !== 'url') return;
    const u = normalizeUrl(e.target.value);
    const site = dialog.querySelector('[data-icon="site"]');
    if (site) site.innerHTML = hostOf(u) ? `<img src="${esc(faviconUrl(u))}" alt="">` : '🌐';
  });
  dialog.addEventListener('submit', async (e) => {
    e.preventDefault();
    readForm();
    const url = normalizeUrl(editing.url);
    const err = dialog.querySelector('.add-error');
    if (!editing.name.trim()) { err.textContent = 'Give it a name.'; return; }
    if (!url) { err.textContent = "That doesn't look like a web address."; return; }
    const item = { id: editing.id || `s${Date.now()}`, name: editing.name.trim(), url, icon: editing.icon || 'site' };
    const next = editing.id ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
    await save(next);
    dialog.close();
    render();
  });

  chrome.storage.onChanged?.addListener((changes) => { if (changes[KEY]) render(); });
  render();
}
