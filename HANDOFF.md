# Handoff: working on Nudge

This file is for an AI coding agent (or a person) about to customise or audit Nudge. Read it before changing anything. The user-facing story is in [README.md](README.md). This file covers how the parts fit together, what's fragile, and how to check a change.

## What it is

A Chrome Manifest V3 extension, about 4,000 lines of plain JavaScript (ES modules). It has no build step, no dependencies and no server. It replaces the new tab page, reads the user's Todoist through Todoist's REST API, and sends Chrome notifications.

**Todoist is the source of truth for tasks.** Nudge stores only:
- its own settings
- a cached snapshot of Todoist data
- logs for the focus timer and breaks
- small UI state

To run it, open `chrome://extensions`, choose **Load unpacked**, and pick the repo folder. After any change, click the reload arrow on the extension's card. A new tab page alone doesn't reload the background code.

## Map

```
manifest.json      MV3; permissions: storage, alarms, notifications, idle, webNavigation
background.js      service worker: alarms, notifications, pause redirect, Todoist sync, all writes, message router
engine.js          pure logic: computeState(), nudge candidates and scoring, deadlines, briefing, AI payload
daily.js           pure: logical day (04:00 default), Top 3, streaks, break budget, shutdown/review timing
tracking.js        pure: focus/break minutes, 7-day stats, task-estimate work time
voice.js           every built-in line of text; say(kind, vars, seed) picks one deterministically
todoist.js         API client (api.todoist.com/api/v1): fetchSnapshot, add/close/delete, sync commands
taskform.js        pure: add-task form → Todoist sync commands
ai.js              optional Claude wording (Anthropic Messages API, direct browser access)
newtab.html/js     the main page; renders everything from one getData() call
addtask.js, today.js, review.js, help.js, shortcuts.js, postit.js, weather.js,
goldenui.js, corner.js, music.js, wellness.js, golden.js   UI pieces and content
pause.html/js      the reddit/Facebook pause screen
options.html/js    settings, backup export/import, weather place search
style.css          one stylesheet for all pages; light/dark tokens at the top, later blocks override earlier ones
test/              node:test unit tests + background.harness.mjs (a fake chrome.* and fake Todoist)
docs/              README screenshots (rendered from made-up demo data)
```

## How data flows

1. **The background fetches.** `refresh()` in `background.js` calls `fetchSnapshot()`, which gets projects, sections, open tasks and 30 days of completed tasks, and stores the result as `snapshot` in `chrome.storage.local`. It runs:
   - on the `sync` alarm, every 15 minutes, skipped when the user has been away for more than 20 minutes
   - when a page asks for data older than 5 minutes
   - when forced
2. **The state is computed.** `computeState(snapshot, settings)` in `engine.js` turns the raw data into areas. An area is a section, or a project without sections. Each area gets `next`, `daysQuiet`, `stale`, `onHold`, `tracked`, `leisure`, and so on. Everything else reads from this state.
3. **Pages render.** Pages send `{type:'getData'}`, receive the snapshot, settings and logs, and run `computeState` locally to render. Pages never call Todoist directly. Every write (complete, create, move, delete, focus, breaks, settings) goes through a message to the background.
4. **The `tick` alarm checks for reminders.** Every 5 minutes, and only when `chrome.idle` reports the user as active, it checks deadlines, shutdown, the weekly review, and then whether a regular nudge is due. A nudge is due once `activeMinutes` reaches the interval (default 150), scaled by the notify level and by how many tasks are done today.

### Message types (background router)

`getData`, `hello` (protocol check), `complete`, `createTask`, `moveTask`, `deleteTask`, `focusStart`, `focusDone`, `focusStop`, `startBreak`, `endBreak`, `shutdownDone`, `reviewDone`, `setOnHold`, `quietToday`, `saveSettings`, `testNudge`, `testBriefing`.

`PROTOCOL` in `background.js` and `newtab.js` must match. Bump both when you add or change a message, so a stale service worker shows the **Reload Nudge** bar instead of failing silently.

### Storage

- **`chrome.storage.local`:**
  - `settings`: see `DEFAULT_SETTINGS` in `engine.js`. Missing keys fall back to the defaults, so a new setting needs only a default and a control in options.
  - `snapshot`, `focusLog`, `breakLog`, `history`, `deadlineSent`, `goldenRatings`, `goldenRecent`, `weatherCache`
  - flags and timestamps (`quietUntil`, `snoozeUntil`, `startedAt`, `shutdownDone`, …)
- **`chrome.storage.sync`** (follows the user's Chrome account, roughly 100 KB total and 8 KB per key): `shortcuts`, `postit`, `top3`, `weatherPlace`.
- **One-off migrations** run in `onInstalled` with reason `update` and are guarded by flags: `migratedNoYoutube`, `migrated150`, `removedReminderTasks`.

## Conventions

- **Keep logic pure and testable.** `engine.js`, `daily.js`, `tracking.js` and `taskform.js` take `now` as a parameter and touch neither `chrome.*` nor the DOM.
- **Text lives in `voice.js`.** Each kind is a list of `[title, body]` pairs with `{vars}`. Titles must stay at 75 characters or fewer with worst-case values; `test/engine.test.mjs` enforces this. Any new `{var}` must also be added to that test's `vars`.
- **No libraries, no build.** If you need one, discuss it with the user first, because "unzip and load" is a feature.
- **Escape everything you put into `innerHTML`.** Each module has a small `esc()`. Task titles come from Todoist and site names from Open-Meteo; treat both as untrusted.
- **Layout:**
  - The new tab is a fixed full-height three-column grid (`body.newtab` in `style.css`) designed for a maximized desktop window; each column scrolls on its own and the page itself never scrolls.
  - Dark mode comes from `prefers-color-scheme` tokens at the top of `style.css`.
  - New CSS goes at the end of the file, in a commented block.
- **Wording style:** plain, short, friendly and a little dry. Praise what's done before pointing at what isn't. Never guilt-trip.

## Known limitations and sharp edges

- **Completed history covers only 30 days** (`fetchSnapshot(token, 30)`). That limit affects:
  - streaks
  - "quiet for N days", which shows `30d+`
  - progress bars
  - the 7-day chart's task-estimate time
- **Notifications don't survive Chrome closing.** MV3 alarms only run while Chrome runs. On Windows, Chrome's "continue running background apps" setting matters.
- **Pause screen:**
  - Redirects use `webNavigation`, including `onHistoryStateUpdated` for single-page sites, and a user can always work around them.
  - Reddit post URLs (`/comments/`, `/s/`, `/gallery/`) are let through on purpose.
- **The Todoist token sits in `chrome.storage.local` in plain text.** That's normal for extensions, but anyone with access to the Chrome profile can read it. Backup export removes `token` and `anthropicKey`, and import never takes them from a file.
- **`ai.js` calls Anthropic straight from the browser** using the `anthropic-dangerous-direct-browser-access` header. It's opt-in and uses the user's own key.
- **Day boundary:** `daily.js` keeps the configurable start hour in a module variable (`setDayStart`). Both the background and the new tab call it after loading settings. Any new entry point that uses `dayId()` must do the same.
- **`newtab.js` is long (~650 lines).** It renders per section (`renderX()` functions), and `render()` calls them all. It still works fine; splitting it is a reasonable refactor if a change gets painful.
- **The phone (Apps Script) prototype was dropped** and isn't in this repo.

## How to check a change

```
node --test test/engine.test.mjs test/golden.test.mjs test/taskform.test.mjs test/tracking.test.mjs test/daily.test.mjs
node test/background.harness.mjs      # prints ok lines, ends with ALL PASSED
for f in *.js; do node --check "$f"; done
```

The harness fakes `chrome.*`, time and the Todoist API. If you call a new `chrome.*` API from `background.js`, add a fake for it there, or the import throws.

**The tests check the logic, not the pages.** For UI changes, load the extension and look at the new tab in both light and dark mode, ideally at 125% Windows scaling on a 1440p screen, since that's what it was tuned for.

The README screenshots were rendered by serving the folder over HTTP and injecting a mock `chrome` object with demo data into headless Chromium. That script isn't in the repo. Recreate it only if the screenshots need updating.

## Audit checklist

1. **`innerHTML`:** grep every use and confirm each interpolated value is escaped or is a constant.
2. **Network:** only `api.todoist.com`, `api.open-meteo.com`, `geocoding-api.open-meteo.com`, `www.google.com/s2/favicons` and, if enabled, `api.anthropic.com`. Compare against `host_permissions` in `manifest.json`.
3. **Writes to Todoist:** only `createTask`, `complete`, `moveTask`, `deleteTask`, focus subtasks, and the one-time cleanup of the old reminder tasks (`deleteOldReminderTasks`). That cleanup matches only task IDs Nudge recorded, or Inbox tasks with its exact old wording.
4. **Notification volume:** read `tick()`, `checkDeadlines()` and `sessionStart()` in `background.js`. The quiet rules are:
   - 10 minutes of quiet after Chrome starts
   - `quietUntil` silences everything
   - snooze silences everything except deadlines
   - per-kind switches in settings
   - easing off after 3 or 5 tasks done in a day
5. **Background cost:** the service worker wakes every 5 minutes for `tick` and every 15 for `sync`. Neither fetches unless the data is stale and the user is around.
