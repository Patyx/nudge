// Weekly review: a short guided pass. Five steps, in order.
import { computeState, cleanTitle } from './engine.js';
import { reviewData } from './daily.js';
import { fmtDuration } from './tracking.js';
import { targetGroups } from './taskform.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STEPS = ['The week', 'Inbox', 'Projects', 'Stuck steps', 'Next week'];

// opts: { dialog, getData, reload, openAdd, openPicker }
export function mountReview({ dialog, getData, reload, openAdd, openPicker }) {
  let step = 0;
  const handled = new Set();

  function view() {
    const data = getData();
    if (!data?.snapshot) return null;
    const state = computeState(data.snapshot, data.settings);
    return { data, state, r: reviewData(state, state.settings, data.focusLog, data.breakLog) };
  }

  function body(v) {
    const { state, r } = v;
    if (step === 0) {
      return `<p class="review-big"><b>${r.done.length}</b> done, <b>${fmtDuration(r.focus)}</b> focused, <b>${fmtDuration(r.brk)}</b> on breaks.</p>
        <ul class="review-list">${r.byArea.map((x) => `<li><span>${esc(x.area.name)}</span><span class="${x.done ? 'good' : 'warn'}">${x.done ? `${x.done} done` : 'nothing done'}</span></li>`).join('')}</ul>
        <p class="hint">No judgement. Just look at where the week actually went.</p>`;
    }
    if (step === 1) {
      const items = r.inbox.filter((t) => !handled.has(t.id));
      const groups = targetGroups(v.data.snapshot).flatMap((g) => g.targets.filter((t) => !t.inbox).map((t) => ({ ...t, group: g.label })));
      if (!items.length) return '<p class="review-big">Inbox is empty.</p><p class="hint">Everything has a home.</p>';
      return `<p class="hint">Give each one a home, finish it, or let it go.</p>
        <ul class="review-items">${items.map((t) => `<li data-id="${esc(t.id)}">
          <span class="t">${esc(cleanTitle(t.content))}</span>
          <select data-move aria-label="Move to project"><option value="">Move to…</option>${groups.map((g) => `<option value="${esc(g.id)}">${esc(g.group === g.name ? g.name : `${g.group}: ${g.name}`)}</option>`).join('')}</select>
          <button class="btn quiet" data-act="done">Done</button>
          <button class="btn quiet" data-act="delete">Delete</button>
        </li>`).join('')}</ul>`;
    }
    if (step === 2) {
      const areas = state.areas.filter((a) => a.tracked);
      return `<p class="hint">Every project needs one clear next step. Is it still the right one?</p>
        <ul class="review-items">${areas.map((a) => `<li>
          <span class="name">${esc(a.name)}</span>
          <span class="t">${a.next ? esc(cleanTitle(a.next.content)) : '<i>No next step</i>'}</span>
          <button class="btn quiet" data-add="${esc(a.id)}">${a.next ? 'New next step' : 'Write one'}</button>
        </li>`).join('')}</ul>`;
    }
    if (step === 3) {
      const items = r.stuck.filter((x) => !handled.has(x.task.id));
      if (!items.length) return '<p class="review-big">Nothing stuck.</p><p class="hint">Every next step is fresh.</p>';
      return `<p class="hint">These have sat at the top for a week or more. Usually they're too big or unclear. Split, finish, or drop them.</p>
        <ul class="review-items">${items.map((x) => `<li data-id="${esc(x.task.id)}">
          <span class="name">${esc(x.area.name)}</span>
          <span class="t">${esc(cleanTitle(x.task.content))} <span class="hint">${x.age} days</span></span>
          <button class="btn quiet" data-split="${esc(x.area.id)}">Split</button>
          <button class="btn quiet" data-act="done">Done</button>
          <button class="btn quiet" data-act="delete">Delete</button>
        </li>`).join('')}</ul>`;
    }
    return `<p class="review-big">Last step: pick what Monday starts with.</p>
      <p class="hint">Choose up to three for tomorrow, then you're done for the week.</p>
      <div class="actions"><button class="btn" data-pick>Pick tomorrow's Top 3</button></div>`;
  }

  function render() {
    const v = view();
    dialog.innerHTML = `<div class="review">
      <div class="add-head"><h2 id="review-title">Weekly review</h2><button class="btn quiet" data-close>Esc</button></div>
      <ol class="review-steps">${STEPS.map((s, i) => `<li class="${i === step ? 'on' : i < step ? 'past' : ''}">${esc(s)}</li>`).join('')}</ol>
      <div class="review-body">${v ? body(v) : '<p>Connect Todoist first.</p>'}</div>
      <p class="add-error" role="alert"></p>
      <div class="add-foot">
        ${step > 0 ? '<button class="btn quiet" data-back>Back</button>' : ''}
        <span class="hint">Step ${step + 1} of ${STEPS.length}</span>
        ${step < STEPS.length - 1 ? '<button class="btn solid" data-next>Next</button>' : '<button class="btn solid" data-finish>Finish review</button>'}
      </div>
    </div>`;
  }

  async function act(msg, li) {
    const err = dialog.querySelector('.add-error');
    li?.classList.add('busy');
    const r = await chrome.runtime.sendMessage(msg);
    if (r?.error) { err.textContent = r.error; li?.classList.remove('busy'); return false; }
    handled.add(msg.taskId);
    await reload();
    render();
    return true;
  }

  dialog.addEventListener('click', async (e) => {
    if (e.target === dialog) { dialog.close(); return; }
    const b = e.target.closest('button');
    if (!b) return;
    const li = b.closest('li[data-id]');
    if (b.hasAttribute('data-close')) dialog.close();
    else if (b.hasAttribute('data-next')) { step++; render(); }
    else if (b.hasAttribute('data-back')) { step--; render(); }
    else if (b.hasAttribute('data-finish')) {
      await chrome.runtime.sendMessage({ type: 'reviewDone' });
      dialog.close();
      reload();
    } else if (b.dataset.act === 'done') act({ type: 'complete', taskId: li.dataset.id }, li);
    else if (b.dataset.act === 'delete') act({ type: 'deleteTask', taskId: li.dataset.id }, li);
    else if (b.dataset.add || b.dataset.split) { dialog.close(); openAdd(b.dataset.add || b.dataset.split); }
    else if (b.hasAttribute('data-pick')) { dialog.close(); openPicker(); }
  });

  dialog.addEventListener('change', (e) => {
    if (!e.target.hasAttribute('data-move') || !e.target.value) return;
    const li = e.target.closest('li[data-id]');
    const [kind, id] = e.target.value.split(':');
    const snap = getData().snapshot;
    const sec = kind === 's' ? snap.sections.find((s) => s.id === id) : null;
    act({ type: 'moveTask', taskId: li.dataset.id, sectionId: sec ? sec.id : null, projectId: sec ? sec.project_id : id }, li);
  });

  return {
    open() { step = 0; handled.clear(); render(); dialog.showModal(); },
  };
}
