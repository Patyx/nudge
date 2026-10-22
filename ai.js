// Optional: let Claude word the nudge. Falls back to the rule-based text on any failure.
import { aiPayload, AI_SYSTEM } from './engine.js';

export async function aiWord(settings, state, cands, mode, fallback) {
  if (!settings.aiEnabled || !settings.anthropicKey) return fallback;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': settings.anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: settings.aiModel || 'claude-haiku-5-5',
        max_tokens: 300,
        system: AI_SYSTEM,
        messages: [{ role: 'user', content: JSON.stringify(aiPayload(state, cands, mode)) }],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Claude API ${res.status}`);
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    if (!json.title || !json.body) throw new Error('bad shape');
    return { ...fallback, title: String(json.title).slice(0, 60), body: String(json.body).slice(0, 220), ai: true };
  } catch (e) {
    console.warn('AI nudge failed, using built-in text:', e.message);
    return fallback;
  }
}
