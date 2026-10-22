// Spotify corner, shared by the new tab and the pause screen.
import { MOODS, moodLink, SPOTIFY_HOME } from './music.js';

const NOTE = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M6 2.5 14 1v9.2a2.3 2.3 0 1 1-1.3-2V4.2L7.3 5.2v6.6A2.3 2.3 0 1 1 6 9.8z"/></svg>';

export function mountSpotifyCorner(root = document.body) {
  const wrap = document.createElement('div');
  wrap.className = 'spotify';
  wrap.innerHTML = `
    <div class="spotify-panel" id="spotify-panel" hidden>
      <div class="moods">
        ${Object.entries(MOODS).map(([k, m]) => `<button class="btn" data-mood="${k}">${m.label}</button>`).join('')}
        <button class="btn" data-mood="surprise">Surprise me</button>
      </div>
      <p class="spotify-note" id="spotify-note">Opens a fresh playlist search, not your usual rotation.</p>
      <a class="spotify-home" href="${SPOTIFY_HOME}" target="_blank" rel="noopener">Open Spotify</a>
    </div>
    <button class="btn spotify-toggle" id="spotify-toggle" aria-expanded="false" aria-controls="spotify-panel">${NOTE}<span>Music</span></button>`;
  root.appendChild(wrap);

  const panel = wrap.querySelector('#spotify-panel');
  const toggle = wrap.querySelector('#spotify-toggle');
  const note = wrap.querySelector('#spotify-note');
  const setOpen = (open) => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.onclick = () => setOpen(panel.hidden);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) setOpen(false); });

  wrap.querySelectorAll('[data-mood]').forEach((b) => (b.onclick = () => {
    const link = moodLink(b.dataset.mood);
    note.textContent = b.dataset.mood === 'surprise'
      ? `Tonight's detour: ${link.label}. Click again for another.`
      : `Searching "${link.label}".`;
    window.open(link.url, '_blank', 'noopener');
  }));
}
