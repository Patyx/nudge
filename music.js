// Spotify corner: mood buttons that open the web player on a playlist search,
// plus "Surprise me", which rolls a genre you probably haven't heard this year.
// Searching (instead of fixed playlist links) keeps it fresh and never breaks.

export const MOODS = {
  focus: { label: 'Focus', queries: ['deep focus', 'instrumental study', 'ambient focus', 'post rock focus', 'lofi beats', 'minimal piano focus'] },
  energy: { label: 'Energy', queries: ['energy booster', 'indie workout', 'synthwave drive', 'funk classics', 'garage rock', 'afrobeats party'] },
  calm: { label: 'Calm', queries: ['peaceful piano', 'ambient chill', 'jazz evening', 'acoustic calm', 'rainy day jazz', 'nordic folk calm'] },
};

export const GENRES = [
  'krautrock', 'afrobeat', 'bossa nova', 'shoegaze', 'ethio jazz', 'city pop', 'highlife', 'tropicalia',
  'dub', 'balkan brass', 'fado', 'desert blues', 'library music', 'italo disco', 'cumbia', 'post-punk',
  'gamelan', 'japanese ambient', 'polish jazz', 'flamenco', 'celtic folk', 'northern soul', 'trip hop',
  'chiptune', 'baroque', 'qawwali', 'rebetiko', 'minimal techno', 'spiritual jazz', 'zamrock',
  'french chanson', 'math rock', 'mongolian throat singing', 'dream pop', 'turkish psych', 'kosmische',
  'brazilian jazz', 'ambient techno', 'bluegrass', 'soviet synth', 'anatolian rock', 'film noir jazz',
];

export function spotifySearchUrl(query) {
  return `https://open.spotify.com/search/${encodeURIComponent(query)}/playlists`;
}

export const SPOTIFY_HOME = 'https://open.spotify.com/';

// rand: () => [0,1)
export function moodLink(mood, rand = Math.random) {
  if (mood === 'surprise') {
    const g = GENRES[Math.floor(rand() * GENRES.length)];
    return { label: g, url: spotifySearchUrl(g) };
  }
  const m = MOODS[mood];
  const q = m.queries[Math.floor(rand() * m.queries.length)];
  return { label: q, url: spotifySearchUrl(q) };
}
