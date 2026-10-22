import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCreateCommands, buildReorderCommand, siblingsOf, targetGroups, defaultParent, quickDates, validate, labelsFor } from '../taskform.js';

let n = 0;
const uuid = () => `u${++n}`;
const snap = {
  projects: [
    { id: 'inbox', name: 'Inbox', inbox_project: true },
    { id: 'big', name: 'Big Projects', child_order: 1 },
    { id: 'life', name: 'Life', child_order: 2 },
    { id: 'work', name: 'Work', child_order: 3 },
  ],
  sections: [
    { id: 'go', name: 'Gokart', project_id: 'big', section_order: 2 },
    { id: 'sat', name: 'Satellite', project_id: 'big', section_order: 1 },
    { id: 'home', name: 'Home', project_id: 'life', section_order: 1 },
  ],
  tasks: [
    { id: 'a', project_id: 'big', section_id: 'go', child_order: 2, checked: false },
    { id: 'b', project_id: 'big', section_id: 'go', child_order: 1, checked: false },
    { id: 'b1', project_id: 'big', section_id: 'go', parent_id: 'b', child_order: 1, checked: false },
    { id: 'w', project_id: 'work', section_id: null, child_order: 1, checked: false },
  ],
};

test('target groups: sections grouped by project, then Inbox and loose projects', () => {
  const g = targetGroups(snap);
  assert.deepEqual(g.map((x) => x.label), ['Big Projects', 'Life', 'Other']);
  assert.deepEqual(g[0].targets.map((t) => t.name), ['Satellite', 'Gokart']);
  assert.deepEqual(g[2].targets.map((t) => t.name), ['Inbox', 'Work']);
  assert.equal(g[0].targets[1].id, 's:go', 'same ids as the new tab rows');
  assert.equal(defaultParent(snap).id, 'big');
});

test('full task: labels, floating due time, notes, steps under the parent', () => {
  const { commands, taskTemp } = buildCreateCommands({
    content: '  Order bearings ', description: 'SKF 6204', subtasks: ['- measure axle', '', '• compare prices'],
    target: { kind: 'section', projectId: 'big', sectionId: 'go' },
    estimate: '15m', low: true, dueDate: '2026-10-15', dueTime: '14:00', soft: false,
  }, uuid);
  assert.equal(commands.length, 3);
  const [task, s1, s2] = commands;
  assert.equal(task.type, 'item_add');
  assert.deepEqual(task.args, {
    content: 'Order bearings', project_id: 'big', section_id: 'go', description: 'SKF 6204',
    labels: ['15m', 'low'], due: { date: '2026-10-15T14:00:00' },
  });
  assert.equal(task.temp_id, taskTemp);
  assert.deepEqual([s1.args.content, s2.args.content], ['measure axle', 'compare prices']);
  assert.equal(s1.args.parent_id, taskTemp);
  assert.equal(s2.args.child_order, 2);
  assert.equal(s1.args.section_id, 'go');
});

test('soft only applies with a date; inbox task has no project id', () => {
  assert.deepEqual(labelsFor({ soft: true }), []);
  assert.deepEqual(labelsFor({ soft: true, dueDate: '2026-10-20' }), ['soft']);
  const { commands } = buildCreateCommands({ content: 'x', target: { kind: 'project', projectId: 'inbox', sectionId: null } }, uuid);
  assert.equal(commands[0].args.project_id, 'inbox');
  assert.equal(commands[0].args.due, undefined);
  assert.equal(commands[0].args.labels, undefined);
});

test('new project: section_add first, task points at its temp id', () => {
  const { commands, sectionTemp } = buildCreateCommands({
    content: 'Pick a mirror size', target: { kind: 'new', newName: ' Telescope ', parentProjectId: 'big' },
  }, uuid);
  assert.equal(commands[0].type, 'section_add');
  assert.deepEqual(commands[0].args, { name: 'Telescope', project_id: 'big' });
  assert.equal(commands[0].temp_id, sectionTemp);
  assert.equal(commands[1].args.section_id, sectionTemp);
  assert.equal(commands[1].args.project_id, 'big');
});

test('validation messages', () => {
  assert.match(validate({ content: ' ', target: {} }), /Write/);
  assert.match(validate({ content: 'x' }), /Pick a project/);
  assert.match(validate({ content: 'x', target: { kind: 'new', newName: '' } }), /Name/);
  assert.match(validate({ content: 'x', target: { kind: 'project', projectId: 'p' }, dueTime: '10:00' }), /date/);
  assert.throws(() => buildCreateCommands({ content: '' }, uuid));
});

test('next step: new task first, siblings keep their order, subtasks untouched', () => {
  const sib = siblingsOf(snap, { kind: 'section', projectId: 'big', sectionId: 'go' });
  assert.deepEqual(sib.map((t) => t.id).sort(), ['a', 'b']);
  const cmd = buildReorderCommand('NEW', sib, uuid);
  assert.equal(cmd.type, 'item_reorder');
  assert.deepEqual(cmd.args.items, [{ id: 'NEW', child_order: 1 }, { id: 'b', child_order: 2 }, { id: 'a', child_order: 3 }]);
  assert.deepEqual(siblingsOf(snap, { kind: 'project', projectId: 'work', sectionId: null }).map((t) => t.id), ['w']);
});

test('quick dates', () => {
  const tue = new Date(2026, 9, 13, 21, 0);
  const q = Object.fromEntries(quickDates(tue).map((x) => [x.key, x.date]));
  assert.deepEqual(q, { today: '2026-10-13', tomorrow: '2026-10-14', weekend: '2026-10-17', nextweek: '2026-10-19' });
  const sun = Object.fromEntries(quickDates(new Date(2026, 9, 18, 9)).map((x) => [x.key, x.date]));
  assert.equal(sun.weekend, '2026-10-24');
  assert.equal(sun.nextweek, '2026-10-19');
  const sat = Object.fromEntries(quickDates(new Date(2026, 9, 17, 9)).map((x) => [x.key, x.date]));
  assert.equal(sat.weekend, '2026-10-17');
});
