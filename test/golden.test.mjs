import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOLDEN, pickGolden, domainOf, rate, weightOf, allSites } from '../golden.js';
import { MOODS, GENRES, moodLink, spotifySearchUrl } from '../music.js';
import { rngFrom } from '../voice.js';
import { TIPS, tipFor } from '../wellness.js';

test('every golden site is well-formed https with a short description', () => {
  const urls = new Set();
  for (const [cat, { label, sites }] of Object.entries(GOLDEN)) {
    assert.ok(label && sites.length >= 4, cat);
    for (const s of sites) {
      assert.match(s.url, /^https:\/\/[^\s]+$/, s.url);
      assert.ok(!urls.has(s.url), `duplicate ${s.url}`);
      urls.add(s.url);
      assert.ok(s.title.length <= 50, s.title);
      assert.ok(s.about.length >= 20 && s.about.length <= 120, `${s.title}: ${s.about.length}`);
      if (s.also) { assert.match(s.also.url, /^https:\/\//); assert.ok(!urls.has(s.also.url)); urls.add(s.also.url); }
      if (s.lang) assert.equal(s.lang, 'pl');
    }
  }
});

test('pickGolden: distinct categories, avoids recent, falls back when all recent', () => {
  const p = pickGolden(3, { rand: rngFrom('x') });
  assert.equal(p.length, 3);
  assert.equal(new Set(p.map((x) => x.category)).size, 3);
  const allMusic = GOLDEN.music.sites.map((s) => s.url);
  const m = pickGolden(1, { recent: allMusic.slice(0, -1), rand: rngFrom('y'), cats: ['music'] });
  assert.equal(m[0].url, allMusic.at(-1), 'only the unseen one is offered');
  const fb = pickGolden(1, { recent: allMusic, rand: rngFrom('z'), cats: ['music'] });
  assert.ok(allMusic.includes(fb[0].url), 'falls back to any when all seen');
  for (let i = 0; i < 200; i++) {
    const r = pickGolden(3, { rand: rngFrom(i) });
    assert.equal(new Set(r.map((x) => x.url)).size, 3);
  }
});

test('ensure puts a category first (YouTube → music)', () => {
  for (let i = 0; i < 50; i++) assert.equal(pickGolden(3, { rand: rngFrom(i), ensure: 'music' })[0].category, 'music');
});

test('rate: steps, caps, and clears at zero', () => {
  let r = {};
  r = rate(r, 'a', 1); r = rate(r, 'a', 1); r = rate(r, 'a', 1); r = rate(r, 'a', 1);
  assert.equal(r.a, 3, 'capped at +3');
  r = rate(r, 'b', -1); r = rate(r, 'b', -1); r = rate(r, 'b', -1);
  assert.equal(r.b, -2, 'capped at -2');
  r = rate(r, 'b', 1); r = rate(r, 'b', 1);
  assert.ok(!('b' in r), 'zero is removed');
  assert.deepEqual([weightOf(-2), weightOf(-1), weightOf(0), weightOf(1), weightOf(3)], [0, 0.15, 1, 2, 4]);
});

function freq(ratings, url, cats, n = 4000) {
  let hits = 0;
  const rand = rngFrom('freq');
  for (let i = 0; i < n; i++) if (pickGolden(1, { ratings, rand, cats }).some((p) => p.url === url)) hits++;
  return hits / n;
}

test('thumbs change how often a site appears', () => {
  const url = GOLDEN.live.sites.find((s) => s.title === 'WindowSwap').url;
  const base = freq({}, url, ['live']);
  const liked = freq({ [url]: 3 }, url, ['live']);
  const rare = freq({ [url]: -1 }, url, ['live']);
  const hidden = freq({ [url]: -2 }, url, ['live']);
  assert.ok(liked > base * 3, `liked ${liked} vs base ${base}`);
  assert.ok(rare < base * 0.3, `rare ${rare} vs base ${base}`);
  assert.equal(hidden, 0);
});

test('liking several sites in a category makes the category come up more', () => {
  const live = Object.fromEntries(GOLDEN.live.sites.map((s) => [s.url, 3]));
  let base = 0, boosted = 0;
  const r1 = rngFrom('c1'), r2 = rngFrom('c2');
  for (let i = 0; i < 3000; i++) {
    if (pickGolden(3, { rand: r1 }).some((p) => p.category === 'live')) base++;
    if (pickGolden(3, { rand: r2, ratings: live }).some((p) => p.category === 'live')) boosted++;
  }
  assert.ok(boosted > base * 1.5, `boosted ${boosted} vs base ${base}`);
});

test('a category with everything hidden disappears', () => {
  const hideAll = Object.fromEntries(GOLDEN.news.sites.map((s) => [s.url, -2]));
  for (let i = 0; i < 200; i++) assert.ok(!pickGolden(3, { rand: rngFrom(i), ratings: hideAll }).some((p) => p.category === 'news'));
});

test('Polish sites are in the mix', () => {
  const pl = allSites().filter((s) => s.lang === 'pl');
  assert.ok(pl.length >= 15, `${pl.length} Polish sites`);
  assert.ok(new Set(pl.map((s) => s.category)).size >= 5);
});

test('domainOf strips www', () => {
  assert.equal(domainOf('https://www.heavens-above.com/'), 'heavens-above.com');
});

test('mood links are Spotify web searches; surprise covers many genres', () => {
  for (const k of Object.keys(MOODS)) {
    const l = moodLink(k, rngFrom(k));
    assert.ok(l.url.startsWith('https://open.spotify.com/search/'), l.url);
    assert.ok(l.url.endsWith('/playlists'));
  }
  assert.equal(spotifySearchUrl('ethio jazz'), 'https://open.spotify.com/search/ethio%20jazz/playlists');
  const seen = new Set();
  const r = rngFrom('s');
  for (let i = 0; i < 300; i++) seen.add(moodLink('surprise', r).label);
  assert.ok(seen.size >= GENRES.length * 0.9, `${seen.size}/${GENRES.length}`);
});

test('wellness tips: short, rotate hourly, click cycles', () => {
  for (const t of TIPS) assert.ok(t.length <= 120, t);
  const h = Date.parse('2026-10-13T10:15:00Z');
  assert.equal(tipFor(h), tipFor(h + 30 * 60000), 'same within the hour');
  assert.notEqual(tipFor(h), tipFor(h + 3600000), 'changes next hour');
  assert.notEqual(tipFor(h, 0), tipFor(h, 1));
});
