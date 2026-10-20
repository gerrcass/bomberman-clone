<img src="assets/icon.svg" width="64" height="64" alt="">

# Bomb Blitz

Bomb Blitz is a browser Bomberman clone: a single-player, endless arena run of
maze combat against AI rivals. It is a static Vite + strict TypeScript + Canvas
2D game with a deterministic simulation, runtime-generated pixel art, and no
backend.

This branch is the bomb-layer vertical slice: title screen, generated arena,
smooth grid movement, placeable bombs, cross-shaped blasts, brick destruction,
lives, respawns, a basic game-over screen, HUD, pausing, and CI. Power-ups,
rivals, upgrades, and the profile/menu screens arrive in later tickets.

## Setup

Requires Node.js 22.12 or newer.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Controls

| Input | Action |
| --- | --- |
| Arrow keys or WASD | Move up, down, left, right |
| Space | Place a bomb |
| Escape or P | Pause / resume |
| Tab, Enter | Move focus and activate menu buttons |

Every screen and action is keyboard-operable. Movement is tile-to-tile with
smooth interpolation: a held direction keeps moving, a perpendicular tap is
buffered for the next tile center, and reversing mid-step turns around
immediately. Walls, bricks, and bombs block entry.

## Objective

The finished game is an endless run: clear each stage by defeating every rival,
collect power-ups hidden under bricks, and draft one of three upgrades between
stages. The run ends when the player's lives are exhausted; best score and best
stage persist locally.

This slice provides the arena shell plus the bomb layer: start a run, place
bombs on the tile you occupy (or leave behind mid-step), blow up the first brick
in each direction, chain reactions through touching bombs, and dodge your own
blasts. A blast costs a life; the player respawns at the safest spawn corner
after 1.5 seconds with 2.5 seconds of invulnerability. Losing the last life
opens a game-over screen with the final score and Retry Run / Title buttons.

## Project structure

```text
index.html                  App shell: canvas, HUD, title and pause overlays
src/main.ts                 Browser entry point
src/styles.css              Arcade theme and responsive layout
src/game/                   Deterministic simulation (no DOM, Canvas, or audio)
  rng.ts                    Seeded Mulberry32 generator
  types.ts                  Directions, tiles, intents, state, and events
  arena.ts                  Arena generation and ASCII fixtures
  movement.ts               Tile-to-tile movement and buffering
  stage.ts                  Public stage seam: createStage/tickStage/getStageState
  index.ts                  Game barrel
src/render/                 Runtime-generated pixel art and Canvas renderer
src/app/                    Fixed-step loop, keyboard input, screens, and HUD
.github/workflows/ci.yml    Push and pull-request checks
```

Tests live beside the game and app modules as `*.test.ts`. Game tests never
touch a browser: they build stages from seeds or ASCII arena fixtures.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Typecheck and build the static production bundle |
| `npm run preview` | Serve the production build |
| `npm run test` | Run Vitest once |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm run lint` | Run Biome checks |
| `npm run format` | Apply Biome formatting and safe fixes |
| `npm run check` | Lint, typecheck, test, and build |

## Testing

Vitest covers arena generation invariants (dimensions, border, lattice pillars,
spawn clearance, brick density, seed reproducibility), movement rules, bomb
placement and capacity, fuse timing, blast geometry and lifetime, wall and brick
stopping, chain reactions, lives and respawns, and fixed-seed determinism at
the stage seam. Scenarios use small ASCII arena fixtures so each case reads as
a maze:

```ts
const stage = createStage({
  seed: 1,
  arena: ['#######', '#.....#', '#..#..#', '#P....#', '#.....#', '#######'],
});
tickStage(stage, { direction: 'right' });
```

Useful stage API:

```ts
const stage = createStage({
  seed,
  stage: 1,
  arena?, // ASCII fixture
  playerSpawn?,
  bombCapacity?, // default 1
  blastRange?, // default 1
  fuseMs?, // default 2200
  lives?, // default 3
});
const events = tickStage(stage, { direction: 'left', bomb: false });
const state = getStageState(stage);
```

Each tick is exactly 1/60 second. `state.bombs`, `state.blasts`,
`state.player.alive`, `state.player.invulnerableTicks`, and
`state.player.respawnTicks` expose the bomb and life state to the renderer,
HUD, and tests. Events are additive: `bomb-placed`, `bomb-detonated`,
`blast-started`, `brick-destroyed`, `player-hit`, `life-lost`, `respawned`, and
`game-over` join the movement events. See `src/game/stage.test.ts`,
`src/game/movement.test.ts`, and `src/game/bombs.test.ts` for the determinism,
snapshot, and rules contracts.

## Static build

`npm run build` writes a self-contained static site to `dist/`. The Vite base is
relative, so it can be served from a subpath or any static host. `npm run
preview` serves the built output locally.

The app fetches nothing at runtime: sprites are generated from pixel matrices
and the UI uses a local monospace stack.

## CI

GitHub Actions runs on every push and pull request with Node 22:

```text
npm ci
npm run check
```

Created in [T3 Code](https://t3.codes).
