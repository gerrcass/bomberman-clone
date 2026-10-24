# Browser verification

Use this checklist for any change that touches screens, Canvas, audio, input, or presentation. Unit tests do not cover layout clipping, focus order, or synthesizer startup.

## Production smoke test

```bash
npm run build
npm run preview -- --port 4173 --strictPort
```

Open **`http://localhost:4173/`**. Prefer `localhost` over `127.0.0.1`: Vite preview may bind only to the IPv6 loopback.

Check:

- Title shows the persisted best score and best stage, today's Daily Best, and the last run.
- Play starts an Endless Run; the HUD, arena, rivals, and player render.
- Daily Run starts a run with the `Daily Run` label and today's date in the stage intro.
- Records opens from the title and shows the same bests and history as `bomb-blitz.profile.v2`.
- Arrow keys/WASD move; Space places a bomb; Escape/P pauses; M mutes.
- Pause offers Resume, Settings, and a confirmed Quit Run.
- Settings toggles save immediately and survive a reload.
- How to Play fits without layout overflow and explains Daily Runs and Records.
- The browser console has no exceptions.
- The Network panel requests only the built JS, CSS, and bundled font.

## Screen-state checks

`window.__bombBlitzDebug` exists only in `npm run dev` and only renders production DOM through the real screen functions:

```bash
npm run dev -- --port 5174 --strictPort
```

Then call `__bombBlitzDebug.showIntermission()` or `__bombBlitzDebug.showGameOver()` from the console.

Verify the intermission draft has three distinct cards, keyboard selection works with 1–3/Tab/Enter, and the game-over screen shows score, stage, bricks, rivals, pickups, and time.

## Records and Daily Run checks

Use the dev harness for seeded states, and a real run for the end-to-end path:

- **Title:** confirm the all-time best line, today's Daily Best with the date (or
  an explicit empty state), and the last-run line (or `LAST RUN — none yet`).
- **Empty history:** with no stored runs, the Records screen explains how to create the first record instead of showing a blank list.
- **Populated history:** finish a run, then open Records. Mode, local date, score, stage, bricks, rivals, pickups, time, and Technique chips match the run. Finish 21 runs (or seed the profile) and confirm the list keeps the newest 20.
- **Persistence:** reload after a run; the title's bests, today's Daily Best, last-run line, and Records all survive.
- **Daily Run:** start from the title. Confirm the stage intro names `Daily Run` and the date, the seed repeats when you retry, and the game-over screen shows the Daily Best and `New daily best!` only when improved. Confirm the all-time `New best!` still appears for both modes.
- **Retry:** Retry Run starts another run in the same mode; an Endless Run gets a fresh seed and a Daily Run reuses its captured date seed.
- **New date:** seed or inject a different date in the dev harness and confirm the Daily Best starts empty while older daily records remain in history.
- **Keyboard:** Tab to Records, press Enter, Tab/Shift+Tab inside the dialog, Escape to close, and confirm focus returns to the Records control.
- **Small window:** resize narrow; the records list scrolls inside the panel and the canvas does not clip.
- **High Contrast and Reduced Motion:** confirm mode badges and Technique chips stay distinct, and the Records screen adds no mandatory animation.
- **No traffic:** the Network panel still requests only the built assets.

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

Capture screenshots only when a change affects the README or a ticket's acceptance criteria. Keep committed screenshots in `docs/screenshots/` and reference them with relative paths.
