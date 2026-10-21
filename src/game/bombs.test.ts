import { describe, expect, it } from 'vitest';
import type { Stage } from './stage';
import { createStage, getStageState, tickStage } from './stage';
import { BLAST_LIFETIME_TICKS, BRICK_POINTS, type StageEvent, type TileCoord } from './types';

/** Bottom-left player spawn with room to walk along the bottom row. */
const OPEN_ROOM = ['#########', '#.......#', '#.......#', '#.......#', '#P......#', '#########'];

/** Player in the middle of a room for blast geometry checks. */
const CENTER_ROOM = ['#######', '#.....#', '#.....#', '#..P..#', '#.....#', '#.....#', '#######'];

/** A single interior wall directly to the right of the player. */
const WALL_ROOM = ['#########', '#.......#', '#.......#', '#..P#...#', '#.......#', '#########'];

/** A single brick directly to the right of the player. */
const BRICK_ROOM = ['#########', '#.......#', '#.......#', '#..PB...#', '#.......#', '#########'];

/** A one-row corridor wide enough for a three-bomb chain reaction. */
const CORRIDOR = ['###########', '#P........#', '#.........#', '###########'];

function stageFrom(
  rows: readonly string[],
  options: Partial<Parameters<typeof createStage>[0]> = {},
) {
  return createStage({ seed: 1, arena: rows, ...options });
}

function tickMany(stage: Stage, ticks: number, intent: Parameters<Stage['tick']>[0] = {}): void {
  for (let index = 0; index < ticks; index += 1) {
    tickStage(stage, intent);
  }
}

function heldTicks(stage: Stage, ticks: number, direction: 'up' | 'down' | 'left' | 'right'): void {
  tickMany(stage, ticks, { direction });
}

function bombCount(stage: Stage): number {
  return getStageState(stage).bombs.length;
}

function collect(
  stage: Stage,
  ticks: number,
  intent: Parameters<Stage['tick']>[0] = {},
): StageEvent[] {
  const events: StageEvent[] = [];
  for (let index = 0; index < ticks; index += 1) {
    events.push(...tickStage(stage, intent));
  }
  return events;
}

function sortTiles(tiles: readonly TileCoord[]): TileCoord[] {
  return [...tiles].sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Places in the middle of CENTER_ROOM/WALL_ROOM/BRICK_ROOM and steps safe. */
function placeAndEscapeUp(stage: Stage): StageEvent[] {
  const events = [...tickStage(stage, { bomb: true })];
  events.push(...collect(stage, 30, { direction: 'up' }));
  return events;
}

/** Holds a direction until the player is mid-step away from the target tile. */
function holdUntilLeaving(
  stage: Stage,
  direction: 'up' | 'down' | 'left' | 'right',
  x: number,
  y: number,
): void {
  for (let index = 0; index < 120; index += 1) {
    tickStage(stage, { direction });
    const player = getStageState(stage).player;
    if (player.moving && player.from.x === x && player.from.y === y) {
      return;
    }
  }
  throw new Error(`Player never left ${x},${y}`);
}

describe('bomb placement', () => {
  it('places a bomb on the current tile when stationary', () => {
    const stage = stageFrom(OPEN_ROOM);

    const events = tickStage(stage, { bomb: true });
    const state = getStageState(stage);

    expect(state.bombs).toHaveLength(1);
    expect(state.bombs[0]).toMatchObject({
      id: 1,
      tile: { x: 1, y: 4 },
      owner: 'player',
      range: 1,
      fuseTicks: 132,
      fuseRemainingTicks: 132,
    });
    expect(state.activeBombs).toBe(1);
    expect(state.bombCapacity).toBe(1);
    expect(events).toContainEqual({
      type: 'bomb-placed',
      tick: 1,
      bombId: 1,
      tile: { x: 1, y: 4 },
      owner: 'player',
      fuseTicks: 132,
      range: 1,
    });
  });

  it('does not place a bomb once capacity is reached', () => {
    const stage = stageFrom(OPEN_ROOM);

    tickStage(stage, { bomb: true });
    const events = tickStage(stage, { bomb: true });

    expect(bombCount(stage)).toBe(1);
    expect(getStageState(stage).activeBombs).toBe(1);
    expect(events.some((event) => event.type === 'bomb-placed')).toBe(false);
  });

  it('places a bomb on the tile being left while mid-step without blocking the step', () => {
    const stage = stageFrom(OPEN_ROOM);

    heldTicks(stage, 5, 'right');
    const before = getStageState(stage).player;
    expect(before.moving).toBe(true);
    expect(before.from).toEqual({ x: 1, y: 4 });
    expect(before.to).toEqual({ x: 2, y: 4 });

    tickStage(stage, { direction: 'right', bomb: true });

    expect(getStageState(stage).bombs[0]?.tile).toEqual({ x: 1, y: 4 });

    heldTicks(stage, 10, 'right');
    const moved = getStageState(stage).player;
    expect(moved.position.x).toBeGreaterThan(2);
    expect(moved.to).not.toEqual({ x: 1, y: 4 });
  });

  it('blocks re-entry by the player after leaving a bomb behind', () => {
    const stage = stageFrom(OPEN_ROOM);

    tickStage(stage, { bomb: true });
    heldTicks(stage, 20, 'right');
    expect(getStageState(stage).player.position.x).toBeGreaterThan(2);

    heldTicks(stage, 60, 'left');

    const stopped = getStageState(stage).player;
    expect(stopped.from).toEqual({ x: 2, y: 4 });
    expect(stopped.to).toEqual({ x: 2, y: 4 });
    expect(stopped.moving).toBe(false);
  });

  it('refuses a mid-step reversal back onto the bomb just placed', () => {
    const stage = stageFrom(OPEN_ROOM);

    heldTicks(stage, 5, 'right');
    tickStage(stage, { direction: 'left', bomb: true });

    const state = getStageState(stage);
    expect(state.bombs[0]?.tile).toEqual({ x: 1, y: 4 });
    expect(state.player.direction).toBe('right');
    expect(state.player.from).toEqual({ x: 1, y: 4 });
    expect(state.player.to).toEqual({ x: 2, y: 4 });
  });

  it('honours capacity, range, and fuse stage options', () => {
    const stage = stageFrom(OPEN_ROOM, { bombCapacity: 2, blastRange: 2, fuseMs: 1000 });

    tickStage(stage, { bomb: true });
    const state = getStageState(stage);

    expect(state.bombCapacity).toBe(2);
    expect(state.blastRange).toBe(2);
    expect(state.bombs[0]).toMatchObject({ range: 2, fuseTicks: 60, fuseRemainingTicks: 60 });
  });
});

describe('blasts', () => {
  it('detonates after 2200 ms into a range-1 cross', () => {
    const stage = stageFrom(CENTER_ROOM);
    const events = placeAndEscapeUp(stage);

    expect(getStageState(stage).player.to).toEqual({ x: 3, y: 1 });

    events.push(...collect(stage, 101));
    const before = getStageState(stage);
    expect(before.tick).toBe(132);
    expect(before.bombs).toHaveLength(1);
    expect(before.bombs[0]?.fuseRemainingTicks).toBe(1);
    expect(before.blasts).toHaveLength(0);

    events.push(...collect(stage, 1));
    const after = getStageState(stage);

    expect(after.tick).toBe(133);
    expect(after.bombs).toHaveLength(0);
    expect(after.activeBombs).toBe(0);
    expect(sortTiles(after.blasts.map((blast) => blast.tile))).toEqual([
      { x: 3, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 3, y: 4 },
    ]);
    expect(after.blasts.every((blast) => blast.remainingTicks === BLAST_LIFETIME_TICKS)).toBe(true);
    expect(after.blasts.every((blast) => blast.remainingMs === 450)).toBe(true);
    expect(after.player.alive).toBe(true);

    expect(events).toContainEqual({
      type: 'bomb-detonated',
      tick: 133,
      bombId: 1,
      tile: { x: 3, y: 3 },
      owner: 'player',
      range: 1,
      chain: false,
    });
    expect(events).toContainEqual({
      type: 'blast-started',
      tick: 133,
      bombId: 1,
      tiles: [
        { x: 3, y: 3 },
        { x: 3, y: 2 },
        { x: 3, y: 4 },
        { x: 2, y: 3 },
        { x: 4, y: 3 },
      ],
    });
  });

  it('uses the configured fuse duration', () => {
    const stage = stageFrom(CENTER_ROOM, { fuseMs: 1000 });
    placeAndEscapeUp(stage);

    collect(stage, 29);
    const before = getStageState(stage);
    expect(before.tick).toBe(60);
    expect(before.bombs).toHaveLength(1);
    expect(before.bombs[0]?.fuseRemainingTicks).toBe(1);

    collect(stage, 1);
    expect(getStageState(stage).bombs).toHaveLength(0);
    expect(getStageState(stage).blasts.length).toBeGreaterThan(0);
  });

  it('stops a ray at a wall without producing a blast tile', () => {
    const stage = stageFrom(WALL_ROOM);
    placeAndEscapeUp(stage);

    collect(stage, 102);
    const state = getStageState(stage);

    expect(sortTiles(state.blasts.map((blast) => blast.tile))).toEqual([
      { x: 3, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 3, y: 4 },
    ]);
  });

  it('destroys the first brick, awards points once, and stops the ray', () => {
    const stage = stageFrom(BRICK_ROOM);
    const events = placeAndEscapeUp(stage);

    events.push(...collect(stage, 102));
    const state = getStageState(stage);

    expect(state.arena.tiles[3 * state.arena.width + 4]).toBe('floor');
    expect(state.score).toBe(BRICK_POINTS);
    expect(sortTiles(state.blasts.map((blast) => blast.tile))).toContainEqual({ x: 4, y: 3 });
    expect(state.blasts.some((blast) => blast.tile.x === 5 && blast.tile.y === 3)).toBe(false);

    const destroyed = events.filter((event) => event.type === 'brick-destroyed');
    expect(destroyed).toEqual([
      { type: 'brick-destroyed', tick: 133, tile: { x: 4, y: 3 }, points: BRICK_POINTS },
    ]);

    // The blast tile remains over the new floor for its lifetime, but the
    // brick can never award points twice.
    const laterEvents = collect(stage, 100);
    expect(getStageState(stage).score).toBe(BRICK_POINTS);
    expect(laterEvents.some((event) => event.type === 'brick-destroyed')).toBe(false);
  });

  it('chain-detonates every bomb reached by a blast in the same tick', () => {
    const stage = stageFrom(CORRIDOR, { bombCapacity: 3 });

    tickStage(stage, { bomb: true });
    holdUntilLeaving(stage, 'right', 2, 1);
    tickStage(stage, { direction: 'right', bomb: true });
    holdUntilLeaving(stage, 'right', 3, 1);
    tickStage(stage, { direction: 'right', bomb: true });

    expect(getStageState(stage).bombs.map((bomb) => bomb.tile)).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ]);

    const ticksUntilDetonation = 133 - getStageState(stage).tick;
    const events = collect(stage, ticksUntilDetonation, { direction: 'right' });

    const state = getStageState(stage);
    expect(state.tick).toBe(133);
    expect(state.bombs).toHaveLength(0);
    expect(state.activeBombs).toBe(0);
    expect(state.player.alive).toBe(true);

    const detonations = events.filter((event) => event.type === 'bomb-detonated');
    expect(detonations).toEqual([
      {
        type: 'bomb-detonated',
        tick: 133,
        bombId: 1,
        tile: { x: 1, y: 1 },
        owner: 'player',
        range: 1,
        chain: false,
      },
      {
        type: 'bomb-detonated',
        tick: 133,
        bombId: 2,
        tile: { x: 2, y: 1 },
        owner: 'player',
        range: 1,
        chain: true,
      },
      {
        type: 'bomb-detonated',
        tick: 133,
        bombId: 3,
        tile: { x: 3, y: 1 },
        owner: 'player',
        range: 1,
        chain: true,
      },
    ]);

    const blastTiles = sortTiles(state.blasts.map((blast) => blast.tile));
    expect(blastTiles).toContainEqual({ x: 2, y: 1 });
    expect(blastTiles).toContainEqual({ x: 3, y: 1 });
    expect(blastTiles).toContainEqual({ x: 4, y: 1 });
  });

  it('keeps blast tiles lethal for exactly 450 ms', () => {
    const stage = stageFrom(CENTER_ROOM);
    placeAndEscapeUp(stage);
    collect(stage, 102);

    expect(getStageState(stage).blasts).toHaveLength(5);

    collect(stage, BLAST_LIFETIME_TICKS - 1);
    const lastTick = getStageState(stage);
    expect(lastTick.tick).toBe(159);
    expect(lastTick.blasts).toHaveLength(5);
    expect(lastTick.blasts.every((blast) => blast.remainingTicks === 1)).toBe(true);

    collect(stage, 1);
    expect(getStageState(stage).tick).toBe(160);
    expect(getStageState(stage).blasts).toHaveLength(0);
  });
});

describe('lives and respawn', () => {
  it('loses a life in a blast and respawns after 1.5 s at a safe corner', () => {
    const stage = stageFrom(OPEN_ROOM);

    tickStage(stage, { bomb: true });
    const events = collect(stage, 132);
    const hit = getStageState(stage);

    expect(hit.tick).toBe(133);
    expect(hit.lives).toBe(2);
    expect(hit.status).toBe('playing');
    expect(hit.player.alive).toBe(false);
    expect(hit.player.respawnTicks).toBe(90);
    expect(events).toContainEqual({
      type: 'player-hit',
      tick: 133,
      tile: { x: 1, y: 4 },
      cause: 'blast',
    });
    expect(events).toContainEqual({ type: 'life-lost', tick: 133, livesRemaining: 2 });

    // The stage keeps ticking while the player waits to respawn.
    collect(stage, 89);
    const waiting = getStageState(stage);
    expect(waiting.tick).toBe(222);
    expect(waiting.player.alive).toBe(false);
    expect(waiting.player.respawnTicks).toBe(1);

    const respawnEvents = collect(stage, 1);
    const respawned = getStageState(stage);

    expect(respawned.tick).toBe(223);
    expect(respawned.player.alive).toBe(true);
    expect(respawned.player.tile).toEqual({ x: 7, y: 1 });
    expect(respawned.player.position).toEqual({ x: 7, y: 1 });
    expect(respawned.player.invulnerableTicks).toBe(150);
    expect(respawned.player.respawnTicks).toBe(0);
    expect(respawned.lives).toBe(2);
    expect(respawnEvents).toContainEqual({
      type: 'respawned',
      tick: 223,
      tile: { x: 7, y: 1 },
      invulnerableTicks: 150,
    });
  });

  it('breaks equidistant respawn ties deterministically toward the player corner', () => {
    const stage = stageFrom(CENTER_ROOM);

    tickStage(stage, { bomb: true });
    collect(stage, 132);
    expect(getStageState(stage).player.alive).toBe(false);

    collect(stage, 90);
    expect(getStageState(stage).player.tile).toEqual({ x: 1, y: 5 });
  });

  it('does not kill the player during respawn invulnerability, then does once it expires', () => {
    const stage = stageFrom(OPEN_ROOM);

    tickStage(stage, { bomb: true });
    collect(stage, 132);
    collect(stage, 89);

    // The 90th tick of the respawn delay also places a bomb under the player.
    tickStage(stage, { bomb: true });
    const respawned = getStageState(stage);
    expect(respawned.player.alive).toBe(true);
    expect(respawned.bombs[0]?.tile).toEqual({ x: 7, y: 1 });
    expect(respawned.player.invulnerableTicks).toBe(150);

    collect(stage, 132);
    const shielded = getStageState(stage);
    expect(shielded.tick).toBe(355);
    expect(shielded.blasts.length).toBeGreaterThan(0);
    expect(shielded.player.invulnerableTicks).toBe(18);
    expect(shielded.player.alive).toBe(true);
    expect(shielded.lives).toBe(2);

    collect(stage, 17);
    const aboutToExpire = getStageState(stage);
    expect(aboutToExpire.tick).toBe(372);
    expect(aboutToExpire.player.invulnerableTicks).toBe(1);
    expect(aboutToExpire.player.alive).toBe(true);

    const events = collect(stage, 1);
    const exposed = getStageState(stage);

    expect(exposed.tick).toBe(373);
    expect(exposed.player.alive).toBe(false);
    expect(exposed.player.respawnTicks).toBe(90);
    expect(exposed.lives).toBe(1);
    expect(exposed.blasts.length).toBeGreaterThan(0);
    expect(events).toContainEqual({
      type: 'player-hit',
      tick: 373,
      tile: { x: 7, y: 1 },
      cause: 'blast',
    });
    expect(events).toContainEqual({ type: 'life-lost', tick: 373, livesRemaining: 1 });
  });

  it('ends the stage immediately when the last life is lost', () => {
    const stage = stageFrom(OPEN_ROOM, { lives: 1 });

    tickStage(stage, { bomb: true });
    const events = collect(stage, 132);
    const gameOver = getStageState(stage);

    expect(gameOver.tick).toBe(133);
    expect(gameOver.lives).toBe(0);
    expect(gameOver.status).toBe('gameover');
    expect(gameOver.player.alive).toBe(false);
    expect(gameOver.player.respawnTicks).toBe(0);
    expect(events).toContainEqual({ type: 'life-lost', tick: 133, livesRemaining: 0 });
    expect(events).toContainEqual({ type: 'game-over', tick: 133, score: 0 });

    // The final state is frozen: later ticks do nothing.
    expect(tickStage(stage, { direction: 'right' })).toEqual([]);
    expect(getStageState(stage)).toEqual(gameOver);
  });

  it('returns snapshots and events that cannot mutate simulation state', () => {
    const stage = stageFrom(OPEN_ROOM);
    const placed = tickStage(stage, { bomb: true });

    collect(stage, 132);
    const snapshot = getStageState(stage);

    const bombTile = snapshot.bombs[0]?.tile as { x: number; y: number } | undefined;
    if (bombTile !== undefined) {
      bombTile.x = 99;
    }
    const blastTile = snapshot.blasts[0]?.tile as { x: number; y: number } | undefined;
    if (blastTile !== undefined) {
      blastTile.y = 99;
    }
    const eventTile = placed[0]?.type === 'bomb-placed' ? placed[0].tile : undefined;
    if (eventTile !== undefined) {
      (eventTile as { x: number; y: number }).x = 99;
    }

    const fresh = getStageState(stage);
    expect(fresh.bombs).toHaveLength(0);
    expect(fresh.blasts.some((blast) => blast.tile.x === 1 && blast.tile.y === 4)).toBe(true);
  });

  it('replays identical bomb, blast, and life states for the same seed and intents', () => {
    const runScript = (stage: Stage): StageEvent[] => {
      const events: StageEvent[] = [];
      const directions = ['right', 'down', 'left', 'up'] as const;

      for (let index = 0; index < 420; index += 1) {
        const direction = directions[Math.floor(index / 40) % directions.length] ?? null;
        const bomb = index === 0 || index === 170;
        events.push(...tickStage(stage, { direction, bomb }));
      }
      return events;
    };

    const first = createStage({ seed: 2024, stage: 2, bombCapacity: 2, rivalCount: 0 });
    const second = createStage({ seed: 2024, stage: 2, bombCapacity: 2, rivalCount: 0 });

    const firstEvents = runScript(first);
    const secondEvents = runScript(second);

    expect(firstEvents).toEqual(secondEvents);
    expect(getStageState(first)).toEqual(getStageState(second));
    expect(getStageState(first).tick).toBe(420);
  });
});
