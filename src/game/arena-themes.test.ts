import { describe, expect, it } from 'vitest';

import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  arenaToAscii,
  generateArena,
  isPillar,
  PLAYER_SPAWN,
  SPAWN_CORNERS,
  tileAt,
} from './arena';
import { STAGE_THEME_IDS, type StageThemeId, themeDefinition } from './themes';
import type { ArenaState, TileCoord } from './types';

const SEEDS = [1, 2, 3, 99, 777, 2024];

/**
 * Layout walls per theme, not counting the solid border. The signature is the
 * contract the arena generator must reproduce for every Seed.
 */
const EXPECTED_INTERIOR_WALLS: Record<StageThemeId, (x: number, y: number) => boolean> = {
  'pillar-hall': isPillar,
  brickworks: (x, y) => x >= 6 && x <= 8 && y >= 5 && y <= 7,
  crossroads: (x, y) =>
    (y === 6 && ((x >= 3 && x <= 5) || (x >= 9 && x <= 11))) ||
    (x === 7 && ((y >= 2 && y <= 4) || (y >= 8 && y <= 10))),
  'twin-courts': (x, y) => x === 7 && y >= 1 && y <= 11 && y !== 3 && y !== 6 && y !== 9,
};

/** The exact Pillar Hall layout produced before Stage Themes existed. */
const PILLAR_HALL_REGRESSION: readonly (readonly [number, readonly string[]])[] = [
  [
    1,
    [
      '###############',
      '#...BB.B.BBB..#',
      '#.#.#B#B#.#.#.#',
      '#..BBBB....B..#',
      '#B#B#B#.#B#.#.#',
      '#B.BBB.B.B.B.B#',
      '#B#.#.#B#.#.#.#',
      '#BBBB.B.B..B.B#',
      '#.#B#B#B#B#.#.#',
      '#BBBBB.BBBBB.B#',
      '#.#B#B#B#.#.#.#',
      '#....BB.BBBB..#',
      '###############',
    ],
  ],
  [
    777,
    [
      '###############',
      '#..B.B...B.B..#',
      '#.#.#B#B#.#B#.#',
      '#BBBBB.BBB....#',
      '#B#.#B#B#.#B#B#',
      '#BB.BB.BB.B.B.#',
      '#.#.#B#B#B#B#.#',
      '#BB..BB..BB.BB#',
      '#B#B#.#B#.#.#B#',
      '#BB.BB.B.BB..B#',
      '#.#.#B#.#.#B#.#',
      '#..BBBBB......#',
      '###############',
    ],
  ],
  [
    2024,
    [
      '###############',
      '#...BBBBB..B..#',
      '#.#.#B#B#B#.#.#',
      '#.BBB.BB..B.B.#',
      '#.#.#B#B#B#B#B#',
      '#.BB..B.B.BB.B#',
      '#.#B#B#.#B#B#.#',
      '#BBBBB.BB...BB#',
      '#.#B#.#B#.#.#B#',
      '#B.B..B...BBBB#',
      '#.#B#.#B#B#B#.#',
      '#...B.B.B..B..#',
      '###############',
    ],
  ],
];

function interiorCoordinates(): TileCoord[] {
  const coordinates: TileCoord[] = [];
  for (let y = 1; y < ARENA_HEIGHT - 1; y += 1) {
    for (let x = 1; x < ARENA_WIDTH - 1; x += 1) {
      coordinates.push({ x, y });
    }
  }
  return coordinates;
}

function neighborsOf(tile: TileCoord): TileCoord[] {
  return [
    { x: tile.x + 1, y: tile.y },
    { x: tile.x - 1, y: tile.y },
    { x: tile.x, y: tile.y + 1 },
    { x: tile.x, y: tile.y - 1 },
  ];
}

function protectedTiles(): Set<string> {
  const protectedSet = new Set<string>();
  for (const spawn of SPAWN_CORNERS) {
    protectedSet.add(`${spawn.x},${spawn.y}`);
    for (const neighbor of neighborsOf(spawn)) {
      if (
        neighbor.x > 0 &&
        neighbor.y > 0 &&
        neighbor.x < ARENA_WIDTH - 1 &&
        neighbor.y < ARENA_HEIGHT - 1
      ) {
        protectedSet.add(`${neighbor.x},${neighbor.y}`);
      }
    }
  }
  return protectedSet;
}

function interiorWallKeys(arena: ArenaState): Set<string> {
  const walls = new Set<string>();
  for (const tile of interiorCoordinates()) {
    if (tileAt(arena, tile.x, tile.y) === 'wall') {
      walls.add(`${tile.x},${tile.y}`);
    }
  }
  return walls;
}

function eligibleTiles(arena: ArenaState): TileCoord[] {
  const excluded = protectedTiles();
  return interiorCoordinates().filter(
    (tile) => tileAt(arena, tile.x, tile.y) !== 'wall' && !excluded.has(`${tile.x},${tile.y}`),
  );
}

/** Counts every non-wall tile, treating bricks as passable. */
function reachableTiles(arena: ArenaState): number {
  const visited = new Set<string>([`${PLAYER_SPAWN.x},${PLAYER_SPAWN.y}`]);
  const queue: TileCoord[] = [{ ...PLAYER_SPAWN }];

  while (queue.length > 0) {
    const tile = queue.shift();
    if (tile === undefined) {
      continue;
    }

    for (const neighbor of neighborsOf(tile)) {
      const key = `${neighbor.x},${neighbor.y}`;
      if (
        neighbor.x < 0 ||
        neighbor.y < 0 ||
        neighbor.x >= arena.width ||
        neighbor.y >= arena.height ||
        visited.has(key) ||
        tileAt(arena, neighbor.x, neighbor.y) === 'wall'
      ) {
        continue;
      }
      visited.add(key);
      queue.push(neighbor);
    }
  }

  return visited.size;
}

function nonWallTileCount(arena: ArenaState): number {
  return arena.tiles.filter((tile) => tile !== 'wall').length;
}

describe('generateArena per Stage Theme', () => {
  it('keeps the exact pre-theme Pillar Hall terrain for known Seeds', () => {
    for (const [seed, rows] of PILLAR_HALL_REGRESSION) {
      expect(arenaToAscii(generateArena(seed, 'pillar-hall'))).toEqual(rows);
      expect(arenaToAscii(generateArena(seed))).toEqual(rows);
    }
  });

  it('builds a 15 x 13 arena with an indestructible border in every theme', () => {
    for (const theme of STAGE_THEME_IDS) {
      for (const seed of SEEDS) {
        const arena = generateArena(seed, theme);

        expect(arena.width).toBe(ARENA_WIDTH);
        expect(arena.height).toBe(ARENA_HEIGHT);
        expect(arena.tiles).toHaveLength(ARENA_WIDTH * ARENA_HEIGHT);

        for (let x = 0; x < arena.width; x += 1) {
          expect(tileAt(arena, x, 0)).toBe('wall');
          expect(tileAt(arena, x, arena.height - 1)).toBe('wall');
        }
        for (let y = 0; y < arena.height; y += 1) {
          expect(tileAt(arena, 0, y)).toBe('wall');
          expect(tileAt(arena, arena.width - 1, y)).toBe('wall');
        }
      }
    }
  });

  it('matches each theme wall signature', () => {
    for (const theme of STAGE_THEME_IDS) {
      const arena = generateArena(777, theme);
      const expected = new Set(
        interiorCoordinates()
          .filter((tile) => EXPECTED_INTERIOR_WALLS[theme](tile.x, tile.y))
          .map((tile) => `${tile.x},${tile.y}`),
      );

      expect(interiorWallKeys(arena)).toEqual(expected);
    }
  });

  it('keeps spawn corners and their orthogonal interior neighbours clear in every theme', () => {
    for (const theme of STAGE_THEME_IDS) {
      for (const seed of SEEDS) {
        const arena = generateArena(seed, theme);

        for (const spawn of SPAWN_CORNERS) {
          expect(tileAt(arena, spawn.x, spawn.y)).toBe('floor');
          for (const neighbor of neighborsOf(spawn)) {
            if (
              neighbor.x > 0 &&
              neighbor.y > 0 &&
              neighbor.x < ARENA_WIDTH - 1 &&
              neighbor.y < ARENA_HEIGHT - 1
            ) {
              expect(tileAt(arena, neighbor.x, neighbor.y)).toBe('floor');
            }
          }
        }
      }
    }
  });

  it('fills each theme to its declared brick density', () => {
    for (const theme of STAGE_THEME_IDS) {
      const density = themeDefinition(theme).brickDensity;

      for (const seed of SEEDS) {
        const arena = generateArena(seed, theme);
        const eligible = eligibleTiles(arena);
        const bricks = eligible.filter((tile) => tileAt(arena, tile.x, tile.y) === 'brick');

        expect(eligible.length).toBeGreaterThan(80);
        expect(bricks.length / eligible.length).toBeGreaterThan(density - 0.02);
        expect(bricks.length / eligible.length).toBeLessThan(density + 0.02);
      }
    }
  });

  it('keeps every layout wall 180-degree symmetric around the arena centre', () => {
    for (const theme of STAGE_THEME_IDS) {
      for (const seed of SEEDS) {
        const arena = generateArena(seed, theme);

        for (let y = 0; y < arena.height; y += 1) {
          for (let x = 0; x < arena.width; x += 1) {
            if (tileAt(arena, x, y) !== 'wall') {
              continue;
            }
            expect(tileAt(arena, arena.width - 1 - x, arena.height - 1 - y)).toBe('wall');
          }
        }
      }
    }
  });

  it('leaves every non-wall tile reachable from the player spawn in every theme', () => {
    for (const theme of STAGE_THEME_IDS) {
      for (const seed of SEEDS) {
        const arena = generateArena(seed, theme);

        expect(reachableTiles(arena)).toBe(nonWallTileCount(arena));
      }
    }
  });

  it('reproduces identical terrain for the same seed and theme', () => {
    for (const theme of STAGE_THEME_IDS) {
      const first = arenaToAscii(generateArena(777, theme));
      const second = arenaToAscii(generateArena(777, theme));

      expect(first).toEqual(second);
    }
  });

  it('produces distinct terrain for each theme with the same seed', () => {
    const layouts = STAGE_THEME_IDS.map((theme) =>
      arenaToAscii(generateArena(777, theme)).join('\n'),
    );

    expect(new Set(layouts).size).toBe(STAGE_THEME_IDS.length);
  });
});
