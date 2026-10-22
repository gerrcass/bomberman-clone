import { describe, expect, it } from 'vitest';
import {
  bombReachesPlayer,
  buildDangerMap,
  decideRivalAction,
  findNearestSafeStep,
  makeCanStep,
  type RivalView,
  type RivalWorld,
} from './ai';
import { parseAsciiArena } from './arena';
import { createRng } from './rng';
import type { BombState, RivalPersonality, TileCoord } from './types';

const OPEN_ROOM = [
  '#########',
  '#.......#',
  '#.......#',
  '#.......#',
  '#P......#',
  '#########',
] as const;

function bomb(tile: TileCoord, range = 2, id = 1): BombState {
  return {
    id,
    tile,
    owner: 'player',
    fuseTicks: 132,
    fuseRemainingTicks: 30,
    fuseRemainingMs: 500,
    range,
    remote: false,
    from: { ...tile },
    to: { ...tile },
    progress: 0,
    moving: false,
    position: { ...tile },
  };
}

function rival(overrides: Partial<RivalView> = {}): RivalView {
  return {
    id: 'spark',
    name: 'Spark',
    color: '#ffb347',
    personality: 'balanced',
    tile: { x: 4, y: 1 },
    from: { x: 4, y: 1 },
    to: { x: 4, y: 1 },
    moving: false,
    bombCapacity: 1,
    blastRange: 2,
    speedTier: 0,
    shieldCharges: 0,
    invulnerableTicks: 0,
    ...overrides,
  };
}

function world(
  overrides: Partial<RivalWorld> = {},
  personality: RivalPersonality = 'balanced',
): RivalWorld {
  const parsed = parseAsciiArena(OPEN_ROOM);
  return {
    arena: parsed.arena,
    bombs: [],
    blasts: [],
    powerUps: [],
    player: { x: 1, y: 1 },
    playerAlive: true,
    tick: 0,
    stage: 1,
    rng: createRng(42),
    ...overrides,
    rivals: overrides.rivals ?? [rival({ personality })],
  };
}

describe('danger map', () => {
  it('marks a bomb cross and stops at walls', () => {
    const parsed = parseAsciiArena(OPEN_ROOM);
    const danger = buildDangerMap(parsed.arena, [bomb({ x: 4, y: 2 }, 3)], []);

    expect(danger.has('4,2')).toBe(true);
    expect(danger.has('4,1')).toBe(true);
    expect(danger.has('4,3')).toBe(true);
    expect(danger.has('4,4')).toBe(true);
    expect(danger.has('1,2')).toBe(true);
    expect(danger.has('7,2')).toBe(true);
    expect(danger.has('0,2')).toBe(false);
    expect(danger.has('8,2')).toBe(false);
  });

  it('marks every bomb cross, including a chain-reachable bomb', () => {
    const parsed = parseAsciiArena(OPEN_ROOM);
    const danger = buildDangerMap(
      parsed.arena,
      [bomb({ x: 2, y: 2 }, 3, 1), bomb({ x: 5, y: 2 }, 3, 2)],
      [],
    );

    expect(danger.has('5,2')).toBe(true);
    expect(danger.has('7,2')).toBe(true);
    expect(danger.has('1,2')).toBe(true);
  });

  it('predicts a sliding bomb at its effective tile', () => {
    const parsed = parseAsciiArena(OPEN_ROOM);
    const sliding: BombState = {
      ...bomb({ x: 4, y: 2 }, 1),
      from: { x: 3, y: 2 },
      to: { x: 4, y: 2 },
      progress: 0.5,
      moving: true,
      position: { x: 3.5, y: 2 },
    };

    const danger = buildDangerMap(parsed.arena, [sliding], []);

    // The cross is built from the effective tile (4,2), not the tile (3,2)
    // the bomb is sliding out of.
    expect(danger.has('5,2')).toBe(true);
    expect(danger.has('2,2')).toBe(false);
  });

  it('stops after the first brick', () => {
    const parsed = parseAsciiArena([
      '#########',
      '#.......#',
      '#...B...#',
      '#.......#',
      '#P......#',
      '#########',
    ]);
    const danger = buildDangerMap(parsed.arena, [bomb({ x: 2, y: 2 }, 3)], []);

    expect(danger.has('4,2')).toBe(true);
    expect(danger.has('5,2')).toBe(false);
  });

  it('blocks movement onto bombs but leaves the bomber tile reachable', () => {
    const parsed = parseAsciiArena(OPEN_ROOM);
    const canStep = makeCanStep(parsed.arena, [bomb({ x: 4, y: 2 }, 1)]);

    expect(canStep(4, 2)).toBe(false);
    expect(canStep(3, 2)).toBe(true);
    expect(canStep(4, 3)).toBe(true);
  });
});

describe('safe escape', () => {
  it('finds a path out of a bomb cross', () => {
    const parsed = parseAsciiArena(OPEN_ROOM);
    const danger = buildDangerMap(parsed.arena, [bomb({ x: 4, y: 2 }, 2)], []);
    const canStep = makeCanStep(parsed.arena, []);
    let tile: TileCoord = { x: 4, y: 2 };
    let escaped = false;

    for (let step = 0; step < 6; step += 1) {
      const direction = findNearestSafeStep(tile, danger, canStep, createRng(1));
      if (direction === null) {
        escaped = !danger.has(`${tile.x},${tile.y}`);
        break;
      }
      const delta =
        direction === 'up'
          ? { x: 0, y: -1 }
          : direction === 'down'
            ? { x: 0, y: 1 }
            : direction === 'left'
              ? { x: -1, y: 0 }
              : { x: 1, y: 0 };
      tile = { x: tile.x + delta.x, y: tile.y + delta.y };
      if (!danger.has(`${tile.x},${tile.y}`)) {
        escaped = true;
        break;
      }
    }

    expect(escaped).toBe(true);
  });

  it('recognizes line-of-sight through open ground', () => {
    const parsed = parseAsciiArena(OPEN_ROOM);
    expect(bombReachesPlayer(parsed.arena, { x: 4, y: 2 }, 3, { x: 1, y: 2 })).toBe(true);
    expect(bombReachesPlayer(parsed.arena, { x: 4, y: 2 }, 2, { x: 1, y: 2 })).toBe(false);
  });

  it('does not see through a brick', () => {
    const parsed = parseAsciiArena([
      '#########',
      '#.......#',
      '#...B...#',
      '#.......#',
      '#P......#',
      '#########',
    ]);
    expect(bombReachesPlayer(parsed.arena, { x: 5, y: 2 }, 4, { x: 1, y: 2 })).toBe(false);
  });
});

describe('rival decisions', () => {
  it('flees when standing in a bomb cross', () => {
    const parsed = parseAsciiArena(OPEN_ROOM);
    const self = rival({ tile: { x: 4, y: 2 }, from: { x: 4, y: 2 }, to: { x: 4, y: 2 } });
    const action = decideRivalAction(
      self,
      world({
        arena: parsed.arena,
        bombs: [bomb({ x: 4, y: 2 }, 1)],
        rivals: [self],
        player: { x: 1, y: 1 },
      }),
    );

    expect(action.bomb).toBe(false);
    expect(action.direction).not.toBeNull();
  });

  it('bombs the player when the shot is open and an escape exists', () => {
    const parsed = parseAsciiArena(OPEN_ROOM);
    const self = rival({ tile: { x: 3, y: 2 }, from: { x: 3, y: 2 }, to: { x: 3, y: 2 } });
    const action = decideRivalAction(
      self,
      world({
        arena: parsed.arena,
        rivals: [self],
        player: { x: 1, y: 2 },
      }),
    );

    expect(action).toEqual({ direction: null, bomb: true });
  });

  it('chases a player within contact reach', () => {
    const parsed = parseAsciiArena(OPEN_ROOM);
    const self = rival({
      personality: 'aggressive',
      tile: { x: 2, y: 2 },
      from: { x: 2, y: 2 },
      to: { x: 2, y: 2 },
    });
    const action = decideRivalAction(
      self,
      world(
        {
          arena: parsed.arena,
          rivals: [self],
          player: { x: 1, y: 2 },
        },
        'aggressive',
      ),
    );

    expect(action.bomb).toBe(false);
    expect(action.direction).not.toBeNull();
  });

  it('is deterministic for the same seed and world', () => {
    const parsed = parseAsciiArena(OPEN_ROOM);
    const self = rival({ tile: { x: 4, y: 1 }, from: { x: 4, y: 1 }, to: { x: 4, y: 1 } });
    const makeWorld = (): RivalWorld =>
      world({ arena: parsed.arena, rivals: [self], player: { x: 1, y: 3 } });

    const first = decideRivalAction(self, makeWorld());
    const second = decideRivalAction(self, makeWorld());

    expect(first).toEqual(second);
  });
});
