import { createRng, shuffle } from './rng';
import type { ArenaState, TileCoord, TileKind } from './types';

export const ARENA_WIDTH = 15;
export const ARENA_HEIGHT = 13;

/** Fraction of eligible interior tiles covered by bricks. */
export const BRICK_DENSITY = 0.58;

/** Bottom-left spawn corner used by the player. */
export const PLAYER_SPAWN: TileCoord = { x: 1, y: 11 };

/** Top-left, top-right, and bottom-right spawn corners used by rivals. */
export const RIVAL_SPAWNS: readonly TileCoord[] = [
  { x: 1, y: 1 },
  { x: 13, y: 1 },
  { x: 13, y: 11 },
];

export const SPAWN_CORNERS: readonly TileCoord[] = [PLAYER_SPAWN, ...RIVAL_SPAWNS];

const ASCII_WALL = '#';
const ASCII_FLOOR = '.';
const ASCII_BRICK = 'B';
const ASCII_PLAYER = 'P';

export interface ParsedArena {
  readonly arena: ArenaState;
  /** Player spawn declared by a `P` marker, when the fixture has one. */
  readonly spawn: TileCoord | null;
}

export function inBounds(arena: ArenaState, x: number, y: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x < arena.width &&
    y < arena.height
  );
}

/** Out-of-bounds reads behave like indestructible wall. */
export function tileAt(arena: ArenaState, x: number, y: number): TileKind {
  if (!inBounds(arena, x, y)) {
    return 'wall';
  }
  return arena.tiles[y * arena.width + x] ?? 'wall';
}

export function isWalkable(arena: ArenaState, x: number, y: number): boolean {
  return tileAt(arena, x, y) === 'floor';
}

export function isPillar(x: number, y: number): boolean {
  return x % 2 === 0 && y % 2 === 0;
}

/**
 * Generates the classic Bomberman lattice: wall border, pillars on even/even
 * interior coordinates, and bricks over 58% of the remaining eligible tiles.
 * Spawn corners and their orthogonal neighbors stay clear.
 */
export function generateArena(seed: number): ArenaState {
  const tiles: TileKind[] = new Array(ARENA_WIDTH * ARENA_HEIGHT).fill('floor');

  for (let y = 0; y < ARENA_HEIGHT; y += 1) {
    for (let x = 0; x < ARENA_WIDTH; x += 1) {
      const border = x === 0 || y === 0 || x === ARENA_WIDTH - 1 || y === ARENA_HEIGHT - 1;
      if (border || isPillar(x, y)) {
        tiles[y * ARENA_WIDTH + x] = 'wall';
      }
    }
  }

  const protectedIndices = new Set<number>();
  for (const spawn of SPAWN_CORNERS) {
    protectedIndices.add(spawn.y * ARENA_WIDTH + spawn.x);
    for (const neighbor of orthogonalNeighbors(spawn)) {
      if (
        neighbor.x > 0 &&
        neighbor.y > 0 &&
        neighbor.x < ARENA_WIDTH - 1 &&
        neighbor.y < ARENA_HEIGHT - 1
      ) {
        protectedIndices.add(neighbor.y * ARENA_WIDTH + neighbor.x);
      }
    }
  }

  const eligible: number[] = [];
  for (let index = 0; index < tiles.length; index += 1) {
    if (tiles[index] === 'floor' && !protectedIndices.has(index)) {
      eligible.push(index);
    }
  }

  const brickCount = Math.round(eligible.length * BRICK_DENSITY);
  const shuffled = shuffle(createRng(seed), eligible);
  for (let index = 0; index < brickCount; index += 1) {
    const tileIndex = shuffled[index];
    if (tileIndex !== undefined) {
      tiles[tileIndex] = 'brick';
    }
  }

  return { width: ARENA_WIDTH, height: ARENA_HEIGHT, tiles };
}

function orthogonalNeighbors(tile: TileCoord): TileCoord[] {
  return [
    { x: tile.x + 1, y: tile.y },
    { x: tile.x - 1, y: tile.y },
    { x: tile.x, y: tile.y + 1 },
    { x: tile.x, y: tile.y - 1 },
  ];
}

/**
 * Parses an ASCII fixture. `#` is wall, `B`/`b` brick, `.` floor, and `P`/`p`
 * is a floor tile that also marks the player spawn.
 */
export function parseAsciiArena(rows: readonly string[]): ParsedArena {
  const height = rows.length;
  const firstRow = rows[0];
  if (firstRow === undefined || firstRow.length === 0) {
    throw new Error('Arena fixture must have at least one row');
  }

  const width = firstRow.length;
  const tiles: TileKind[] = [];
  let spawn: TileCoord | null = null;

  for (let y = 0; y < height; y += 1) {
    const row = rows[y];
    if (row === undefined) {
      throw new Error(`Arena fixture row ${y} is missing`);
    }
    if (row.length !== width) {
      throw new Error('Every arena fixture row must have the same width');
    }

    for (let x = 0; x < width; x += 1) {
      const glyph = row[x];
      switch (glyph) {
        case ASCII_WALL:
          tiles.push('wall');
          break;
        case ASCII_BRICK:
        case ASCII_BRICK.toLowerCase():
          tiles.push('brick');
          break;
        case ASCII_FLOOR:
          tiles.push('floor');
          break;
        case ASCII_PLAYER:
        case ASCII_PLAYER.toLowerCase():
          if (spawn !== null) {
            throw new Error('Arena fixture may declare at most one player spawn');
          }
          spawn = { x, y };
          tiles.push('floor');
          break;
        default:
          throw new Error(`Unknown arena fixture glyph "${glyph ?? ''}" at ${x},${y}`);
      }
    }
  }

  return { arena: { width, height, tiles }, spawn };
}

/** Renders terrain back to ASCII. Spawn markers are not part of the terrain. */
export function arenaToAscii(arena: ArenaState): string[] {
  const rows: string[] = [];
  for (let y = 0; y < arena.height; y += 1) {
    let row = '';
    for (let x = 0; x < arena.width; x += 1) {
      switch (tileAt(arena, x, y)) {
        case 'wall':
          row += ASCII_WALL;
          break;
        case 'brick':
          row += ASCII_BRICK;
          break;
        default:
          row += ASCII_FLOOR;
      }
    }
    rows.push(row);
  }
  return rows;
}
