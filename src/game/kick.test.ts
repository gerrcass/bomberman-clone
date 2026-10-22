import { describe, expect, it } from 'vitest';

import type { Stage } from './stage';
import { createStage, getStageState, tickStage } from './stage';
import { INITIAL_TECHNIQUES, type TechniqueCounts } from './techniques';
import type { Direction, Intent, StageEvent, TileCoord } from './types';

const KICK: TechniqueCounts = { ...INITIAL_TECHNIQUES, kick: 1 };

/** Bottom-left player spawn with a clear lower lane. */
const ROOM = ['##########', '#........#', '#........#', '#P.......#', '##########'];

/** A single brick blocks the lane just past the bomb's first free tile. */
const BRICK_LANE = ['##########', '#P...B...#', '##########'];

/** Open at the right edge: out-of-bounds floor ends the slide. */
const EDGE_LANE = ['#####', '#P...'];

/** Rival boxed into the far end of the slide lane. */
const RIVAL_LANE = ['#########', '#......R#', '#########'];

/** Cinder opens by bombing the brick beside its spawn. */
const RIVAL_BOMB_ROOM = [
  '##########',
  '#........#',
  '#.RB.....#',
  '#........#',
  '#........#',
  '#........#',
  '#........#',
  '#P.......#',
  '##########',
];

function stageFrom(
  rows: readonly string[],
  options: Partial<Parameters<typeof createStage>[0]> = {},
): Stage {
  return createStage({ seed: 1, arena: rows, techniques: KICK, ...options });
}

function collect(
  stage: Stage,
  ticks: number,
  intent: Intent = {},
): { events: StageEvent[]; states: ReturnType<typeof getStageState>[] } {
  const events: StageEvent[] = [];
  const states: ReturnType<typeof getStageState>[] = [];
  for (let index = 0; index < ticks; index += 1) {
    events.push(...tickStage(stage, intent));
    states.push(getStageState(stage));
  }
  return { events, states };
}

function playerTile(stage: Stage): TileCoord {
  const player = getStageState(stage).player;
  return player.moving ? player.from : player.to;
}

/**
 * Walks to a tile one step at a time and stops exactly on its centre. The
 * direction is held for a single tick, then released, so the simulation can
 * never carry the player through the target centre into the next tile.
 */
function walkTo(stage: Stage, target: TileCoord): void {
  for (let guard = 0; guard < 1000; guard += 1) {
    const player = getStageState(stage).player;
    if (!player.moving && player.tile.x === target.x && player.tile.y === target.y) {
      return;
    }

    if (player.moving) {
      tickStage(stage, {});
      continue;
    }

    const dx = target.x - player.tile.x;
    const dy = target.y - player.tile.y;
    const direction: Direction = dx !== 0 ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    tickStage(stage, { direction });
  }

  throw new Error(`Player never reached ${target.x},${target.y}`);
}

function placeAt(stage: Stage, tile: TileCoord): void {
  walkTo(stage, tile);
  tickStage(stage, { bomb: true });
}

/** Player stands one tile left of the resting bomb and kicks it right. */
function kickRightFromLeft(stage: Stage, bombTile: TileCoord): readonly StageEvent[] {
  placeAt(stage, bombTile);
  walkTo(stage, { x: bombTile.x - 1, y: bombTile.y });
  return tickStage(stage, { direction: 'right' });
}

describe('Bomb Kick slide', () => {
  it('starts a slide and exposes from, to, progress, moving, and position', () => {
    const stage = stageFrom(ROOM);
    const events = kickRightFromLeft(stage, { x: 3, y: 3 });

    const kicked = events.find((event) => event.type === 'bomb-kicked');
    expect(kicked).toMatchObject({
      type: 'bomb-kicked',
      bombId: 1,
      owner: 'player',
      tile: { x: 3, y: 3 },
      direction: 'right',
    });

    const state = getStageState(stage);
    expect(state.bombs[0]).toMatchObject({
      tile: { x: 4, y: 3 },
      from: { x: 3, y: 3 },
      to: { x: 4, y: 3 },
      progress: 0.125,
      moving: true,
      position: { x: 3.125, y: 3 },
    });

    const halfway = collect(stage, 3).states.at(-1)?.bombs[0];
    expect(halfway).toMatchObject({
      tile: { x: 4, y: 3 },
      from: { x: 3, y: 3 },
      to: { x: 4, y: 3 },
      progress: 0.5,
      moving: true,
      position: { x: 3.5, y: 3 },
    });
  });

  it('rests on the last free tile centre before a wall', () => {
    const stage = stageFrom(ROOM);
    kickRightFromLeft(stage, { x: 3, y: 3 });

    const { states } = collect(stage, 200);
    const rested = states.find((state) => state.bombs[0]?.moving === false);
    const bomb = rested?.bombs[0];

    expect(bomb).toMatchObject({
      tile: { x: 8, y: 3 },
      from: { x: 8, y: 3 },
      to: { x: 8, y: 3 },
      progress: 0,
      moving: false,
      position: { x: 8, y: 3 },
    });
  });

  it('rests before a brick', () => {
    const stage = stageFrom(BRICK_LANE);
    kickRightFromLeft(stage, { x: 3, y: 1 });

    collect(stage, 100);
    const bomb = getStageState(stage).bombs[0];

    expect(bomb).toMatchObject({
      tile: { x: 4, y: 1 },
      from: { x: 4, y: 1 },
      to: { x: 4, y: 1 },
      moving: false,
    });
  });

  it('rests before the arena edge', () => {
    const stage = stageFrom(EDGE_LANE);
    kickRightFromLeft(stage, { x: 3, y: 1 });

    collect(stage, 100);
    const bomb = getStageState(stage).bombs[0];

    expect(bomb).toMatchObject({
      tile: { x: 4, y: 1 },
      from: { x: 4, y: 1 },
      to: { x: 4, y: 1 },
      moving: false,
    });
  });

  it('lets the kicker follow into the tile the bomb left', () => {
    const stage = stageFrom(ROOM);
    kickRightFromLeft(stage, { x: 3, y: 3 });

    const { states } = collect(stage, 14, { direction: 'right' });
    const followed = states.at(-1);

    expect(followed?.player.from).toEqual({ x: 3, y: 3 });
    expect(followed?.bombs[0]?.moving).toBe(true);
    expect(followed?.bombs[0]?.tile.x).toBeGreaterThan(3);
    expect(playerTile(stage).x).toBeGreaterThanOrEqual(3);
  });

  it('rests before another bomb without stacking on it', () => {
    const stage = stageFrom(ROOM, { bombCapacity: 2, fuseMs: 10000 });
    placeAt(stage, { x: 5, y: 3 });
    placeAt(stage, { x: 3, y: 3 });
    walkTo(stage, { x: 2, y: 3 });

    const events = tickStage(stage, { direction: 'right' });
    expect(events.find((event) => event.type === 'bomb-kicked')).toMatchObject({
      bombId: 2,
      tile: { x: 3, y: 3 },
    });

    collect(stage, 100);
    const bombs = getStageState(stage).bombs;

    expect(bombs.find((bomb) => bomb.id === 1)).toMatchObject({
      tile: { x: 5, y: 3 },
      moving: false,
    });
    expect(bombs.find((bomb) => bomb.id === 2)).toMatchObject({
      tile: { x: 4, y: 3 },
      from: { x: 4, y: 3 },
      to: { x: 4, y: 3 },
      moving: false,
    });
    expect(new Set(bombs.map((bomb) => `${bomb.tile.x},${bomb.tile.y}`)).size).toBe(2);
  });

  it('rests before a rival that blocks the lane', () => {
    const stage = createStage({
      seed: 1,
      arena: RIVAL_LANE,
      techniques: KICK,
      playerSpawn: { x: 5, y: 1 },
      rivalCount: 1,
      rivalSpawns: [{ x: 7, y: 1 }],
    });

    tickStage(stage, { bomb: true });
    walkTo(stage, { x: 4, y: 1 });
    tickStage(stage, { direction: 'right' });

    collect(stage, 100);
    const state = getStageState(stage);
    const bomb = state.bombs[0];
    const rival = state.rivals[0];

    expect(bomb).toMatchObject({
      tile: { x: 6, y: 1 },
      from: { x: 6, y: 1 },
      to: { x: 6, y: 1 },
      moving: false,
    });
    expect(rival?.tile).toEqual({ x: 7, y: 1 });
    expect(rival?.alive).toBe(true);
    expect(bomb?.tile).not.toEqual(rival?.tile);
  });

  it('never overlaps the player and blocks the tile it is entering', () => {
    const stage = stageFrom(ROOM, { fuseMs: 10000 });
    kickRightFromLeft(stage, { x: 3, y: 3 });

    const { states } = collect(stage, 120, { direction: 'right' });
    for (const state of states) {
      const player = state.player;
      const playerTileNow = player.moving ? player.to : player.tile;
      for (const bomb of state.bombs) {
        expect({ x: bomb.tile.x, y: bomb.tile.y }).not.toEqual({
          x: playerTileNow.x,
          y: playerTileNow.y,
        });
      }
    }

    const final = getStageState(stage);
    expect(final.bombs[0]?.tile).toEqual({ x: 8, y: 3 });
    expect(playerTile(stage)).toEqual({ x: 7, y: 3 });
  });

  it('stops before the player when a respawn puts them in the slide path', () => {
    // A long corridor gives the rival time to land one contact hit while the
    // bomb is still sliding. The rival waits below the player, so it cannot
    // block the bomb's lane, and the top corner is the safest respawn.
    const height = 71;
    const playerY = 60;
    const rivalY = 69;
    const rows: string[] = [];
    for (let y = 0; y < height; y += 1) {
      if (y === 0 || y === height - 1) {
        rows.push('###');
      } else if (y === playerY) {
        rows.push('#P#');
      } else if (y === rivalY) {
        rows.push('#R#');
      } else {
        rows.push('#.#');
      }
    }

    const stage = createStage({
      seed: 1,
      arena: rows,
      techniques: KICK,
      rivalCount: 1,
      fuseMs: 60000,
    });

    placeAt(stage, { x: 1, y: playerY - 1 });
    walkTo(stage, { x: 1, y: playerY });
    tickStage(stage, { direction: 'up' });

    for (let index = 0; index < 1200 && getStageState(stage).player.alive; index += 1) {
      tickStage(stage, {});
    }
    const dead = getStageState(stage);
    expect(dead.player.alive).toBe(false);
    expect(dead.bombs[0]?.moving).toBe(true);

    for (let index = 0; index < 300 && !getStageState(stage).player.alive; index += 1) {
      tickStage(stage, {});
    }
    const respawned = getStageState(stage);
    expect(respawned.player.alive).toBe(true);
    expect(respawned.player.tile).toEqual({ x: 1, y: 1 });

    for (let index = 0; index < 1200 && getStageState(stage).bombs[0]?.moving; index += 1) {
      tickStage(stage, {});
    }
    const final = getStageState(stage);

    expect(final.bombs[0]).toMatchObject({
      tile: { x: 1, y: 2 },
      from: { x: 1, y: 2 },
      to: { x: 1, y: 2 },
      moving: false,
    });
    expect(final.player.tile).toEqual({ x: 1, y: 1 });
  });

  it('emits one kick event per slide even while the direction stays held', () => {
    const stage = stageFrom(ROOM);
    const kickEvents: StageEvent[] = [];
    kickEvents.push(...kickRightFromLeft(stage, { x: 3, y: 3 }));

    const { events } = collect(stage, 40, { direction: 'right' });
    kickEvents.push(...events);

    expect(kickEvents.filter((event) => event.type === 'bomb-kicked')).toHaveLength(1);
  });

  it('does nothing when Bomb Kick is not owned', () => {
    const stage = stageFrom(ROOM, { techniques: INITIAL_TECHNIQUES });
    placeAt(stage, { x: 3, y: 3 });
    walkTo(stage, { x: 2, y: 3 });

    const events = collect(stage, 40, { direction: 'right' }).events;
    const state = getStageState(stage);

    expect(events.some((event) => event.type === 'bomb-kicked')).toBe(false);
    expect(state.bombs[0]).toMatchObject({
      tile: { x: 3, y: 3 },
      moving: false,
    });
    expect(playerTile(stage)).toEqual({ x: 2, y: 3 });
  });

  it('keeps the fuse counting while the bomb slides', () => {
    const stage = stageFrom(ROOM, { fuseMs: 2000 });
    kickRightFromLeft(stage, { x: 3, y: 3 });

    const atKick = getStageState(stage).bombs[0];
    const after = collect(stage, 10).states.at(-1)?.bombs[0];

    expect(atKick?.moving).toBe(true);
    expect(after?.moving).toBe(true);
    expect(after?.fuseRemainingTicks).toBe((atKick?.fuseRemainingTicks ?? 0) - 10);
  });

  it('detonates mid-slide when its fuse expires', () => {
    const stage = stageFrom(ROOM, { fuseMs: 800 });
    kickRightFromLeft(stage, { x: 3, y: 3 });

    let lastMoving = getStageState(stage).bombs[0];
    let detonation: StageEvent | undefined;
    for (let index = 0; index < 200 && detonation === undefined; index += 1) {
      const events = tickStage(stage, {});
      detonation = events.find((event) => event.type === 'bomb-detonated');
      const bomb = getStageState(stage).bombs[0];
      if (bomb !== undefined) {
        lastMoving = bomb;
      }
    }

    expect(lastMoving?.moving).toBe(true);
    expect(detonation).toMatchObject({
      type: 'bomb-detonated',
      bombId: 1,
      tile: lastMoving?.tile,
      chain: false,
    });
    expect(lastMoving?.tile.x).toBeGreaterThan(3);
  });

  it('can be caught by another blast and chain-detonated mid-slide', () => {
    const stage = stageFrom(ROOM, { bombCapacity: 2, fuseMs: 3000 });
    placeAt(stage, { x: 5, y: 2 });
    placeAt(stage, { x: 3, y: 3 });
    walkTo(stage, { x: 2, y: 3 });

    for (let index = 0; index < 600; index += 1) {
      const fuse = getStageState(stage).bombs.find((bomb) => bomb.id === 1)?.fuseRemainingTicks;
      if (fuse === 8) {
        break;
      }
      tickStage(stage, {});
    }

    const events = tickStage(stage, { direction: 'right' });
    const beforeBlast = getStageState(stage).bombs.find((bomb) => bomb.id === 2);
    expect(beforeBlast?.moving).toBe(true);

    const detonations: StageEvent[] = [];
    for (let index = 0; index < 30 && detonations.length < 2; index += 1) {
      detonations.push(...tickStage(stage, {}));
    }

    const bombEvents = detonations.filter((event) => event.type === 'bomb-detonated');
    expect(bombEvents).toContainEqual(expect.objectContaining({ bombId: 1, chain: false }));
    expect(bombEvents).toContainEqual(
      expect.objectContaining({
        bombId: 2,
        chain: true,
        tile: { x: 5, y: 3 },
      }),
    );
    expect(events.some((event) => event.type === 'bomb-kicked')).toBe(true);
  });

  it('detonates when it slides into an already-live blast', () => {
    const stage = stageFrom(ROOM, { bombCapacity: 2, fuseMs: 3000 });
    placeAt(stage, { x: 5, y: 3 });
    placeAt(stage, { x: 3, y: 3 });
    walkTo(stage, { x: 2, y: 3 });

    let live = false;
    for (let index = 0; index < 240; index += 1) {
      tickStage(stage, {});
      live = getStageState(stage).blasts.some((blast) => blast.tile.x === 4 && blast.tile.y === 3);
      if (live) {
        break;
      }
    }
    expect(live).toBe(true);

    const kickEvents = tickStage(stage, { direction: 'right' });
    expect(kickEvents.some((event) => event.type === 'bomb-kicked')).toBe(true);

    const events: StageEvent[] = [...kickEvents];
    for (let index = 0; index < 20; index += 1) {
      events.push(...tickStage(stage, {}));
    }

    expect(events).toContainEqual(
      expect.objectContaining({ type: 'bomb-detonated', bombId: 2, chain: true }),
    );
  });

  it("kicks a rival's resting bomb", () => {
    const stage = createStage({
      seed: 1,
      arena: RIVAL_BOMB_ROOM,
      techniques: KICK,
      fuseMs: 10000,
      rivalCount: 1,
    });

    for (let index = 0; index < 20; index += 1) {
      tickStage(stage, {});
    }
    const rivalBomb = getStageState(stage).bombs.find((bomb) => bomb.owner === 'cinder');
    expect(rivalBomb?.tile).toEqual({ x: 2, y: 2 });

    walkTo(stage, { x: 2, y: 3 });
    const events = tickStage(stage, { direction: 'up' });
    const kicked = events.find((event) => event.type === 'bomb-kicked');

    expect(kicked).toMatchObject({
      bombId: rivalBomb?.id,
      owner: 'cinder',
      tile: { x: 2, y: 2 },
      direction: 'up',
    });

    collect(stage, 100);
    const kickedBomb = getStageState(stage).bombs.find((bomb) => bomb.id === rivalBomb?.id);
    expect(kickedBomb).toMatchObject({
      owner: 'cinder',
      tile: { x: 2, y: 1 },
      from: { x: 2, y: 1 },
      to: { x: 2, y: 1 },
      moving: false,
    });
  });

  it('does not collect a power-up it slides over', () => {
    const stage = stageFrom(ROOM, {
      hiddenPowerUps: [{ tile: { x: 4, y: 3 }, kind: 'bomb' }],
    });
    kickRightFromLeft(stage, { x: 3, y: 3 });
    collect(stage, 100);

    const state = getStageState(stage);
    expect(state.bombs[0]?.tile.x).toBeGreaterThan(4);
    expect(state.powerUps).toContainEqual({ tile: { x: 4, y: 3 }, kind: 'bomb' });
    expect(state.stats.powerUpsCollected).toBe(0);
    expect(state.bombCapacity).toBe(1);
  });

  it('replays identical slide states and events for the same intent script', () => {
    const runScript = (stage: Stage): { events: StageEvent[]; state: unknown } => {
      const events: StageEvent[] = [];
      events.push(...kickRightFromLeft(stage, { x: 3, y: 3 }));
      for (let index = 0; index < 120; index += 1) {
        events.push(...tickStage(stage, index < 50 ? { direction: 'right' } : {}));
      }
      return { events, state: getStageState(stage) };
    };

    const first = runScript(stageFrom(ROOM, { fuseMs: 5000 }));
    const second = runScript(stageFrom(ROOM, { fuseMs: 5000 }));

    expect(first.events).toEqual(second.events);
    expect(first.state).toEqual(second.state);
  });
});
