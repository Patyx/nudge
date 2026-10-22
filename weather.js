// Weather next to the date: now and tomorrow, from Open-Meteo (free, no key).
// The place is picked in Settings and stored in Chrome sync as weatherPlace. Cached for 30 minutes.

export const PLACE_KEY = 'weatherPlace';
const KEY = 'weatherCache';
const MAX_AGE = 30 * 60 * 1000;

const forecastUrl = (p) => `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}`
  + '&current=temperature_2m,weather_code'
  + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
  + '&timezone=auto&forecast_days=2';

const syncArea = () => chrome.storage.sync || chrome.storage.local;

export async function loadPlace() {
  try { return (await syncArea().get(PLACE_KEY))[PLACE_KEY] || null; } catch { return null; }
}
export async function savePlace(place) {
  if (place) await syncArea().set({ [PLACE_KEY]: place });
  else await syncArea().remove(PLACE_KEY);
  try { await chrome.storage.local.remove(KEY); } catch {}
}

// City search for the Settings page.
export async function searchPlaces(q) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&format=json`);
  if (!r.ok) throw new Error(`search ${r.status}`);
  const j = await r.json();
  return (j.results || []).map((x) => ({ name: x.name, lat: x.latitude, lon: x.longitude, admin: x.admin1 || '', country: x.country || '' }));
}

// WMO weather codes -> [icon, words]
function describe(code) {
  if (code === 0) return ['☀️', 'clear'];
  if (code <= 2) return ['🌤️', 'partly cloudy'];
  if (code === 3) return ['☁️', 'overcast'];
  if (code <= 48) return ['🌫️', 'fog'];
  if (code <= 57) return ['🌦️', 'drizzle'];
  if (code <= 67) return ['🌧️', 'rain'];
  if (code <= 77) return ['🌨️', 'snow'];
  if (code <= 82) return ['🌧️', 'showers'];
  if (code <= 86) return ['🌨️', 'snow showers'];
  return ['⛈️', 'thunderstorm'];
}

async function fetchWeather(place) {
  const where = `${place.lat},${place.lon}`;
  try {
    const c = (await chrome.storage.local.get(KEY))[KEY];
    if (c && c.where === where && Date.now() - c.at < MAX_AGE) return c.data;
  } catch {}
  const r = await fetch(forecastUrl(place));
  if (!r.ok) throw new Error(`weather ${r.status}`);
  const data = await r.json();
  try { await chrome.storage.local.set({ [KEY]: { at: Date.now(), where, data } }); } catch {}
  return data;
}

const deg = (n) => `${Math.round(n)}°`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function mountWeather(el) {
  const PLACE = await loadPlace();
  if (!PLACE) { el.textContent = ''; return; } // no place chosen in Settings
  try {
    const w = await fetchWeather(PLACE);
    const [nowIcon, nowWords] = describe(w.current.weather_code);
    const d = w.daily;
    const [tIcon, tWords] = describe(d.weather_code[1]);
    const rain = d.precipitation_probability_max?.[1];
    el.innerHTML = `<span title="${esc(PLACE.name)} now: ${nowWords}">${nowIcon} ${deg(w.current.temperature_2m)}</span>`
      + `<span class="sep">·</span>`
      + `<span title="${esc(PLACE.name)} tomorrow: ${tWords}">Tomorrow ${tIcon} ${deg(d.temperature_2m_min[1])}–${deg(d.temperature_2m_max[1])}${rain >= 20 ? `, ${rain}% rain` : ''}</span>`;
  } catch {
    el.textContent = '';
  }
}
