// Minimal Todoist API v1 client (https://developer.todoist.com/api/v1/).
const BASE = 'https://api.todoist.com/api/v1/';

function isoNoMs(d) {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

async function call(token, path, { method = 'GET', query, body } = {}) {
  if (!token) throw new Error('No Todoist token set');
  const url = new URL(path, BASE);
  if (query) for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 || res.status === 403) throw new Error('Todoist rejected the token');
  if (!res.ok) throw new Error(`Todoist ${res.status}`);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function paged(token, path, key, query = {}) {
  const out = [];
  let cursor = null;
  for (let i = 0; i < 25; i++) {
    const page = await call(token, path, { query: { ...query, limit: 200, cursor } });
    out.push(...(page?.[key] || []));
    cursor = page?.next_cursor;
    if (!cursor) break;
  }
  return out;
}

export async function fetchSnapshot(token, lookbackDays = 30) {
  const until = new Date();
  const since = new Date(until.getTime() - lookbackDays * 86400000);
  const [projects, sections, tasks, completed] = await Promise.all([
    paged(token, 'projects', 'results'),
    paged(token, 'sections', 'results'),
    paged(token, 'tasks', 'results'),
    paged(token, 'tasks/completed/by_completion_date', 'items', { since: isoNoMs(since), until: isoNoMs(until) }),
  ]);
  return { projects, sections, tasks, completed, completedLookbackDays: lookbackDays, fetchedAt: Date.now() };
}

export function addTask(token, args) {
  return call(token, 'tasks', { method: 'POST', body: args });
}

export function deleteTask(token, id) {
  return call(token, `tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function closeTask(token, id) {
  return call(token, `tasks/${encodeURIComponent(id)}/close`, { method: 'POST' });
}

// Sync API batch: [{type, uuid, temp_id?, args}] → {sync_status, temp_id_mapping}. Throws on the first failed command.
export async function syncCommands(token, commands) {
  const res = await call(token, 'sync', { method: 'POST', body: { commands } });
  for (const [, v] of Object.entries(res?.sync_status || {})) {
    if (v !== 'ok') {
      const why = v?.error_extra?.explanation || v?.error || 'Todoist refused the change';
      throw new Error(v?.error_extra?.max_count ? `${why} (limit ${v.error_extra.max_count})` : why);
    }
  }
  return res;
}

export function taskUrl(id) {
  return `https://app.todoist.com/app/task/${encodeURIComponent(id)}`;
}
