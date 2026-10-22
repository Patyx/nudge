// Top 3 picker. Picks are stored only in Nudge (Chrome sync storage), never in Todoist.
import { buildAreas, cleanTitle, minutesFromLabels, fmtMinutes, taskInArea } from './engine.js';
import { setTop, TOP_MAX } from './daily.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function loadTop3() {
  try { return (await chrome.storage.sync.get('top3')).top3 || {}; } catch { return {}; }
}
export async function saveTop3(stored) {
  try { await chrome.storage.sync.set({ top3: stored }); } catch { await chrome.storage.local.set({ top3: stored }); }
}

// opts: { dialog, getSnapshot, onSaved }
export function mountPicker({ dialog, getSnapshot, onSaved }) {
  let day = null;
  let chosen = [];
  let query = '';

  function groups() {
    const snap = getSnapshot();
    if (!snap) return [];
    const open = (snap.tasks || []).filter((t) => !t.checked && !t.parent_id);
    const areas = buildAreas(snap);
    const out = areas.map((a) => ({ name: a.name, tasks: open.filter((t) => taskInArea(t, a)).sort((x, y) => (x.child_order ?? 0) - (y.child_order ?? 0)) }));
    const inbox = (snap.projects || []).find((p) => p.inbox_project);
    if (inbox) out.unshift({ name: 'Inbox', tasks: open.filter((t) => t.project_id === inbox.id) });
    return out.filter((g) => g.tasks.length);
  }

  function render() {
    const q = query.trim().toLowerCase();
    const gs = groups().map((g) => ({ ...g, tasks: q ? g.tasks.filter((t) => cleanTitle(t.content).toLowerCase().includes(q) || g.name.toLowerCase().includes(q)) : g.tasks })).filter((g) => g.tasks.length);
    const snap = getSnapshot();
    const titleOf = (id) => cleanTitle((snap?.tasks || []).find((t) => t.id === id)?.content || '');
    const tomorrow = day !== null && day !== undefined && dialog.dataset.tomorrow === '1';
    dialog.innerHTML = `
      <div class="pick">
        <div class="add-head">
          <h2 id="pick-title">${tomorrow ? "Tomorrow's Top 3" : "Today's Top 3"}</h2>
          <button type="button" class="btn quiet" data-close>Esc</button>
        </div>
        <p class="hint">${tomorrow ? 'Decide now, start tomorrow without thinking.' : 'Up to three things that would make today count. Nudges will focus on these.'}</p>
        <ol class="pick-chosen">${chosen.map((id, i) => `<li><span>${esc(titleOf(id))}</span><button type="button" class="btn quiet" data-remove="${esc(id)}" aria-label="Remove">Remove</button></li>`).join('') || '<li class="empty">Nothing picked yet.</li>'}</ol>
        <input class="pick-search" type="search" placeholder="Search tasks" value="${esc(query)}" aria-label="Search tasks">
        <div class="pick-list">
          ${gs.map((g) => `<div class="pick-group"><span class="add-group-label">${esc(g.name)}</span>
            ${g.tasks.map((t) => {
              const on = chosen.includes(t.id);
              const m = minutesFromLabels(t.labels);
              return `<label class="pick-row ${on ? 'on' : ''}"><input type="checkbox" data-id="${esc(t.id)}" ${on ? 'checked' : ''} ${!on && chosen.length >= TOP_MAX ? 'disabled' : ''}>
                <span>${esc(cleanTitle(t.content))}</span>${m ? `<span class="est">${fmtMinutes(m)}</span>` : ''}</label>`;
            }).join('')}</div>`).join('') || '<p class="hint">No open tasks match.</p>'}
        </div>
        <div class="add-foot">
          <span class="hint">${chosen.length}/${TOP_MAX} picked</span>
          <button type="button" class="btn" data-close>Cancel</button>
          <button type="button" class="btn solid" data-save>Save</button>
        </div>
      </div>`;
  }

  dialog.addEventListener('click', async (e) => {
    if (e.target === dialog) { dialog.close(); return; }
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-close')) { dialog.close(); return; }
    if (b.dataset.remove) { chosen = chosen.filter((x) => x !== b.dataset.remove); render(); return; }
    if (b.hasAttribute('data-save')) {
      const stored = await loadTop3();
      await saveTop3(setTop(stored, chosen, day));
      dialog.close();
      onSaved?.(chosen, day);
    }
  });
  dialog.addEventListener('change', (e) => {
    const id = e.target.dataset?.id;
    if (!id) return;
    chosen = e.target.checked ? [...chosen, id].slice(0, TOP_MAX) : chosen.filter((x) => x !== id);
    render();
  });
  dialog.addEventListener('input', (e) => {
    if (!e.target.classList.contains('pick-search')) return;
    query = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const s = dialog.querySelector('.pick-search');
    s.focus(); s.setSelectionRange(pos, pos);
  });

  return {
    async open(targetDay, { tomorrow = false } = {}) {
      day = targetDay;
      const stored = await loadTop3();
      chosen = [...(stored[day] || [])];
      query = '';
      dialog.dataset.tomorrow = tomorrow ? '1' : '0';
      render();
      dialog.showModal();
      dialog.querySelector('.pick-search').focus();
    },
  };
}
