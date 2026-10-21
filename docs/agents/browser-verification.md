# Browser verification

Use this checklist for any change that touches screens, Canvas, audio, input, or presentation. Unit tests do not cover layout clipping, focus order, or synthesizer startup.

## Production smoke test

```bash
npm run build
npm run preview -- --port 4173 --strictPort
```

Open **`http://localhost:4173/`**. Prefer `localhost` over `127.0.0.1`: Vite preview may bind only to the IPv6 loopback.

Check:

- Title shows the persisted best score and best stage.
- Play starts a run; the HUD, arena, rivals, and player render.
- Arrow keys/WASD move; Space places a bomb; Escape/P pauses; M mutes.
- Pause offers Resume, Settings, and a confirmed Quit Run.
- Settings toggles save immediately and survive a reload.
- How to Play fits without layout overflow.
- The browser console has no exceptions.
- The Network panel requests only the built JS, CSS, and bundled font.

## Screen-state checks

`window.__bombBlitzDebug` exists only in `npm run dev` and only renders production DOM through the real screen functions:

```bash
npm run dev -- --port 5174 --strictPort
```

Then call `__bombBlitzDebug.showIntermission()` or `__bombBlitzDebug.showGameOver()` from the console.

Verify the intermission draft has three distinct cards, keyboard selection works with 1–3/Tab/Enter, and the game-over screen shows score, stage, bricks, rivals, pickups, and time.

## Presentation checks

- Toggle Reduced Motion and confirm shake and non-essential animation stop.
- Toggle High Contrast and confirm floor, walls, bricks, blasts, and pickups separate clearly.
- Resize to a small window and confirm the canvas letterboxes without scrollbars or clipping.
- Tab through every screen and confirm a visible focus ring and a logical order.
- Hide the tab during play and confirm the game returns paused.

## Evidence

Capture screenshots only when a change affects the README or a ticket's acceptance criteria. Keep committed screenshots in `docs/screenshots/` and reference them with relative paths.
