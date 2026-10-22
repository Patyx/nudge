// Help: a window with tabs, and "Explain this page" mode where hovering any part shows what it does.

const TABS = [
  ['start', 'Getting started'],
  ['page', 'The new tab'],
  ['todoist', 'Todoist tips'],
  ['focus', 'Focus, breaks & notifications'],
  ['faq', 'Questions'],
];

const BODY = {
  start: `
    <p>Nudge puts your Todoist projects on every new tab. It shows one next step with a reason, praises what you finished, and pings you now and then when a project goes quiet. Your tasks stay in Todoist; Nudge only reads them and adds or ticks tasks when you ask it to.</p>
    <h3>First steps</h3>
    <ol>
      <li><b>Connect Todoist.</b> Settings, paste your API token (Todoist: Settings, Integrations, Developer).</li>
      <li><b>Pick the projects to watch.</b> Settings, Projects to watch. Each Todoist section counts as its own project.</li>
      <li><b>Put the real next step on top.</b> In Todoist, drag the next thing to do to the top of each section. That's what Nudge shows.</li>
      <li><b>Add time labels.</b> <code>15m</code>, <code>30m</code>, <code>1h</code>, <code>2h</code>. They power "I have 30m", the work tally and the progress bars.</li>
    </ol>
    <h3>A normal day</h3>
    <ul>
      <li><b>Morning:</b> pick your Top 3 (the dashed box in the middle).</li>
      <li><b>During the day:</b> tick tasks off here or in Todoist. The headline turns into praise as you go, and nudges ease off after 3 done.</li>
      <li><b>Tempted by a feed (reddit, Instagram, TikTok…)?</b> You get a pause screen first. Take a timed break if you want one.</li>
      <li><b>Evening:</b> the orange shutdown card sums up the day. Pick tomorrow's first step and close up.</li>
      <li><b>Sunday:</b> the weekly review empties the Inbox and checks every project.</li>
    </ul>
    <p>Not sure what something is? Click <b>Explain this page</b> below and hover over anything.</p>`,
  page: `
    <h3>Top line</h3>
    <ul>
      <li><b>Date and weather</b> (set your city in Settings). <b>Health tip</b> in the middle: click for another.</li>
      <li><b>Quiet today</b> stops every notification until tomorrow morning. <b>Search</b> (or the <code>/</code> key) finds any open task.</li>
    </ul>
    <h3>Left</h3>
    <ul>
      <li><b>Shortcuts:</b> add your own sites with the + tile. Right-click or ⋮ to rename, change the icon or remove.</li>
      <li><b>Done today</b> and a small <b>7-day chart</b>: green is work, purple is breaks.</li>
    </ul>
    <h3>Middle</h3>
    <ul>
      <li><b>The headline:</b> today's tally once you've finished something, then one suggested next step with its reason. <b>Not now</b> shows another.</li>
      <li><b>Today:</b> your Top 3. <b>+ Add task</b> (or <code>N</code>) opens the task form.</li>
      <li><b>Deadlines:</b> anything due in the next week.</li>
      <li><b>Projects:</b> each watched project with its next step. Click the name to see all its tasks. The thin bar is progress: work done in the last 30 days against what's left. Hover the status on the right to <b>pause</b> a project that's quiet on purpose.</li>
      <li><b>I have 15m / 30m / 1h / 2h</b> lists tasks that fit.</li>
    </ul>
    <h3>Right</h3>
    <ul>
      <li><b>Note:</b> a sticky note that saves as you type and syncs through Chrome.</li>
      <li><b>Elsewhere on the web:</b> hand-picked sites instead of a feed. Thumbs up shows a site more often, thumbs down less.</li>
      <li><b>Music</b> (corner): opens Spotify on a fresh playlist search.</li>
    </ul>
    <p>Hide any of these in Settings, under New tab.</p>`,
  todoist: `
    <h3>How your Todoist is read</h3>
    <ul>
      <li><b>A section is a project here.</b> Keep bigger projects (say Garden, Bike, Novel) as sections inside one project called <i>Big Projects</i>. The free plan allows 5 projects, so sections are how you get more.</li>
      <li><b>The top task is the next step.</b> Drag the real next step to the top of each section.</li>
      <li><b>Quiet means nothing completed.</b> Adding or editing tasks doesn't count as progress; finishing one does.</li>
      <li>Projects or sections named <i>Fun, Movies, Games, Books</i> or <i>Watch</i> never get nudges. They show up as evening suggestions instead.</li>
      <li>Tasks dated more than 14 days ahead count as notes and are never nudged until they get closer.</li>
    </ul>
    <h3>Labels</h3>
    <table>
      <tr><td><code>@15m</code> <code>@30m</code> <code>@1h</code> <code>@2h</code></td><td>Time estimate. Any number with m or h works.</td></tr>
      <tr><td><code>@2m</code></td><td>A two-minute task. One pops up at most hourly: just do it.</td></tr>
      <tr><td><code>@low</code></td><td>Low-energy task, offered as a quick win.</td></tr>
      <tr><td><code>@soft</code></td><td>The due date is a plan, not a deadline. No deadline reminders.</td></tr>
    </table>
    <h3>Deadlines</h3>
    <ul>
      <li>Any one-off due date counts as a deadline. Recurring tasks never do.</li>
      <li>Reminders come 7 days before, 3 days, 1 day, on the day, then daily while overdue. Several at once arrive as one notification.</li>
      <li>Todoist Pro's separate deadline field (<code>{next friday}</code>) wins over the due date.</li>
    </ul>
    <h3>Quick add, on phone or PC</h3>
    <p><code>Order bike chain #Big Projects /Bike @15m tomorrow</code></p>
    <table>
      <tr><td><code>#Project</code></td><td>which project</td></tr>
      <tr><td><code>/Section</code></td><td>which section</td></tr>
      <tr><td><code>@label</code></td><td>estimate or energy</td></tr>
      <tr><td><code>tomorrow</code>, <code>fri 14:00</code></td><td>due date</td></tr>
    </table>
    <h3>Habits that make this work</h3>
    <ul>
      <li><b>Write steps, not topics.</b> "Novel chapter 4" is a topic. "Rewrite the first page of chapter 4" is a step.</li>
      <li><b>If a step sits for a week, it's too big or unclear.</b> Split it or rewrite it.</li>
      <li>Deleting a task you'll never do is progress too.</li>
    </ul>`,
  focus: `
    <h3>Focus timer</h3>
    <ul>
      <li><b>▶</b> next to any task (or <b>Start focus</b> on the headline) starts a timer. Nudges pause while it runs.</li>
      <li><b>Done</b> completes the task. <b>Stop</b> saves what you got done as a completed subtask, or discards the time.</li>
      <li>The timer is optional: tasks you tick off count their estimate (30m without a label).</li>
    </ul>
    <h3>Pause screen and breaks</h3>
    <ul>
      <li>Sites on your pause list (Settings, Pause list: reddit, Facebook, Instagram, TikTok, X and a few more by default, all editable) open a pause screen first. Single reddit posts (from a search, say) open normally.</li>
      <li>Start a 30m, 1h, 2h or 3h break to get through. After your daily break budget (3h by default) only 15-minute breaks are offered.</li>
    </ul>
    <h3>Notifications</h3>
    <ul>
      <li><b>Project nudges:</b> at most one per 2.5 hours of active PC use. After 3 tasks done they halve, after 5 they stop for the day.</li>
      <li><b>Deadline reminders</b> get through snooze, not breaks or Quiet today.</li>
      <li>Nothing pops up in the first 10 minutes after Chrome starts.</li>
      <li><b>Snooze 2h</b> on any notification pauses regular nudges.</li>
      <li><b>Quiet today</b> (top bar) stops everything until tomorrow morning.</li>
      <li><b>Pause</b> a project (hover its status) when it's quiet on purpose.</li>
      <li>Change how often, or switch kinds off, in Settings under Notifications.</li>
    </ul>`,
  faq: `
    <h3>A project is missing.</h3>
    <p>Tick it in Settings under Projects to watch. Archived projects and the Inbox are never shown.</p>
    <h3>I don't get any notifications.</h3>
    <p>Check Settings, Notifications, and that Windows (Settings, System, Notifications) or macOS allows Chrome to show them. Focus or Do not disturb hides them too. The Test buttons in Settings send one right away.</p>
    <h3>A "Reload Nudge" bar appeared.</h3>
    <p>Nudge was updated but Chrome still runs the old background part. Click the button, or the reload arrow in <code>chrome://extensions</code>.</p>
    <h3>Can I change which sites pause?</h3>
    <p>Yes: Settings, Pause list. Add or delete lines (one site per line), or restore the defaults. Or just take a break from the pause screen.</p>
    <h3>Is my data private?</h3>
    <p>Your Todoist token stays in this browser. Nudge talks only to Todoist, Open-Meteo (weather, if you set a city), Google's icon service (shortcut icons) and, if you add a key, Anthropic's API. Nothing else.</p>
    <h3>Moving to a new PC?</h3>
    <p>Settings, Backup: export a file and import it on the other PC. Your token and API key are left out; paste them again.</p>`,
};

// What each part does, for "Explain this page".
const EXPLAIN = [
  ['#date', 'Today\'s date. The day changes at 04:00 (adjustable in Settings), so late nights still count as today.'],
  ['#weather', 'Weather now and tomorrow for the city you set in Settings.'],
  ['#wellness', 'A small health tip that changes hourly. Click it for another.'],
  ['#breakbar', 'Shows a running break and lets you end it early.'],
  ['#quiet-open', 'Stops all notifications until tomorrow morning. Asks first.'],
  ['#search-open', 'Find any open task by name, then tick it, focus on it or open it. Shortcut: /'],
  ['#review-open', 'The weekly review: the week\'s numbers, empty the Inbox, check each project, pick Monday\'s Top 3.'],
  ['#help-open', 'This help.'],
  ['#settings', 'Todoist token, projects to watch, notifications, what the new tab shows, and more.'],
  ['#shortcuts', 'Your sites. + adds one; right-click or ⋮ edits it.'],
  ['#foot', 'The last session briefing and any connection problems.'],
  ['#done-today', 'Everything you finished today. Click to expand.'],
  ['#stats', 'Last 7 days: green is work (timer or task estimates), purple is breaks.'],
  ['#shutdown', 'End-of-day card: today\'s summary, pick tomorrow\'s first step, then close up for quiet until morning.'],
  ['#focus', 'The running focus timer. Done completes the task; Stop saves what you did as a subtask.'],
  ['#nudge', 'The headline. Today\'s tally once you\'ve done something, then one suggested next step and why.'],
  ['#today', 'Your Top 3 for today. They lead the nudges. + Add task opens the task form (or press N).'],
  ['#deadlines', 'Tasks due in the next week. Overdue and today in amber.'],
  ['.area .name', 'Project name. Click to see all its tasks.'],
  ['.area .status', 'How the project is doing: moving, a streak, or how long it\'s been quiet. Hover for Pause, when it\'s quiet on purpose.'],
  ['.area .meter', 'Progress: work done in the last 30 days against what\'s left, by estimate. Green when everything is done.'],
  ['.area .step', 'The project\'s next step: the top task in Todoist. Tick it or start a timer.'],
  ['.time', 'Pick how much time you have and see the tasks whose estimates fit.'],
  ['#postit', 'A sticky note. Saves as you type and syncs through your Chrome account.'],
  ['#golden-section', 'Hand-picked sites instead of a feed. Thumbs up shows a site more often, thumbs down less. Shuffle for others.'],
  ['.spotify', 'Opens Spotify on a fresh playlist search for a mood.'],
];

export function mountHelp(dialog, box) {
  let tab = 'start';
  let explaining = false;

  function render() {
    dialog.innerHTML = `<div class="tips-head"><h2 id="help-title">Help</h2>
        <span><button class="btn" data-explain>Explain this page</button> <button class="btn quiet" data-close>Close</button></span></div>
      <nav class="help-tabs" role="tablist">${TABS.map(([id, label]) => `<button role="tab" class="btn chip" data-tab="${id}" aria-selected="${id === tab}">${label}</button>`).join('')}</nav>
      <div class="help-body" role="tabpanel">${BODY[tab]}</div>`;
  }

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) { dialog.close(); return; }
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.tab) { tab = b.dataset.tab; render(); }
    else if (b.hasAttribute('data-close')) dialog.close();
    else if (b.hasAttribute('data-explain')) { dialog.close(); startExplain(); }
  });

  // ---- explain mode ----
  const findHelp = (el) => {
    for (const [sel, text] of EXPLAIN) {
      const hit = el.closest?.(sel);
      if (hit && !hit.hidden && hit.offsetParent !== null) return { hit, text };
    }
    return null;
  };
  let current = null;
  function onMove(e) {
    const f = findHelp(e.target);
    if (current && current !== f?.hit) current.classList.remove('help-hit');
    if (!f) { box.hidden = true; current = null; return; }
    current = f.hit;
    current.classList.add('help-hit');
    box.textContent = f.text;
    box.hidden = false;
    const pad = 14, w = box.offsetWidth, h = box.offsetHeight;
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + w > innerWidth - 8) x = e.clientX - w - pad;
    if (y + h > innerHeight - 8) y = e.clientY - h - pad;
    box.style.left = `${Math.max(8, x)}px`;
    box.style.top = `${Math.max(8, y)}px`;
  }
  function stop(e) {
    if (e && e.type === 'keydown' && e.key !== 'Escape') return;
    if (e && e.type === 'click') { e.preventDefault(); e.stopPropagation(); }
    explaining = false;
    document.body.classList.remove('explaining');
    current?.classList.remove('help-hit');
    box.hidden = true;
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', stop, true);
    document.removeEventListener('keydown', stop, true);
    document.querySelector('.explain-bar')?.remove();
  }
  function startExplain() {
    if (explaining) return;
    explaining = true;
    document.body.classList.add('explaining');
    const bar = document.createElement('div');
    bar.className = 'explain-bar';
    bar.textContent = 'Explain mode: hover over anything. Click anywhere or press Esc to stop.';
    document.body.append(bar);
    document.addEventListener('mousemove', onMove, true);
    // Defer so the click that started explain mode doesn't end it.
    setTimeout(() => {
      document.addEventListener('click', stop, true);
      document.addEventListener('keydown', stop, true);
    }, 0);
  }

  render();
  return {
    open(t) { if (t) tab = t; render(); dialog.showModal(); },
    explain: startExplain,
  };
}
