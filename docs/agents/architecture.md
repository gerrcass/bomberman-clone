# Architecture for agents

The game is split so that parallel work can land without fighting over the same files. Dependencies point inward: `app` may import `game`, `render`, and `audio`; `render` and `audio` may import read-only game types; `game` imports nothing from the browser layers.

## Module map

| Area | Owns | May import |
| --- | --- | --- |
| `src/game/` | Arena generation, seeded RNG, movement, bombs, blasts, pickups, rival AI, run rules, scoring, upgrades | Game modules only; no DOM, Canvas, or Web Audio |
| `src/render/` | Sprite generation, Canvas drawing, particles, screen shake | `src/game` types and read-only state |
| `src/audio/` | Synthesized SFX, music loop, audio unlock | `src/game` event types |
| `src/app/` | Fixed-timestep loop, keyboard input, screen state, DOM UI, persistence, wiring | Everything |

## Invariants

- The simulation advances in fixed 1/60-second ticks. The app loop owns wall-clock time and the accumulator.
- All gameplay randomness is seeded. Arena seed derives from the run seed and stage number. AI tie-breaks use the same generator.
- The renderer and UI never mutate gameplay state. They read a snapshot/state object and consume events.
- Public simulation/run entry points are the test seam. Tests build arenas from ASCII fixtures and step the simulation; they do not reach into private helpers.
- Bombers move on a grid with smooth interpolation. Walls, bricks, and bombs block entry; bombers pass through each other.
- A moving rival is treated as occupying `movement.to`. If a live blast appears under that destination, the rival reverses instead of finishing the step.
- Blast rays stop at walls and after destroying one brick. They chain-detonate bombs in the same tick, last 450 ms, and spare revealed power-ups.
- A run carries lives, score, stage, and upgrades; a stage carries the arena, bombers, bombs, blasts, pickups, and AI state.
- Presentation preferences (sound, music, screen shake, reduced motion, high contrast) are read from the profile, never stored in the simulation.

## Gameplay seams

- `src/game/run.ts` owns the endless loop: lives, score, stage advancement, intermission state, and run statistics.
- `src/game/ai.ts` owns danger maps, escape paths, and rival decisions. Its decisions must use the rival's destination tile (`movement.to`) when a step is in progress.
- `src/game/upgrades.ts` owns the draft pool, caps, and stat derivation.
- `src/app/profile.ts` owns the versioned localStorage profile and settings; malformed or unavailable storage degrades to defaults.

## Worktree ownership

One agent owns a worktree at a time. The integration branch is shared, but a worktree is not. Check `git status` and `git log -1` before committing or merging; uncommitted edits can come from another session.

Mergers should preserve the module boundaries above. A change that makes `src/game` import a browser API is a design regression.
