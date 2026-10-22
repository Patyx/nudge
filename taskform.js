// Turns the add-task form into Todoist Sync API commands. Pure, so it can be tested.
// https://developer.todoist.com/api/v1/#tag/Sync

export const ESTIMATES = ['2m', '15m', '30m', '1h', '2h', '3h'];

const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Quick date chips. Weekend = the coming Saturday (today if it is Saturday).
export function quickDates(now = new Date()) {
  const at = (days) => { const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + days); return d; };
  const dow = now.getDay(); // 0 Sun .. 6 Sat
  const toSat = (6 - dow + 7) % 7;
  const toMon = ((1 - dow + 7) % 7) || 7;
  return [
    { key: 'today', label: 'Today', date: isoDate(at(0)) },
    { key: 'tomorrow', label: 'Tomorrow', date: isoDate(at(1)) },
    { key: 'weekend', label: dow === 0 ? 'Next weekend' : 'Weekend', date: isoDate(at(dow === 0 ? 6 : toSat)) },
    { key: 'nextweek', label: 'Next week', date: isoDate(at(toMon)) },
  ];
}

// Target choices for the project picker, grouped the way you think about them.
export function targetGroups(snapshot) {
  const projects = (snapshot?.projects || []).filter((p) => !p.is_archived && !p.is_deleted);
  const sections = (snapshot?.sections || []).filter((s) => !s.is_archived && !s.is_deleted);
  const inbox = projects.find((p) => p.inbox_project);
  const groups = [];
  const loose = [];
  for (const p of projects.filter((x) => !x.inbox_project).sort((a, b) => (a.child_order ?? 0) - (b.child_order ?? 0))) {
    const secs = sections.filter((s) => s.project_id === p.id).sort((a, b) => (a.section_order ?? 0) - (b.section_order ?? 0));
    if (secs.length) {
      groups.push({ label: p.name, targets: secs.map((s) => ({ id: `s:${s.id}`, name: s.name, projectId: p.id, sectionId: s.id })) });
    } else {
      loose.push({ id: `p:${p.id}`, name: p.name, projectId: p.id, sectionId: null });
    }
  }
  const tail = [];
  if (inbox) tail.push({ id: `p:${inbox.id}`, name: 'Inbox', projectId: inbox.id, sectionId: null, inbox: true });
  tail.push(...loose);
  if (tail.length) groups.push({ label: groups.length ? 'Other' : 'Projects', targets: tail });
  return groups;
}

// Where new projects go by default: a project named like "Big Projects", else the first with sections.
export function defaultParent(snapshot) {
  const projects = (snapshot?.projects || []).filter((p) => !p.inbox_project && !p.is_archived && !p.is_deleted);
  return projects.find((p) => /project/i.test(p.name)) || projects.find((p) => (snapshot.sections || []).some((s) => s.project_id === p.id)) || projects[0] || null;
}

export function labelsFor(form) {
  const out = [];
  if (form.estimate) out.push(form.estimate);
  if (form.low) out.push('low');
  if (form.soft && form.dueDate) out.push('soft');
  return out;
}

export function dueFor(form) {
  if (!form.dueDate) return null;
  // Floating local time: Todoist keeps "14:00" as 14:00 wherever you are.
  return { date: form.dueTime ? `${form.dueDate}T${form.dueTime}:00` : form.dueDate };
}

export function validate(form) {
  if (!form.content || !form.content.trim()) return 'Write what the task is.';
  if (!form.target) return 'Pick a project.';
  if (form.target.kind === 'new') {
    if (!form.target.newName?.trim()) return 'Name the new project.';
    if (!form.target.parentProjectId) return 'Choose where the new project lives.';
  }
  if (form.dueTime && !form.dueDate) return 'Pick a date for that time.';
  return null;
}

// Phase 1: one batch that creates the section (if new), the task and its steps.
// uuid: () => string
export function buildCreateCommands(form, uuid) {
  const err = validate(form);
  if (err) throw new Error(err);
  const commands = [];
  const t = form.target;
  let projectId = t.projectId || null;
  let sectionId = t.sectionId || null;
  let sectionTemp = null;

  if (t.kind === 'new') {
    sectionTemp = uuid();
    projectId = t.parentProjectId;
    sectionId = sectionTemp;
    commands.push({ type: 'section_add', temp_id: sectionTemp, uuid: uuid(), args: { name: t.newName.trim(), project_id: projectId } });
  }

  const taskTemp = uuid();
  const args = { content: form.content.trim() };
  if (projectId) args.project_id = projectId;
  if (sectionId) args.section_id = sectionId;
  const desc = (form.description || '').trim();
  if (desc) args.description = desc;
  const labels = labelsFor(form);
  if (labels.length) args.labels = labels;
  const due = dueFor(form);
  if (due) args.due = due;
  commands.push({ type: 'item_add', temp_id: taskTemp, uuid: uuid(), args });

  const steps = (form.subtasks || []).map((s) => s.replace(/^[-*•\s]+/, '').trim()).filter(Boolean).slice(0, 30);
  steps.forEach((content, i) => {
    const a = { content, parent_id: taskTemp, child_order: i + 1 };
    if (projectId) a.project_id = projectId;
    if (sectionId) a.section_id = sectionId;
    commands.push({ type: 'item_add', temp_id: uuid(), uuid: uuid(), args: a });
  });

  return { commands, taskTemp, sectionTemp, steps: steps.length };
}

// Phase 2 (optional): put the new task first so it becomes the next step.
// siblings: open top-level tasks already in that section/project.
export function buildReorderCommand(newTaskId, siblings, uuid) {
  const ordered = [...siblings].sort((a, b) => (a.child_order ?? 0) - (b.child_order ?? 0));
  const items = [{ id: newTaskId, child_order: 1 }, ...ordered.map((t, i) => ({ id: t.id, child_order: i + 2 }))];
  return { type: 'item_reorder', uuid: uuid(), args: { items } };
}

export function siblingsOf(snapshot, target) {
  if (!target || target.kind === 'new') return [];
  return (snapshot?.tasks || []).filter((x) => !x.checked && !x.parent_id &&
    (target.sectionId ? x.section_id === target.sectionId : (x.project_id === target.projectId && !x.section_id)));
}
