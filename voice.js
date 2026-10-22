// All nudge wording lives here. Three voices are mixed on purpose:
// wit, coach and deadpan, so the same situation doesn't read the same way twice.
//
// Placeholders: {area} {task} {est} {days} {limit} {age} {n} {when} {late} {where} {dur} {time}
// {est} renders as " (30m)" or "" so it can follow a task name directly.
// Edit freely: add lines to any list and they join the rotation.

export const LINES = {
  stale: [
    ['{area} is drifting', '{days} days with no progress, and your limit was {limit}. "{task}"{est} would pull it back on course.'],
    ['{area} sent a postcard', '"Quiet {days} days here. Wish you were here." Reply with "{task}"{est}.'],
    ['Small move, big difference', '{area} has been still for {days} days. Starting "{task}"{est} keeps the thread unbroken. You only have to begin.'],
    ['{area}: {days} days.', 'Nothing happened. Next step is "{task}"{est}. The project remains patient. Mostly.'],
    ['Dust report: {area}', '{days} days of dust. One round of "{task}"{est} and it is a project again, not a museum piece.'],
    ['Your future self is watching', 'Next week you will either be glad you touched {area} today, or you will be reading this again. "{task}"{est}.'],
    ['{area} misses you', 'It has been {days} days. Not angry, just disappointed. "{task}"{est} would patch things up.'],
    ['Reminder that {area} exists', 'Last progress {days} days ago. Next: "{task}"{est}.'],
    ['Keep {area} alive', 'Projects rarely die in one day. They fade over quiet weeks like this {days}-day one. "{task}"{est} stops the fade.'],
  ],
  empty: [
    ['{area} has no next step', 'Without one it will politely wait forever. Spend 5 minutes deciding the very next physical action.'],
    ['{area} needs a direction', '{days} days quiet and nothing queued. Write one next step, tiny is fine. That is the whole task.'],
    ['{area}: empty.', 'No next step written. Projects without next steps are called hobbies you used to have.'],
    ['Plot twist for {area}', 'There is no next step. Five minutes of thinking now keeps {area} from quietly becoming a "someday".'],
  ],
  agingBig: [
    ['"{task}" is too big to start', 'Top of {area} for {age} days. That is what {estRaw} tasks do. Split off a 15-minute first bite.'],
    ['Cut "{task}" down to size', 'It has waited {age} days. Big steps get avoided, small ones get done. What is the first 15 minutes of it?'],
    ['"{task}": {age} days.', 'Probably too big. Cut it.'],
  ],
  agingVague: [
    ['"{task}" is suspiciously vague', 'Top of {area} for {age} days with no estimate. If you cannot say how long, it is a fog bank, not a step. Rewrite it as the first physical action.'],
    ['Make "{task}" concrete', 'It has sat {age} days. Vague steps are hard to start. Name the first thing your hands would do, and add a time label.'],
    ['"{task}": {age} days, no estimate.', 'Unclear tasks do not get done. Rewrite it.'],
  ],
  agingPlain: [
    ['"{task}" is still waiting', '{age} days at the top of {area}. Usually that means unclear or blocked. Rewrite it, or move something smaller above it.'],
    ['Unstick "{task}"', '{age} days without a start. Ask what is blocking it, then make that the next step instead.'],
    ['"{task}", day {age}.', 'Still top of {area}. Still not started. Something is off with it.'],
  ],
  momentum: [
    ['{area} is on a roll', '{n} done in the last day. "{task}"{est} is next. Go while the engine is warm.'],
    ['Keep it going', 'You moved {area} forward recently. Momentum is cheaper to keep than to restart: "{task}"{est}.'],
    ['{area}: moving.', '{n} done. Next: "{task}"{est}. Continue.'],
    ['Nice work on {area}', '{n} done in a day. One more, "{task}"{est}, and it really starts to feel real.'],
  ],
  quick: [
    ['Easy glory, on tap', '"{task}"{est} in {where}. Small win, quick dopamine, no regret.'],
    ['Easy start', '"{task}"{est} is quick. Finishing something small is the best way to get going.'],
    ['Small one.', '"{task}"{est}. You have spent longer reading notifications.'],
    ['Warm-up lap', 'Start with "{task}"{est}. Small things first, then the big thing feels closer.'],
  ],
  random: [
    ['Remember this one?', '"{task}" in {where} has been sitting there {age} days, quietly hoping. Worth a look?'],
    ['Luck of the draw', '"{task}" ({where}). No special reason. Do it, move it, or delete it. All three count.'],
    ['Something different', 'How about "{task}"{est} from {where}? Switching tasks can be a good reset.'],
    ['From the archives', '"{task}". Added {age} days ago. Still relevant? Decide.'],
    ['Today\'s lucky task', 'The wheel has spoken: "{task}"{est}. The wheel is rarely wrong.'],
    ['Quick check-in', '"{task}" is still on your list in {where}. If it no longer matters, deleting it is progress too.'],
  ],
  leisure: [
    ['Evening plans?', '"{task}" is on your {area} list. Better than reddit, and you already picked it.'],
    ['You have earned some downtime', 'Instead of scrolling, how about "{task}"? It has been waiting {age} days.'],
    ['Leisure, scheduled', '"{task}". From your own {area} list. Past-you recommends it.'],
    ['The good kind of break', 'Scrolling ends with nothing. "{task}" ends with having done something you wanted to do.'],
  ],
  deadlineWeek: [
    ['"{task}" is due {when}', 'A week of runway. Plenty, if you start before "plenty of time" becomes "plenty of panic".'],
    ['Heads-up: "{task}"', 'Due {when}. Starting early is the cheapest insurance there is.'],
    ['Due {when}: "{task}"', 'Noted now so it is not a surprise later.'],
  ],
  deadline3d: [
    ['"{task}" is due {when}', 'A couple of days of runway: enough time to do it well, not enough to forget it.'],
    ['{when}: "{task}"', 'A calm start today beats a sprint on the last evening.'],
    ['Due {when}.', '"{task}"{est}. Clock is running.'],
  ],
  deadline1d: [
    ['Tomorrow: "{task}"', 'Future-you has plans tomorrow. Do them a favour and do it today.'],
    ['Due tomorrow', '"{task}"{est} is due tomorrow. A bit of time today buys a calm tomorrow.'],
    ['Due tomorrow.', '"{task}". That is it. That is the message.'],
  ],
  deadlineToday: [
    ['Today\'s the day: "{task}"', 'Due today{time}. Everything else can wait its turn.'],
    ['"{task}" is due today', 'Clear the decks for it{time}. You will feel lighter by evening.'],
    ['Due today.', '"{task}"{est}{time}.'],
  ],
  deadlineOverdue: [
    ['"{task}" is {late} late', 'Not the end of the world. Do it now, or move the date honestly. Either beats ignoring it.'],
    ['Let\'s close this one', '"{task}" passed its date {late} ago. Finish it or reschedule it. Both count as progress.'],
    ['Overdue: "{task}"', '{late}. Still there.'],
  ],
  breakEnd: [
    ['Break\'s over ({dur})', 'Welcome back. Next up: "{task}"{est} in {where}.'],
    ['Time\'s up ({dur})', 'Reddit will still be there later. "{task}"{est} has been waiting longer.'],
    ['Back to it ({dur})', 'Break done. One thing: "{task}"{est}. You have got this.'],
    ['({dur}) Break complete.', '"{task}"{est}. Go.'],
  ],
  breakEndNoTask: [
    ['Break\'s over ({dur})', 'Welcome back. Open a new tab to see your list.'],
    ['Time\'s up ({dur})', 'Hope it was a good one. Your list is one new tab away.'],
  ],
  top: [
    ['Top 3, number {n}: "{task}"', 'You picked this one this morning. Past-you had a plan{est}. Honour it.'],
    ['"{task}" is on today\'s list', 'One of the three things you said mattered today{est}. Everything else can wait.'],
    ['Today\'s pick: "{task}"', 'Small list, big difference. Start it now{est} and the day already counts.'],
    ['"{task}".', 'Top 3, number {n}. Still open.'],
  ],
  twoMinute: [
    ['Two minutes: "{task}"', 'Faster to do it than to read about it again later.'],
    ['Quick one: "{task}"', 'Two minutes now saves it nagging you all week.'],
    ['"{task}"', 'Two-minute task. Just do it.'],
  ],
  shutdown: [
    ['Time to shut down', '{summary} Pick tomorrow\'s first step and close up. The work will still be there.'],
    ['Day\'s done', '{summary} Leave yourself a first step for tomorrow, then rest.'],
    ['Shutdown.', '{summary} Tomorrow\'s first step, then off.'],
  ],
  review: [
    ['Weekly review', '{summary} Ten minutes now keeps next week clear.'],
    ['Sunday reset', '{summary} Empty the inbox, check each project has a next step, done.'],
  ],
  praise1: [
    ['One down.', '“{last}” is done. The first one is the hardest to start; the rest come easier.'],
    ['Off the list: {last}.', 'That counts. Whatever else happens today, this one is finished.'],
    ['Done is done.', '“{last}” no longer needs any of your attention. Enjoy the quiet it leaves.'],
  ],
  praise2: [
    ['Two done today.', 'Latest: “{last}”. That is a rhythm, not a fluke.'],
    ['Two for two.', '“{last}” just joined the pile of finished things. Nice.'],
    ['Twice today.', 'You started and finished twice. Most days need nothing more than that.'],
  ],
  praise3: [
    ['{n} done today. Good day.', 'Anything more is a bonus. Nudges are easing off.'],
    ['{n} things finished.', 'That is a solid day by any measure. Keep going only if you feel like it.'],
    ['{n} down. Well played.', 'Latest: “{last}”. The backlog is smaller than this morning, and that is the point.'],
  ],
  praise5: [
    ['{n} done today. Excellent.', 'Nudges are off for the rest of the day, deadlines aside. You earned the quiet.'],
    ['{n} finished. Take the win.', 'That is a big day. Rest counts as part of the work now.'],
    ['{n} things done. Seriously good.', 'Future-you is impressed. No more nagging today.'],
  ],
  nothing: [
    ['Nothing is slipping.', 'Every watched project moved recently. Pick whatever you like, or take a real break.'],
    ['All clear.', 'No deadlines close, no project gathering dust. Enjoy it.'],
  ],
};

// ---------- tiny seeded random, so the text stays stable for a day ----------

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function rngFrom(seed) {
  let a = typeof seed === 'number' ? seed : hashStr(String(seed));
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fill(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

// Picks a line for `kind`, seeded so a given nudge reads the same all day.
export function say(kind, vars, seed) {
  const pool = LINES[kind];
  if (!pool?.length) throw new Error(`No lines for ${kind}`);
  const idx = Math.floor(rngFrom(`${kind}|${seed}`)() * pool.length);
  const [t, b] = pool[idx];
  return { title: fill(t, vars), body: fill(b, vars), line: `${kind}#${idx}` };
}
