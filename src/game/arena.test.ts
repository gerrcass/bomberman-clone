import { describe, expect, it } from 'vitest';

import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  arenaToAscii,
  generateArena,
  isWalkable,
  PLAYER_SPAWN,
  parseAsciiArena,
  RIVAL_SPAWNS,
  SPAWN_CORNERS,
  tileAt,
} from './arena';
import type { ArenaState } from './types';

const PILLAR_COORDS: { x: number; y: number }[] = [];
for (let y = 1; y < ARENA_HEIGHT - 1; y += 1) {
  for (let x = 1; x < ARENA_WIDTH - 1; x += 1) {
    if (x % 2 === 0 && y % 2 === 0) {
      PILLAR_COORDS.push({ x, y });
    }
  }
}

function neighborsOf(tile: { x: number; y: number }): { x: number; y: number }[] {
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
      protectedSet.add(`${neighbor.x},${neighbor.y}`);
    }
  }
  return protectedSet;
}

function eligibleTiles(arena: ArenaState): { x: number; y: number }[] {
  const excluded = protectedTiles();
  const eligible: { x: number; y: number }[] = [];

  for (let y = 1; y < arena.height - 1; y += 1) {
    for (let x = 1; x < arena.width - 1; x += 1) {
      if (x % 2 === 0 && y % 2 === 0) {
        continue;
      }
      if (excluded.has(`${x},${y}`)) {
        continue;
      }
      eligible.push({ x, y });
    }
  }

  return eligible;
}

describe('generateArena', () => {
  it('builds a 15 x 13 arena with an indestructible border', () => {
    const arena = generateArena(1);

    expect(arena.width).toBe(15);
    expect(arena.height).toBe(13);
    expect(arena.tiles).toHaveLength(15 * 13);

    for (let x = 0; x < arena.width; x += 1) {
      expect(tileAt(arena, x, 0)).toBe('wall');
      expect(tileAt(arena, x, arena.height - 1)).toBe('wall');
    }
    for (let y = 0; y < arena.height; y += 1) {
      expect(tileAt(arena, 0, y)).toBe('wall');
      expect(tileAt(arena, arena.width - 1, y)).toBe('wall');
    }
  });

  it('places interior lattice pillars where both coordinates are even', () => {
    const arena = generateArena(2);

    expect(PILLAR_COORDS.length).toBeGreaterThan(0);
    for (const pillar of PILLAR_COORDS) {
      expect(tileAt(arena, pillar.x, pillar.y)).toBe('wall');
    }
  });

  it('keeps the four spawn corners and their orthogonal neighbors clear', () => {
    for (const seed of [1, 2, 3, 99, 2024]) {
      const arena = generateArena(seed);

      for (const spawn of SPAWN_CORNERS) {
        expect(isWalkable(arena, spawn.x, spawn.y)).toBe(true);
        for (const neighbor of neighborsOf(spawn)) {
          const interiorNeighbor =
            neighbor.x > 0 &&
            neighbor.y > 0 &&
            neighbor.x < ARENA_WIDTH - 1 &&
            neighbor.y < ARENA_HEIGHT - 1;
          if (interiorNeighbor) {
            expect(isWalkable(arena, neighbor.x, neighbor.y)).toBe(true);
          }
        }
      }
    }
  });

  it('fills about 58% of the eligible interior with bricks', () => {
    for (const seed of [1, 2, 3, 99, 2024]) {
      const arena = generateArena(seed);
      const eligible = eligibleTiles(arena);
      const bricks = eligible.filter((tile) => tileAt(arena, tile.x, tile.y) === 'brick');

      expect(eligible.length).toBeGreaterThan(80);
      expect(bricks.length / eligible.length).toBeGreaterThan(0.55);
      expect(bricks.length / eligible.length).toBeLessThan(0.62);
    }
  });

  it('reproduces the exact same layout for the same seed', () => {
    const first = arenaToAscii(generateArena(777));
    const second = arenaToAscii(generateArena(777));
    const other = arenaToAscii(generateArena(778));

    expect(first).toEqual(second);
    expect(first).not.toEqual(other);
  });

  it('puts the player spawn at the bottom-left corner and rivals in the other corners', () => {
    expect(PLAYER_SPAWN).toEqual({ x: 1, y: 11 });
    expect(RIVAL_SPAWNS).toEqual([
      { x: 1, y: 1 },
      { x: 13, y: 1 },
      { x: 13, y: 11 },
    ]);
  });
});

describe('ASCII arena fixtures', () => {
  it('parses terrain and the player spawn marker', () => {
    const parsed = parseAsciiArena(['#######', '#.....#', '#..B..#', '#P....#', '#######']);

    expect(parsed.arena.width).toBe(7);
    expect(parsed.arena.height).toBe(5);
    expect(parsed.spawn).toEqual({ x: 1, y: 3 });
    expect(tileAt(parsed.arena, 3, 2)).toBe('brick');
    expect(tileAt(parsed.arena, 4, 3)).toBe('floor');
    expect(tileAt(parsed.arena, 0, 0)).toBe('wall');
  });

  it('round-trips an arena back to ASCII rows', () => {
    const parsed = parseAsciiArena(['#####', '#...#', '#.B.#', '#...#', '#####']);

    expect(arenaToAscii(parsed.arena)).toEqual(['#####', '#...#', '#.B.#', '#...#', '#####']);
  });

  it('rejects ragged fixtures', () => {
    expect(() => parseAsciiArena(['###', '#.#', '##'])).toThrow(/same width/i);
  });
});
