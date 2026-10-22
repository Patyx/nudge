// One sticky note. Saved as you type. Uses Chrome sync storage, so it follows you
// to any Chrome signed in to the same account; falls back to local storage.
const KEY = 'postit';
const area = () => chrome.storage.sync || chrome.storage.local;

export async function mountPostit(el) {
  el.classList.add('postit');
  el.innerHTML = `
    <label for="postit-text">Note</label>
    <textarea id="postit-text" spellcheck="true" placeholder="Quick note. Saved as you type."></textarea>
    <span class="postit-status" aria-live="polite"></span>`;
  const ta = el.querySelector('textarea');
  const status = el.querySelector('.postit-status');

  try {
    const r = await area().get(KEY);
    ta.value = r[KEY] || '';
  } catch {
    const r = await chrome.storage.local.get(KEY);
    ta.value = r[KEY] || '';
  }

  let timer = null;
  const save = async () => {
    const text = ta.value.slice(0, 7000); // sync storage allows ~8 KB per item
    try { await area().set({ [KEY]: text }); } catch { await chrome.storage.local.set({ [KEY]: text }); }
    status.textContent = 'Saved';
    setTimeout(() => { status.textContent = ''; }, 1200);
  };
  ta.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(save, 500); });
  ta.addEventListener('blur', () => { clearTimeout(timer); save(); });

  // Another tab or device edited it.
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[KEY] && document.activeElement !== ta) ta.value = changes[KEY].newValue || '';
  });
}
