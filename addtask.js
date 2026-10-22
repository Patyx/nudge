// The add-task window on the new tab. Opens with the "+ Add task" button or the N key.
import { ESTIMATES, quickDates, targetGroups, defaultParent, validate } from './taskform.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function mountAddTask({ dialog, getSnapshot, onCreated }) {
  let form = null;

  function fresh(lastTargetId) {
    return {
      content: '', description: '', subtasks: [],
      targetId: lastTargetId || null, newName: '', parentProjectId: null,
      estimate: null, low: false, dueDate: null, dueTime: null, soft: false, nextStep: false,
    };
  }

  function findTarget(snapshot, id) {
    for (const g of targetGroups(snapshot)) for (const t of g.targets) if (t.id === id) return t;
    return null;
  }

  function chip(attr, value, label, on, extra = '') {
    return `<button type="button" class="chip-btn" ${attr}="${esc(value)}" aria-pressed="${on}" ${extra}>${esc(label)}</button>`;
  }

  function render() {
    const snap = getSnapshot();
    const groups = targetGroups(snap);
    const parentDefault = defaultParent(snap);
    if (!form.parentProjectId && parentDefault) form.parentProjectId = parentDefault.id;
    const parents = (snap?.projects || []).filter((p) => !p.inbox_project && !p.is_archived && !p.is_deleted);
    const target = form.targetId === 'new' ? null : findTarget(snap, form.targetId);
    const qd = quickDates();
    const quickOn = qd.find((q) => q.date === form.dueDate);

    dialog.innerHTML = `
      <form class="add" novalidate>
        <div class="add-head">
          <h2 id="add-title">New task</h2>
          <button type="button" class="btn quiet" data-close aria-label="Close">Esc</button>
        </div>

        <input class="add-content" name="content" type="text" autocomplete="off" placeholder="What's the next thing to do?" value="${esc(form.content)}" aria-labelledby="add-title" required>

        <fieldset>
          <legend>Project</legend>
          ${groups.map((g) => `<div class="add-group">
              <span class="add-group-label">${esc(g.label)}</span>
              <div class="chips">${g.targets.map((t) => chip('data-target', t.id, t.name, form.targetId === t.id)).join('')}</div>
            </div>`).join('')}
          <div class="add-group">
            <span class="add-group-label">New</span>
            <div class="chips">${chip('data-target', 'new', '+ New project', form.targetId === 'new')}</div>
          </div>
          ${form.targetId === 'new' ? `<div class="add-new">
              <label>Name <input name="newName" type="text" autocomplete="off" placeholder="e.g. Telescope" value="${esc(form.newName)}"></label>
              <label>inside <select name="parentProjectId">${parents.map((p) => `<option value="${esc(p.id)}" ${p.id === form.parentProjectId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
              <span class="hint">It becomes a section there, gets its own row on the new tab and is watched for staleness.</span>
            </div>` : ''}
        </fieldset>

        <fieldset class="add-row">
          <legend>Time</legend>
          <div class="chips">
            ${ESTIMATES.map((e) => chip('data-est', e, e, form.estimate === e)).join('')}
            <span class="sep" aria-hidden="true"></span>
            ${chip('data-toggle', 'low', 'Low energy', form.low)}
          </div>
        </fieldset>

        <fieldset class="add-row">
          <legend>Due</legend>
          <div class="chips">
            ${chip('data-date', '', 'None', !form.dueDate)}
            ${qd.map((q) => chip('data-date', q.date, q.label, form.dueDate === q.date)).join('')}
            <input type="date" name="dueDate" value="${esc(form.dueDate || '')}" aria-label="Pick a date" class="${form.dueDate && !quickOn ? 'on' : ''}">
            <input type="time" name="dueTime" value="${esc(form.dueTime || '')}" aria-label="Time (optional)" ${form.dueDate ? '' : 'disabled'}>
          </div>
          ${form.dueDate ? `<label class="check-line"><input type="checkbox" name="soft" ${form.soft ? 'checked' : ''}> Just a plan, not a deadline <span class="hint">(no deadline reminders)</span></label>` : ''}
        </fieldset>

        <label class="check-line next">
          <input type="checkbox" name="nextStep" ${form.nextStep ? 'checked' : ''} ${form.targetId === 'new' ? 'disabled' : ''}>
          Make it the next step${target ? ` in ${esc(target.name)}` : ''}
          <span class="hint">${form.targetId === 'new' ? '(it will be the only step anyway)' : '(puts it at the top, otherwise it joins the end)'}</span>
        </label>

        <details ${form.description ? 'open' : ''}>
          <summary>Notes</summary>
          <textarea name="description" rows="3" placeholder="Links, details, anything you'll want later">${esc(form.description)}</textarea>
        </details>
        <details ${form.subtasks.length ? 'open' : ''}>
          <summary>Steps</summary>
          <textarea name="subtasks" rows="4" placeholder="One per line. They become subtasks.">${esc(form.subtasks.join('\n'))}</textarea>
        </details>

        <p class="add-error" role="alert"></p>
        <div class="add-foot">
          <span class="hint">Enter adds. Ctrl+Enter from anywhere in the form.</span>
          <button type="button" class="btn" data-close>Cancel</button>
          <button type="submit" class="btn solid">Add task</button>
        </div>
      </form>`;
  }

  // Pull typed values into `form` before any re-render, so nothing typed is lost.
  function readInputs() {
    const f = dialog.querySelector('form');
    if (!f) return;
    const v = (n) => f.elements[n];
    form.content = v('content')?.value ?? form.content;
    if (v('newName')) form.newName = v('newName').value;
    if (v('parentProjectId')) form.parentProjectId = v('parentProjectId').value;
    if (v('dueDate')) form.dueDate = v('dueDate').value || null;
    if (v('dueTime')) form.dueTime = form.dueDate ? (v('dueTime').value || null) : null;
    if (v('soft')) form.soft = v('soft').checked;
    if (v('nextStep')) form.nextStep = v('nextStep').checked;
    if (v('description')) form.description = v('description').value;
    if (v('subtasks')) form.subtasks = v('subtasks').value.split('\n').filter((x) => x.trim());
  }

  function rerender(focusSel) {
    const active = focusSel || (document.activeElement?.name ? `[name="${document.activeElement.name}"]` : null);
    render();
    const el = active && dialog.querySelector(active);
    if (el) el.focus();
  }

  function payload() {
    const snap = getSnapshot();
    const t = form.targetId === 'new'
      ? { kind: 'new', newName: form.newName, parentProjectId: form.parentProjectId }
      : (() => { const x = findTarget(snap, form.targetId); return x ? { kind: x.sectionId ? 'section' : 'project', projectId: x.projectId, sectionId: x.sectionId } : null; })();
    return {
      content: form.content, description: form.description, subtasks: form.subtasks,
      target: t, estimate: form.estimate, low: form.low,
      dueDate: form.dueDate, dueTime: form.dueTime, soft: form.soft, nextStep: form.nextStep && form.targetId !== 'new',
    };
  }

  async function submit() {
    readInputs();
    const p = payload();
    const errEl = dialog.querySelector('.add-error');
    const err = validate(p);
    if (err) { errEl.textContent = err; return; }
    const btn = dialog.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Adding…'; errEl.textContent = '';
    const r = await chrome.runtime.sendMessage({ type: 'createTask', form: p });
    if (r?.error === 'unknown message') {
      errEl.innerHTML = 'Chrome is still running the old Nudge in the background. <button type="button" class="btn" data-reload>Reload Nudge</button> then add the task again. Copy the text first: reloading closes this tab.';
      btn.disabled = false; btn.textContent = 'Add task';
      return;
    }
    if (!r || r.error) {
      errEl.textContent = `${r?.error || 'Something went wrong'}. Nothing was lost; try again.`;
      btn.disabled = false; btn.textContent = 'Add task';
      return;
    }
    const keepTarget = form.targetId === 'new' && r.sectionId ? `s:${r.sectionId}` : form.targetId;
    await chrome.storage.local.set({ lastAddTarget: keepTarget });
    const where = form.targetId === 'new' ? form.newName.trim() : (findTarget(getSnapshot(), form.targetId)?.name || 'Todoist');
    dialog.close();
    onCreated?.({ ...r, where, content: p.content.trim(), nextStep: p.nextStep });
  }

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) { dialog.close(); return; }
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-close')) { dialog.close(); return; }
    if (b.hasAttribute('data-reload')) { chrome.runtime.reload(); return; }
    readInputs();
    if (b.dataset.target !== undefined) {
      form.targetId = form.targetId === b.dataset.target ? null : b.dataset.target;
      rerender(form.targetId === 'new' ? '[name="newName"]' : '[name="content"]');
    } else if (b.dataset.est !== undefined) {
      form.estimate = form.estimate === b.dataset.est ? null : b.dataset.est;
      rerender('[name="content"]');
    } else if (b.dataset.toggle === 'low') {
      form.low = !form.low;
      rerender('[name="content"]');
    } else if (b.dataset.date !== undefined) {
      form.dueDate = b.dataset.date || null;
      if (!form.dueDate) { form.dueTime = null; form.soft = false; }
      rerender('[name="content"]');
    }
  });

  dialog.addEventListener('change', (e) => {
    if (['dueDate', 'parentProjectId'].includes(e.target.name)) { readInputs(); rerender(`[name="${e.target.name}"]`); }
    else if (e.target.name === 'nextStep' || e.target.name === 'soft') readInputs();
  });

  dialog.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); }
  });

  async function open(preset = {}) {
    const last = (await chrome.storage.local.get('lastAddTarget')).lastAddTarget;
    const snap = getSnapshot();
    const lastValid = last && findTarget(snap, last) ? last : null;
    form = { ...fresh(preset.targetId || lastValid), ...preset };
    render();
    dialog.showModal();
    dialog.querySelector('[name="content"]').focus();
  }

  return { open };
}
