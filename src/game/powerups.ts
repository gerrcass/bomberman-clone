import { createRng, shuffle } from './rng';
import type { ArenaState, PowerUpKind, TileCoord } from './types';

export const POWER_UP_POINTS = 25;
export const POWER_UP_DROP_CHANCE = 0.55;
export const POWER_UP_TABLE: readonly (readonly [PowerUpKind, number])[] = [
  ['bomb', 0.3],
  ['fire', 0.3],
  ['speed', 0.25],
  ['shield', 0.15],
];

export const MAX_BOMB_CAPACITY = 8;
export const MAX_BLAST_RANGE = 8;
export const MAX_SPEED_STACKS = 5;
export const MAX_SHIELD_CHARGES = 2;
/** Each speed stack adds 8% multiplicatively to base movement speed. */
export const SPEED_STACK_BONUS = 0.08;
/** Invulnerability granted when a shield charge absorbs a lethal hit. */
export const SHIELD_INVULNERABILITY_TICKS = 90;

/** A power-up hidden under a brick until that brick is destroyed. */
export interface HiddenPowerUp {
  readonly tile: TileCoord;
  readonly kind: PowerUpKind;
}

/** Effective movement speed for a number of collected speed power-ups. */
export function speedForStacks(
  baseSpeed: number,
  stacks: number,
  maxStacks: number = MAX_SPEED_STACKS,
): number {
  const effective = Math.max(0, Math.min(Math.floor(stacks), maxStacks));
  return baseSpeed * (1 + SPEED_STACK_BONUS) ** effective;
}

/**
 * Chooses hidden power-ups for every brick in the arena.
 *
 * `55%` of bricks hide one. Two of the chosen bricks are guaranteed to carry
 * an extra-bomb and a fire power-up whenever the arena has at least two
 * bricks; the rest use the weighted table. Selection and weighting both draw
 * from the seeded generator, so a seed always produces the same layout.
 */
export function generateHiddenPowerUps(arena: ArenaState, seed: number): HiddenPowerUp[] {
  const bricks: TileCoord[] = [];
  for (let y = 0; y < arena.height; y += 1) {
    for (let x = 0; x < arena.width; x += 1) {
      if (arena.tiles[y * arena.width + x] === 'brick') {
        bricks.push({ x, y });
      }
    }
  }

  if (bricks.length === 0) {
    return [];
  }

  const rng = createRng((seed ^ 0x9e37_79b9) >>> 0);
  const minimum = bricks.length >= 2 ? 2 : 1;
  const count = Math.min(
    bricks.length,
    Math.max(minimum, Math.round(bricks.length * POWER_UP_DROP_CHANCE)),
  );
  const chosen = shuffle(rng, bricks).slice(0, count);

  return chosen.map((tile, index) => ({
    tile,
    kind:
      index === 0 && bricks.length >= 2
        ? 'bomb'
        : index === 1 && bricks.length >= 2
          ? 'fire'
          : weightedKind(rng),
  }));
}

/** Draws one kind from the weighted table using the supplied generator. */
export function weightedKind(rng: { next(): number }): PowerUpKind {
  const roll = rng.next();
  let cumulative = 0;

  for (const [kind, weight] of POWER_UP_TABLE) {
    cumulative += weight;
    if (roll < cumulative) {
      return kind;
    }
  }

  return 'shield';
}
