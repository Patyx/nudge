// Hand-picked corners of the web that no feed will ever show you.
// Shown at the bottom of the new tab and on the pause screen.
// Add your own finds to any list. lang: 'pl' marks Polish sites.
// `also` is an optional second link shown next to the first (used for "read both sides").

export const GOLDEN = {
  making: {
    label: 'Engineering & making',
    sites: [
      { title: 'GPS, explained by Bartosz Ciechanowski', url: 'https://ciechanow.ski/gps/', about: 'An interactive essay on how your phone finds itself from orbit. You drag the satellites around yourself.' },
      { title: 'Ciechanowski archive', url: 'https://ciechanow.ski/archives/', about: 'Engines, watches, lenses, sound, the Moon. Each one explained with live 3D models you can poke.' },
      { title: "Ken Shirriff's blog", url: 'https://www.righto.com/', about: 'Reverse-engineering old chips and Apollo-era hardware, die photos and all.' },
      { title: 'Hackaday', url: 'https://hackaday.com/', about: 'Daily hardware hacks from people building strange, clever things in garages.' },
      { title: 'Low-tech Magazine', url: 'https://www.lowtechmagazine.com/', about: 'How things worked before fossil fuels, and what we could borrow back. The site itself runs on solar.' },
      { title: "Richard Nakka's Experimental Rocketry", url: 'https://www.nakka-rocketry.net/', about: 'Decades of amateur rocket motor notes: propellants, casings, nozzle theory, test results.' },
      { title: 'Explorable Explanations', url: 'https://explorabl.es/', about: 'A collection of essays you learn from by playing with them.' },
      { title: 'Nicky Case', url: 'https://ncase.me/', about: 'Playable explainers about trust, systems and how ideas spread.' },
      { title: 'Lobsters', url: 'https://lobste.rs/', about: 'A small, invite-only tech forum. Fewer posts, better ones, no infinite scroll.' },
      { title: 'Instructables', url: 'https://www.instructables.com/', about: 'Step-by-step projects from people who built the thing first.' },
      { title: 'Practical Engineering', url: 'https://practical.engineering/', about: 'How roads, dams and water systems actually work, explained clearly.' },
      { title: 'Make:', url: 'https://makezine.com/', about: 'Projects and stories from the maker world: electronics, woodwork, 3D printing.' },
      { title: 'FORBOT', url: 'https://forbot.pl/', lang: 'pl', about: 'Polskie kursy elektroniki, Arduino i druku 3D, krok po kroku. Dobre paliwo dla domowych projektów.' },
    ],
  },
  space: {
    label: 'Space & science',
    sites: [
      { title: 'Astronomy Picture of the Day', url: 'https://apod.nasa.gov/apod/astropix.html', about: 'One image of the universe a day since 1995, each explained by an astronomer.' },
      { title: 'Heavens-Above', url: 'https://www.heavens-above.com/', about: 'Which satellites pass over you tonight, and exactly when to look up.' },
      { title: 'NASA Scientific Visualization Studio', url: 'https://svs.gsfc.nasa.gov/', about: "NASA's in-house animation team, turning real data about Earth and space into film." },
      { title: 'The Space Review', url: 'https://www.thespacereview.com/', about: 'Weekly long essays on space engineering, policy and history.' },
      { title: 'Quanta Magazine', url: 'https://www.quantamagazine.org/', about: 'Patient, beautifully written stories about research in math, physics and biology.' },
      { title: 'Nautilus', url: 'https://nautil.us/', about: 'Science essays that read like good literature.' },
      { title: 'Works in Progress', url: 'https://worksinprogress.co/', about: 'Essays on ideas that could make the world better, and why they stalled.' },
      { title: 'What If?', url: 'https://what-if.xkcd.com/', about: 'Rigorous physics answers to absurd questions, with stick figures.' },
      { title: 'Kosmonauta.net', url: 'https://kosmonauta.net/', lang: 'pl', about: 'Polski serwis o lotach kosmicznych: starty, misje i polskie projekty satelitarne.' },
      { title: 'Urania', url: 'https://www.urania.edu.pl/', lang: 'pl', about: 'Portal Polskiego Towarzystwa Astronomicznego: co dziś widać na niebie i co nowego w astronomii.' },
      { title: 'Delta', url: 'https://www.deltami.edu.pl/', lang: 'pl', about: 'Miesięcznik o matematyce, fizyce i informatyce, pisany przez naukowców dla ciekawskich.' },
      { title: 'Nauka w Polsce', url: 'https://naukawpolsce.pl/', lang: 'pl', about: 'Codzienne wiadomości o badaniach polskich naukowców, bez sensacji.' },
    ],
  },
  live: {
    label: 'Live views of the planet',
    sites: [
      { title: 'Flightradar24', url: 'https://www.flightradar24.com/', about: "Every plane in the sky right now. Click one and see where it's going." },
      { title: 'ADS-B Exchange', url: 'https://globe.adsbexchange.com/', about: 'The unfiltered flight tracker: military, private and odd aircraft that others hide.' },
      { title: 'MarineTraffic', url: 'https://www.marinetraffic.com/', about: 'Ships crossing every ocean, live. Find the one carrying your next parcel.' },
      { title: 'WindowSwap', url: 'https://www.window-swap.com/', about: "Look out of a stranger's window somewhere else in the world for a minute." },
      { title: 'Drive From Home', url: 'https://drivefromhome.com/', about: 'Drive through a city on the other side of the world with its local radio playing.' },
      { title: 'earth.nullschool', url: 'https://earth.nullschool.net/', about: "An animated globe of today's winds and ocean currents. Hypnotic." },
      { title: 'Windy', url: 'https://www.windy.com/', about: 'Weather as moving layers of wind, rain and cloud, right down to your own roof.' },
      { title: 'LightningMaps', url: 'https://www.lightningmaps.org/', about: 'Lightning strikes around the world as they happen, detected by volunteers.' },
      { title: 'explore.org live cams', url: 'https://explore.org/livecams', about: 'Live nature cameras: bears fishing, eagles nesting, reefs, northern lights.' },
      { title: 'Stellarium Web', url: 'https://stellarium-web.org/', about: "A planetarium in the browser showing tonight's sky from where you are." },
      { title: 'Submarine Cable Map', url: 'https://www.submarinecablemap.com/', about: 'The undersea cables that carry the internet, all on one map.' },
    ],
  },
  news: {
    label: 'Fair news',
    sites: [
      { title: 'Reuters', url: 'https://www.reuters.com/', about: 'Wire-service reporting: who, what, when, with little opinion on top.' },
      { title: 'AP News', url: 'https://apnews.com/', about: 'The other big wire service. Plain reporting that other outlets build on.' },
      { title: 'Ground News', url: 'https://ground.news/', about: 'One story, with how left, centre and right outlets each cover it. Partly paid.' },
      { title: 'AllSides', url: 'https://www.allsides.com/', about: 'Headlines from left, centre and right side by side, with bias ratings.' },
      { title: 'Kagi News', url: 'https://news.kagi.com/', about: 'One calm daily briefing you can finish in five minutes. Then it ends.' },
      { title: 'The Conversation', url: 'https://theconversation.com/', about: 'News analysis written by researchers and edited by journalists.' },
      { title: 'Our World in Data', url: 'https://ourworldindata.org/', about: 'Long-term data on how the world is actually changing. An antidote to doom headlines.' },
      { title: 'Notes from Poland', url: 'https://notesfrompoland.com/', about: 'Independent, non-profit reporting and analysis on Poland, in English.' },
      { title: 'Demagog', url: 'https://demagog.org.pl/', lang: 'pl', about: 'Polscy fact-checkerzy sprawdzają wypowiedzi polityków ze wszystkich stron sceny.' },
      { title: 'PAP', url: 'https://www.pap.pl/', lang: 'pl', about: 'Polska Agencja Prasowa: krótkie depesze, z których korzystają inne redakcje.' },
      { title: 'Tygodnik Powszechny', url: 'https://www.tygodnikpowszechny.pl/', lang: 'pl', about: 'Tygodnik z długą tradycją: spokojna analiza zamiast krzyku.' },
      {
        title: 'Rzeczpospolita', url: 'https://www.rp.pl/', lang: 'pl',
        about: 'Centroprawicowy dziennik. Ten sam temat przeczytaj też w centrolewicowej Wyborczej i porównaj.',
        also: { title: 'Gazeta Wyborcza', url: 'https://wyborcza.pl/' },
      },
    ],
  },
  unslop: {
    label: 'Unslop yourself',
    sites: [
      { title: 'Kagi Small Web', url: 'https://kagi.com/smallweb', about: 'A random recent post from a personal blog. Real people, no algorithm, no ads.' },
      { title: 'Bear Blog: Discover', url: 'https://bearblog.dev/discover/', about: 'Posts from small, ad-free personal blogs, ranked by readers rather than engagement.' },
      { title: 'Neocities: Browse', url: 'https://neocities.org/browse', about: 'Hand-made personal websites of the weird and wonderful kind.' },
      { title: 'Are.na', url: 'https://www.are.na/', about: 'Collections built by people slowly connecting ideas. The opposite of a feed.' },
      { title: 'Farnam Street', url: 'https://fs.blog/', about: 'Mental models and better decisions, explained with real examples.' },
      { title: 'Paul Graham essays', url: 'https://paulgraham.com/articles.html', about: 'Short, clear essays on work, thinking and doing things that matter.' },
      { title: 'Astral Codex Ten', url: 'https://www.astralcodexten.com/', about: 'Long, careful arguments, including ones where the author changes his mind in public.' },
      { title: 'Psyche', url: 'https://psyche.co/', about: 'Guides and essays on living well, from philosophers and psychologists.' },
      { title: 'Aeon', url: 'https://aeon.co/', about: 'Essays on philosophy, science and culture, written to be read slowly.' },
      { title: 'Cal Newport', url: 'https://calnewport.com/blog/', about: 'Essays on deep work and digital minimalism: how to think in a distracted world.' },
      { title: 'Oliver Burkeman', url: 'https://www.oliverburkeman.com/', about: 'On finite time, imperfection and dropping productivity guilt. Oddly calming.' },
      { title: 'Center for Humane Technology', url: 'https://www.humanetech.com/', about: 'How attention-harvesting apps work on you, and how to push back.' },
      { title: 'Austin Kleon', url: 'https://austinkleon.com/', about: 'Short daily posts about creativity, notebooks and making things offline.' },
      { title: 'Why procrastinators procrastinate', url: 'https://waitbutwhy.com/2013/10/why-procrastinators-procrastinate.html', about: 'The instant-gratification monkey, explained with stick figures. Uncomfortably accurate.' },
    ],
  },
  books: {
    label: 'Writing & books',
    sites: [
      { title: 'The Paris Review interviews', url: 'https://www.theparisreview.org/interviews', about: 'Decades of long conversations with writers about how they actually work.' },
      { title: 'The Marginalian', url: 'https://www.themarginalian.org/', about: 'Long, generous reflections on books, art and how to live.' },
      { title: 'Standard Ebooks', url: 'https://standardebooks.org/', about: 'Free public-domain classics, carefully typeset and proofread. Better than most paid editions.' },
      { title: 'The Public Domain Review', url: 'https://publicdomainreview.org/', about: 'Strange and lovely things rescued from old books, maps and archives.' },
      { title: 'Poetry Foundation', url: 'https://www.poetryfoundation.org/', about: 'Read one poem. It takes two minutes and lasts longer than a thread.' },
      { title: 'Literary Hub', url: 'https://lithub.com/', about: 'Essays, excerpts and interviews from the book world, every day.' },
      { title: 'Electric Literature', url: 'https://electricliterature.com/', about: 'Short fiction plus essays about reading and writing.' },
      { title: 'Writing Excuses', url: 'https://writingexcuses.com/', about: 'Short podcast episodes on the craft of fiction, by working novelists.' },
      { title: 'Project Gutenberg', url: 'https://www.gutenberg.org/', about: 'Tens of thousands of free books. Somewhere in there is your next favourite.' },
      { title: 'Wolne Lektury', url: 'https://wolnelektury.pl/', lang: 'pl', about: 'Darmowe polskie klasyki do czytania i słuchania, także jako audiobooki.' },
      { title: 'Polona', url: 'https://polona.pl/', lang: 'pl', about: 'Cyfrowa Biblioteka Narodowa: stare mapy, plakaty, rękopisy i książki do przeglądania.' },
      { title: 'Dwutygodnik', url: 'https://www.dwutygodnik.com/', lang: 'pl', about: 'Pismo o kulturze: literatura, sztuka i muzyka w długich, starannych tekstach.' },
      { title: 'Pismo', url: 'https://magazynpismo.pl/', lang: 'pl', about: 'Magazyn długich reportaży i esejów, także do słuchania.' },
    ],
  },
  curio: {
    label: 'Curiosities & small web',
    sites: [
      { title: 'Wiby: surprise me', url: 'https://wiby.me/surprise/', about: 'One click, one random page from the hand-made, old-school web.' },
      { title: 'Marginalia Explore', url: 'https://marginalia-search.com/explore', about: 'Wander the independent, non-commercial web by topic.' },
      { title: 'Atlas Obscura', url: 'https://www.atlasobscura.com/', about: 'Hidden wonders and very odd places around the world.' },
      { title: 'Wikipedia: Unusual articles', url: 'https://en.wikipedia.org/wiki/Wikipedia:Unusual_articles', about: "Wikipedia's own list of its strangest pages. Dangerous in the best way." },
      { title: 'A random Wikipedia article', url: 'https://en.wikipedia.org/wiki/Special:Random', about: 'Roll the dice and read whatever comes up.' },
      { title: 'Damn Interesting', url: 'https://www.damninteresting.com/', about: "Long, well-researched true stories you've never heard of." },
      { title: 'neal.fun', url: 'https://neal.fun/', about: 'Small interactive toys about scale, space, money and the deep sea.' },
      { title: 'The Pudding', url: 'https://pudding.cool/', about: 'Visual essays that explain culture with data.' },
      { title: 'Internet Archive', url: 'https://archive.org/', about: 'Old films, software, books and long-gone websites, free to explore.' },
      { title: 'kottke.org', url: 'https://kottke.org/', about: "One person's hand-picked links, running since 1998." },
      { title: 'Fotopolska', url: 'https://fotopolska.eu/', lang: 'pl', about: 'Stare i nowe zdjęcia polskich miejsc, ulica po ulicy. Zobacz, jak kiedyś wyglądała twoja okolica.' },
      { title: 'Culture.pl', url: 'https://culture.pl/', about: 'Polish art, film, design and history, explained with care, in English and Polish.' },
    ],
  },
  music: {
    label: 'Music, found by humans',
    sites: [
      { title: 'Radio Garden', url: 'https://radio.garden/', about: 'Spin the globe and listen to live radio from wherever you land.' },
      { title: 'Bandcamp Daily', url: 'https://daily.bandcamp.com/', about: 'Editors writing about records they love, from every genre and corner.' },
      { title: '1001 Albums Generator', url: 'https://1001albumsgenerator.com/', about: 'One classic album a day, chosen for you by a book, not by a feed.' },
      { title: 'NTS Radio', url: 'https://www.nts.live/', about: 'Independent radio with hosts who dig deep. Pick a show and let it run.' },
      { title: 'Radio Nowy Świat', url: 'https://nowyswiat.online/', lang: 'pl', about: 'Niezależne radio utrzymywane przez słuchaczy. Muzyka wybierana przez ludzi, nie algorytm.' },
      { title: 'Radio 357', url: 'https://radio357.pl/', lang: 'pl', about: 'Radio słuchaczy, z autorskimi audycjami muzycznymi.' },
      { title: 'KEXP', url: 'https://www.kexp.org/', about: 'Listener-supported Seattle radio with DJs who pick everything themselves.' },
    ],
  },
  art: {
    label: 'Art & design',
    sites: [
      { title: 'Google Arts & Culture', url: 'https://artsandculture.google.com/', about: 'Museums from around the world, zoomable down to the brushstroke.' },
      { title: 'The Met collection', url: 'https://www.metmuseum.org/art/collection', about: 'Half a million works from one of the great museums, free to browse.' },
      { title: 'Rijksmuseum', url: 'https://www.rijksmuseum.nl/en', about: 'Dutch masters in very high resolution. Rembrandt up close.' },
      { title: 'Smarthistory', url: 'https://smarthistory.org/', about: 'Short, friendly art history from cave paintings to now, by art historians.' },
      { title: 'Colossal', url: 'https://www.thisiscolossal.com/', about: 'Daily art, craft and design from makers around the world.' },
      { title: "It's Nice That", url: 'https://www.itsnicethat.com/', about: 'Illustration, graphic design and photography worth a slow look.' },
    ],
  },
  food: {
    label: 'Food & cooking',
    sites: [
      { title: 'Serious Eats', url: 'https://www.seriouseats.com/', about: 'Recipes that explain why they work. You cook better afterwards.' },
      { title: 'Budget Bytes', url: 'https://www.budgetbytes.com/', about: 'Good, cheap recipes with the cost per serving worked out.' },
      { title: 'The Woks of Life', url: 'https://thewoksoflife.com/', about: 'A family writing down the Chinese cooking they grew up with.' },
      { title: 'Just One Cookbook', url: 'https://www.justonecookbook.com/', about: 'Japanese home cooking, step by step.' },
      { title: 'Kwestia Smaku', url: 'https://www.kwestiasmaku.com/', lang: 'pl', about: 'Sprawdzone przepisy na co dzień, od obiadu po ciasto.' },
    ],
  },
  nature: {
    label: 'Nature & outdoors',
    sites: [
      { title: 'iNaturalist', url: 'https://www.inaturalist.org/', about: 'Photograph a plant or bug and people help you name it. Real science, too.' },
      { title: 'eBird', url: 'https://ebird.org/', about: 'See which birds were spotted near you this week, and add your own.' },
      { title: 'xeno-canto', url: 'https://xeno-canto.org/', about: 'Bird songs from all over the world, recorded by people who love them.' },
      { title: 'Wildlife Photographer of the Year', url: 'https://www.nhm.ac.uk/wpy', about: 'Decades of the best nature photos, with the stories behind them.' },
      { title: 'Global Forest Watch', url: 'https://www.globalforestwatch.org/', about: "A live map of the world's forests and where they are disappearing." },
    ],
  },
  learn: {
    label: 'Learn something',
    sites: [
      { title: 'Khan Academy', url: 'https://www.khanacademy.org/', about: 'Free lessons in maths, science and more, from the basics up.' },
      { title: 'MIT OpenCourseWare', url: 'https://ocw.mit.edu/', about: 'Real MIT courses, lectures and problem sets, free.' },
      { title: '3Blue1Brown', url: 'https://www.3blue1brown.com/', about: 'Maths explained with animation, so you see why it works.' },
      { title: 'BetterExplained', url: 'https://betterexplained.com/', about: 'Intuitive explanations of the maths you were taught by rote.' },
      { title: 'Seeing Theory', url: 'https://seeing-theory.brown.edu/', about: 'Probability and statistics you can play with in the browser.' },
      { title: 'Crash Course', url: 'https://thecrashcourse.com/', about: 'Fast, fun courses on history, science, economics and more.' },
      { title: 'Khan Academy po polsku', url: 'https://pl.khanacademy.org/', lang: 'pl', about: 'Darmowe lekcje matematyki i nauk ścisłych, po polsku.' },
    ],
  },
};

export function allSites() {
  return Object.entries(GOLDEN).flatMap(([cat, c]) => c.sites.map((s) => ({ ...s, category: cat, categoryLabel: c.label })));
}

// ---------- ratings ----------
// ratings: { [url]: n }, n from -2 to +3. Each thumbs up adds 1, each down subtracts 1.
// +1..+3 → 2x..4x as likely. -1 → rare (0.15x). -2 → hidden.

export function weightOf(score = 0) {
  if (score <= -2) return 0;
  if (score === -1) return 0.15;
  return 1 + Math.max(0, Math.min(3, score));
}

export function rate(ratings, url, dir) {
  const cur = ratings[url] || 0;
  const next = Math.max(-2, Math.min(3, cur + (dir > 0 ? 1 : -1)));
  const out = { ...ratings };
  if (next === 0) delete out[url];
  else out[url] = next;
  return out;
}

function weightedIndex(weights, rand) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return -1;
  let r = rand() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

// Picks `count` sites from different categories. Categories you like come up more,
// sites you like come up more, recent ones are skipped while alternatives exist.
// opts: { recent: [urls], ratings: {url: n}, rand, cats: [category keys], ensure: category key }
export function pickGolden(count = 3, opts = {}) {
  const { recent = [], ratings = {}, rand = Math.random, cats = Object.keys(GOLDEN), ensure = null, skipLangs = [] } = opts;
  const recentSet = new Set(recent);
  const skip = new Set(skipLangs); // e.g. ['pl'] hides Polish-language sites
  const shown = (s) => !s.lang || !skip.has(s.lang);
  const candidates = (cat) => {
    const sites = GOLDEN[cat].sites.filter((s) => shown(s) && weightOf(ratings[s.url]) > 0);
    const fresh = sites.filter((s) => !recentSet.has(s.url));
    return fresh.length ? fresh : sites;
  };
  const catWeight = (cat) => {
    const live = GOLDEN[cat].sites.filter(shown).map((s) => weightOf(ratings[s.url])).filter((w) => w > 0);
    if (!live.length) return 0;
    return live.reduce((a, b) => a + b, 0) / live.length; // average appeal, not list length
  };

  let pool = cats.filter((c) => GOLDEN[c] && catWeight(c) > 0);
  const chosen = [];
  if (ensure && pool.includes(ensure)) { chosen.push(ensure); pool = pool.filter((c) => c !== ensure); }
  while (chosen.length < count && pool.length) {
    const i = weightedIndex(pool.map(catWeight), rand);
    if (i < 0) break;
    chosen.push(pool[i]);
    pool.splice(i, 1);
  }

  return chosen.map((cat) => {
    const sites = candidates(cat);
    const i = weightedIndex(sites.map((s) => weightOf(ratings[s.url])), rand);
    const s = sites[Math.max(0, i)];
    return { ...s, category: cat, categoryLabel: GOLDEN[cat].label };
  });
}

export function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}
