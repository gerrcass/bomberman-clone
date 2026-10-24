# Browser verification

Use this checklist for any change that touches screens, Canvas, audio, input, or presentation. Unit tests do not cover layout clipping, focus order, or synthesizer startup.

## Production smoke test

```bash
npm run build
npm run preview -- --port 4173 --strictPort
```

Open **`http://localhost:4173/`**. Prefer `localhost` over `127.0.0.1`: Vite preview may bind only to the IPv6 loopback.

Check:

- Title shows the persisted best score and best stage, today's Daily Best, the last run, and the Seed Run action.
- Play starts an Endless Run; the HUD, arena, rivals, and player render.
- Daily Run starts a run with the `Daily Run` label and today's date in the stage intro.
- Seed Run opens the setup; a valid Seed Code starts a run with `Seed Run · <Seed Code>` in the stage intro.
- Records opens from the title and shows the same bests and history as `bomb-blitz.profile.v3`.
- Game over names the Run Mode, shows the Seed Code, and offers Copy Seed Link.
- Arrow keys/WASD move; Space places a bomb; Escape/P pauses; M mutes.
- Pause offers Resume, Settings, and a confirmed Quit Run.
- Settings toggles save immediately and survive a reload.
- How to Play fits the 1280x900 screen without internal scrolling, explains Stage Themes, Daily Runs, Seed Runs, Seed Codes, Replay seed, Share Links, and Records, and on short windows scrolls internally without page overflow and opens with visible focus at the top.
- The browser console has no exceptions.
- The Network panel requests only the built JS, CSS, and bundled font.

## Automated smoke

```bash
npm run test:smoke
```

This builds the production bundle, starts preview and the dev harness, and runs Playwright against both. It covers the title Seed Run action, Seed Code validation, deep-link cleanup, Records replay, the v2→v3 migration, the clipboard fallback, the Stage 1 theme line and shell attribute, and a dev-harness run for each Stage Theme. CI runs it on every push and pull request.

## Harness and isolation

- Use a fresh browser context for each pass. A shared page can carry a profile from an earlier run and make migration or history checks lie.
- Clear `localStorage` before checks that start from defaults; seed only the key under test.
- Prefer `localhost` for preview. If `agent-browser` hangs, use the chrome-devtools MCP with an explicit page ID; do not keep retrying a stuck CLI.
- Use `window.__bombBlitzDebug` only with `npm run dev`; it is absent from the production build.

## Screen-state checks

`window.__bombBlitzDebug` exists only in `npm run dev` and only renders production DOM through the real screen functions:

```bash
npm run dev -- --port 5174 --strictPort
```

Then call `__bombBlitzDebug.showIntermission()` or `__bombBlitzDebug.showGameOver()` from the console.

Verify the intermission draft has three distinct cards, keyboard selection works with 1–3/Tab/Enter, and the game-over screen shows score, stage, bricks, rivals, pickups, and time.

- **How to Play keyboard:** open it with Tab/Enter. The heading receives focus with a visible ring at the panel top; Tab reaches Back; Escape closes the dialog and returns focus to How to Play. At 800x600 and 640x480 the page does not overflow and the panel scrolls internally.

## Seed Run and Share Link checks

Use a clean profile for the first pass, then the dev harness for a seeded setup.

- **Setup:** activate Seed Run with Tab/Enter. The dialog explains that the same
  code reproduces the arena sequence and draft offers, not the player's actions.
  The input is focused; Start and Back are both reachable.
- **Valid code:** enter `1z141z3 ` with lowercase and surrounding whitespace.
  Start opens the stage intro with `Seed Run · 1Z141Z3`; game over repeats the
  mode and code, and Retry Run keeps the same code.
- **Zero:** `0` is valid; it starts a run and game over shows `Seed · 0`.
- **Invalid code:** submit an empty value, `!`, `ZZZZZZZ`, and `1Z141Z4` (above
  `0xFFFFFFFF`). Each keeps the setup open, shows the inline error, focuses the
  input, and sets `aria-invalid`; no run starts.
- **Keyboard:** Tab and Shift+Tab cycle inside the dialog, Enter submits, and
  Escape or Back closes it and returns focus to the title's Seed Run action.
- **Stage intro:** a Seed Run names its canonical Seed Code, a Daily Run names
  its date, and an Endless Run keeps the existing intro without a mode line.
- **Game over:** names the mode and shows the Seed Code for every new run. Copy
  Seed Link is reachable by Tab and activates with Enter or Space.
- **Copy success:** with clipboard permission, activate Copy Seed Link. A live
  status confirms the copy, and the clipboard holds the current page URL with
  `?seed=<canonical code>`; the deployed path, other parameters, and the hash
  survive.
- **Clipboard denied:** block or remove `navigator.clipboard` (or deny the
  permission). Activate Copy Seed Link; a readonly, selectable Share Link
  appears, receives focus, and the status explains that it must be copied
  manually. The failure is never silent.
- **Valid deep link:** open `<path>?seed=1z141z3`. The title loads and the Seed
  Run setup opens with `1Z141Z3` filled and Start focused; no run starts. The
  address bar drops only `seed`, and other parameters plus the hash survive.
  Refreshing shows the title, not the setup.
- **Invalid deep link:** `?seed=ZZZZZZZ`, `?seed=`, or a malformed query opens
  the normal title, never a broken setup. The invalid `seed` parameter is
  removed where the History API allows.
- **Subpath:** a Share Link generated from a preview subpath keeps that path.

## Records and Daily Run checks

Use the dev harness for seeded states, and a real run for the end-to-end path:

- **Title:** confirm the all-time best line, today's Daily Best with the date (or
  an explicit empty state), and the last-run line (or `LAST RUN — none yet`).
- **Empty history:** with no stored runs, the Records screen explains how to create the first record instead of showing a blank list.
- **Populated history:** finish a run, then open Records. Mode, local date, score, stage, bricks, rivals, pickups, time, and Technique chips match the run. Finish 21 runs (or seed the profile) and confirm the list keeps the newest 20.
- **Seed Run record:** finish a Seed Run. Records shows a Seed badge, the Seed
  Code line, and a Replay seed button beside the matching record.
- **Replay seed:** activate a record's Replay seed with Enter or Space. Records
  closes and the stage intro names a Seed Run with that stored Seed, without
  visiting the setup first.
- **Daily replay:** a Daily Run record with a Seed replayed through Replay seed
  becomes a Seed Run with that Seed; it does not claim the original daily date.
- **Persistence:** reload after a run; the title's bests, today's Daily Best, last-run line, and Records all survive, including Seed Code lines.
- **Daily Run:** start from the title. Confirm the stage intro names `Daily Run` and the date, the seed repeats when you retry, and the game-over screen shows the Daily Best and `New daily best!` only when improved. Confirm the all-time `New best!` still appears for every mode.
- **Retry:** Retry Run starts another run in the same mode; an Endless Run gets a fresh seed, a Daily Run reuses its captured date seed, and a Seed Run reuses its Seed Code.
- **New date:** seed or inject a different date in the dev harness and confirm the Daily Best starts empty while older daily records remain in history.
- **Keyboard:** Tab to Records, press Enter, Tab/Shift+Tab inside the dialog, Escape to close, and confirm focus returns to the Records control.
- **Small window:** resize narrow; the records list scrolls inside the panel, the seed line and Replay seed stay usable, and the canvas does not clip.
- **High Contrast and Reduced Motion:** confirm mode badges, Seed Code lines, Replay seed buttons, and Technique chips stay distinct, and the Records screen adds no mandatory animation.
- **No traffic:** the Network panel still requests only the built assets.

## Stage Theme checks

Stage 1 is always Pillar Hall; later themes come from the Seed. Use the dev
harness for the other three instead of playing to their Stage.

- **Stage 1:** start Play. The intro names `PILLAR HALL` between the Stage number
  and the rival line, the shell carries `data-theme="pillar-hall"`, and the
  arena shows the blue-grey Pillar Hall lattice.
- **Four palettes:** with `npm run dev`, call
  `__bombBlitzDebug.startThemeRun('brickworks')`, `'crossroads'`, and
  `'twin-courts'` from the console. Each intro names the theme, the shell
  attribute matches, and the arena shows that theme's walls, brick density, and
  palette. The player, rivals, bombs, blasts, and power-ups keep their usual
  colours in every theme.
- **Intro line:** the theme name sits between the Stage number and the rival
  line; the Run Mode line, Stage number, and rival count keep their existing
  text and order. The intro still fits at 1280x900 and in a small window.
- **Seed reproducibility:** start a Seed Run with `1Z141Z3` and note the Stage 2
  theme in the intro. Retry Run and reach Stage 2 again; the theme matches. A
  Daily Run retry also keeps its sequence; a retry after an Endless Run gets a
  new Seed and may get a different order.
- **Backdrops:** the title, How to Play, Settings, Seed Run setup, and Records
  opened from the title show Pillar Hall. Pause, game over, and Records opened
  from game over keep the run's stage and `data-theme`; the theme accent is a
  stage-intro treatment and is not visible on those screens.
- **High Contrast:** repeat the four harness runs with High Contrast on. Walls,
  bricks, blasts, and pickups stay distinct in every palette, and the theme name
  stays at full white contrast.
- **Reduced Motion:** repeat one themed run with Reduced Motion on. The theme
  stays readable and adds no mandatory animation.
- **Small window:** at 800x600 and 640x480 the theme line stays inside the stage
  frame, the intro does not clip, and the page does not overflow.
- **No traffic:** the Network panel still requests only the built assets.

## Profile v3 migration checks

Seed `bomb-blitz.profile.v2`, remove `bomb-blitz.profile.v3`, and reload:

- The same high score, best stage, runs played, settings, Run History, and Daily
  Best appear on the title and Records.
- Every migrated record is readable and has no Seed Code line or Replay seed
  action.
- `bomb-blitz.profile.v2` is unchanged, and `bomb-blitz.profile.v1` is untouched
  or absent.
- Toggle a setting or finish a run to write `bomb-blitz.profile.v3`; saves write
  only that key and the old keys stay unchanged.
- With v3 present, change v2 to different values and reload. v3 wins.
- Corrupt the v3 value and reload. Defaults appear and the game still works; v2
  is not resurrected.
- With v3 absent, corrupt v2 and reload. Defaults appear; v1 is not read.
- **Storage failure:** block `localStorage` or make `setItem` throw. The title,
  a run, and Settings remain usable, and the console has no exceptions.

## Technique checks

Draft a technique in a real run, or render one through the dev harness:

- The intermission marks the card as a technique and shows an Equip state, and the other two cards are stat cards.
- The HUD technique strip appears once a technique is owned and stays legible at the narrowest window.
- **Bomb Kick:** kick a bomb down a corridor; it slides and stops at the expected blocker, and you can follow it.
- **Remote Detonation:** place two bombs, press `X`, and confirm both detonate at once; leave a bomb alone and confirm the fuse still fires.
- **Piercing Blast:** bomb a brick line; every brick in range breaks and revealed power-ups survive.
- Reduced Motion leaves sliding bombs readable; High Contrast keeps piercing blasts and technique chips distinct.

## Presentation checks

- Toggle Reduced Motion and confirm shake and non-essential animation stop.
- Toggle High Contrast and confirm floor, walls, bricks, blasts, and pickups separate clearly.
- Resize to a small window and confirm the canvas letterboxes without scrollbars or clipping.
- Tab through every screen and confirm a visible focus ring and a logical order.
- Hide the tab during play and confirm the game returns paused.

## Evidence

Follow the evidence gate in `docs/agents/pr-evidence.md`. For a visual change, capture before and after from the production build at the same 1280×900 viewport and an isolated browser context. Upload both with `gh --attach` when opening or updating the PR; the gate rejects external image and video hosts. A committed pair goes under `docs/evidence/<slug>/`. README screenshots are current-state documentation, not the PR evidence pair.
