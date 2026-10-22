import { tileAt } from './arena';
import type { Rng } from './rng';
import { shuffle } from './rng';
import type {
  ArenaState,
  BlastState,
  BombState,
  Direction,
  PowerUpState,
  RivalPersonality,
  TileCoord,
} from './types';

export const RIVAL_BASE_SPEED = 3.5;
export const RIVAL_SPEED_CAP = 5.2;
export const RIVAL_BASE_REACTION_MS = 280;
export const RIVAL_REACTION_STEP_MS = 15;
export const RIVAL_REACTION_FLOOR_MS = 100;
/** Interpolated distance at which a rival's touch kills the player. */
export const RIVAL_CONTACT_RANGE = 0.7;

export interface RivalConfig {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly personality: RivalPersonality;
}

export const RIVAL_ROSTER: readonly RivalConfig[] = [
  { id: 'cinder', name: 'Cinder', color: '#ff5c5c', personality: 'aggressive' },
  { id: 'spark', name: 'Spark', color: '#ffb347', personality: 'balanced' },
  { id: 'vex', name: 'Vex', color: '#b07cff', personality: 'cautious' },
];

export interface RivalView {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly personality: RivalPersonality;
  readonly tile: TileCoord;
  readonly from: TileCoord;
  readonly to: TileCoord;
  readonly moving: boolean;
  readonly bombCapacity: number;
  readonly blastRange: number;
  readonly speedTier: number;
  readonly shieldCharges: number;
  readonly invulnerableTicks: number;
}

export interface RivalWorld {
  readonly arena: ArenaState;
  readonly bombs: readonly BombState[];
  readonly blasts: readonly BlastState[];
  readonly powerUps: readonly PowerUpState[];
  readonly rivals: readonly RivalView[];
  /** Current tile of the player, or null when the player is dead. */
  readonly player: TileCoord | null;
  readonly playerAlive: boolean;
  readonly tick: number;
  readonly stage: number;
  readonly rng: Rng;
}

export interface RivalDecision {
  readonly direction: Direction | null;
  readonly bomb: boolean;
}

export type DangerMap = ReadonlySet<string>;

interface BombLike {
  readonly id: number;
  readonly tile: TileCoord;
  readonly range: number;
  readonly piercing: boolean;
}

const DIRECTIONS: readonly Direction[] = ['up', 'left', 'down', 'right'];
const DELTAS: Record<Direction, TileCoord> = {
  up: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  down: { x: 0, y: 1 },
  right: { x: 1, y: 0 },
};

const PERSONALITY_TUNING: Record<
  RivalPersonality,
  { reactionFactor: number; aggression: number; pickupReach: number; brickChance: number }
> = {
  aggressive: { reactionFactor: 0.85, aggression: 0.9, pickupReach: 3, brickChance: 0.3 },
  balanced: { reactionFactor: 1, aggression: 0.55, pickupReach: 5, brickChance: 0.5 },
  cautious: { reactionFactor: 1.15, aggression: 0.25, pickupReach: 9, brickChance: 0.7 },
};

export function rivalSpeedForStage(stage: number): number {
  return Math.min(RIVAL_SPEED_CAP, RIVAL_BASE_SPEED + 0.12 * Math.max(0, stage - 1));
}

export function rivalReactionTicks(stage: number, personality: RivalPersonality): number {
  const baseMs = Math.max(
    RIVAL_REACTION_FLOOR_MS,
    RIVAL_BASE_REACTION_MS - RIVAL_REACTION_STEP_MS * Math.max(0, stage - 1),
  );
  const tunedMs = Math.max(
    RIVAL_REACTION_FLOOR_MS,
    Math.round(baseMs * PERSONALITY_TUNING[personality].reactionFactor),
  );
  return Math.max(6, Math.round((tunedMs / 1000) * 60));
}

export function rivalBombCapacityForStage(stage: number): number {
  return Math.min(8, 1 + Math.floor(Math.max(0, stage - 1) / 3));
}

export function rivalBlastRangeForStage(stage: number): number {
  return Math.min(8, 1 + Math.floor(Math.max(0, stage - 1) / 4));
}

/** Stable key for a tile used by danger maps and bomb lookups. */
export function tileKey(tile: TileCoord): string {
  return `${tile.x},${tile.y}`;
}

/**
 * Builds the set of tiles covered by live blasts or by any bomb's predicted
 * blast. Predicted blasts include chain reactions and stop at walls, matching
 * real detonation geometry. A classic ray stops after the first brick; a
 * piercing ray continues for its full range.
 */
export function buildDangerMap(
  arena: ArenaState,
  bombs: readonly BombLike[],
  blasts: readonly BlastState[],
): DangerMap {
  const danger = new Set<string>();
  for (const blast of blasts) {
    danger.add(tileKey(blast.tile));
  }

  const bombsByTile = new Map<string, BombLike>();
  for (const bomb of bombs) {
    bombsByTile.set(tileKey(bomb.tile), bomb);
  }

  const processed = new Set<number>();
  const queue: BombLike[] = [...bombs];

  while (queue.length > 0) {
    const bomb = queue.shift();
    if (bomb === undefined || processed.has(bomb.id)) {
      continue;
    }
    processed.add(bomb.id);
    danger.add(tileKey(bomb.tile));

    for (const direction of DIRECTIONS) {
      const delta = DELTAS[direction];
      for (let step = 1; step <= bomb.range; step += 1) {
        const x = bomb.tile.x + delta.x * step;
        const y = bomb.tile.y + delta.y * step;
        const kind = tileAt(arena, x, y);

        if (kind === 'wall') {
          break;
        }

        danger.add(`${x},${y}`);
        if (kind === 'brick') {
          if (bomb.piercing) {
            continue;
          }
          break;
        }

        const linked = bombsByTile.get(`${x},${y}`);
        if (linked !== undefined && !processed.has(linked.id)) {
          queue.push(linked);
        }
      }
    }
  }

  return danger;
}

export function bombTiles(bombs: readonly BombState[]): ReadonlySet<string> {
  return new Set(bombs.map((bomb) => tileKey(bomb.tile)));
}

/** True when a tile can be entered: floor and not occupied by a bomb. */
export function makeCanStep(
  arena: ArenaState,
  bombs: readonly BombState[],
): (x: number, y: number) => boolean {
  const blocked = bombTiles(bombs);
  return (x, y) => tileAt(arena, x, y) === 'floor' && !blocked.has(`${x},${y}`);
}

/**
 * Breadth-first step toward a target. Neighbour order is seeded so equal-cost
 * paths break ties reproducibly.
 */
export function findStepToward(
  start: TileCoord,
  target: TileCoord,
  canStep: (x: number, y: number) => boolean,
  rng: Rng,
): Direction | null {
  if (start.x === target.x && start.y === target.y) {
    return null;
  }

  interface Node {
    readonly tile: TileCoord;
    readonly first: Direction | null;
  }

  const targetKey = tileKey(target);
  const visited = new Set<string>([tileKey(start)]);
  const queue: Node[] = [{ tile: start, first: null }];

  while (queue.length > 0) {
    const node = queue.shift();
    if (node === undefined) {
      break;
    }

    for (const direction of shuffle(rng, DIRECTIONS)) {
      const delta = DELTAS[direction];
      const next = { x: node.tile.x + delta.x, y: node.tile.y + delta.y };
      const key = tileKey(next);
      if (visited.has(key) || !canStep(next.x, next.y)) {
        continue;
      }

      const first = node.first ?? direction;
      if (key === targetKey) {
        return first;
      }

      visited.add(key);
      queue.push({ tile: next, first });
    }
  }

  return null;
}

/**
 * First step toward the nearest walkable tile outside the danger map. Returns
 * null when the start is already safe or no safe tile is reachable.
 */
export function findNearestSafeStep(
  start: TileCoord,
  danger: DangerMap,
  canStep: (x: number, y: number) => boolean,
  rng: Rng,
): Direction | null {
  if (!danger.has(tileKey(start))) {
    return null;
  }

  const visited = new Set<string>([tileKey(start)]);
  const queue: { tile: TileCoord; first: Direction | null }[] = [{ tile: start, first: null }];

  while (queue.length > 0) {
    const node = queue.shift();
    if (node === undefined) {
      break;
    }

    for (const direction of shuffle(rng, DIRECTIONS)) {
      const delta = DELTAS[direction];
      const next = { x: node.tile.x + delta.x, y: node.tile.y + delta.y };
      const key = tileKey(next);
      if (visited.has(key) || !canStep(next.x, next.y)) {
        continue;
      }

      const first = node.first ?? direction;
      visited.add(key);

      if (!danger.has(key)) {
        return first;
      }

      queue.push({ tile: next, first });
    }
  }

  return null;
}

/** True when the bomber can reach any tile outside the danger map. */
export function hasEscapeRoute(
  start: TileCoord,
  danger: DangerMap,
  canStep: (x: number, y: number) => boolean,
  rng: Rng,
): boolean {
  return findNearestSafeStep(start, danger, canStep, rng) !== null;
}

/** True when a bomb on `from` would cover the player through open ground. */
export function bombReachesPlayer(
  arena: ArenaState,
  from: TileCoord,
  range: number,
  player: TileCoord,
): boolean {
  if (from.x !== player.x && from.y !== player.y) {
    return false;
  }

  const dx = Math.sign(player.x - from.x);
  const dy = Math.sign(player.y - from.y);
  const distance = Math.abs(player.x - from.x) + Math.abs(player.y - from.y);
  if (distance === 0 || distance > range) {
    return false;
  }

  for (let step = 1; step < distance; step += 1) {
    const kind = tileAt(arena, from.x + dx * step, from.y + dy * step);
    if (kind !== 'floor') {
      return false;
    }
  }

  return true;
}

function adjacentBrick(arena: ArenaState, tile: TileCoord): boolean {
  for (const direction of DIRECTIONS) {
    const delta = DELTAS[direction];
    if (tileAt(arena, tile.x + delta.x, tile.y + delta.y) === 'brick') {
      return true;
    }
  }
  return false;
}

function chooseRandomStep(
  tile: TileCoord,
  canStep: (x: number, y: number) => boolean,
  rng: Rng,
): Direction | null {
  for (const direction of shuffle(rng, DIRECTIONS)) {
    const delta = DELTAS[direction];
    if (canStep(tile.x + delta.x, tile.y + delta.y)) {
      return direction;
    }
  }
  return null;
}

function choosePickupStep(
  self: RivalView,
  world: RivalWorld,
  canStep: (x: number, y: number) => boolean,
): Direction | null {
  const position = self.moving ? self.to : self.tile;
  const reach = PERSONALITY_TUNING[self.personality].pickupReach;
  const candidates = world.powerUps
    .filter((powerUp) => manhattan(position, powerUp.tile) <= reach)
    .sort(
      (a, b) =>
        manhattan(position, a.tile) - manhattan(position, b.tile) ||
        a.tile.y - b.tile.y ||
        a.tile.x - b.tile.x,
    );

  for (const powerUp of candidates) {
    const step = findStepToward(position, powerUp.tile, canStep, world.rng);
    if (step !== null) {
      return step;
    }
  }

  return null;
}

/**
 * Walks toward the nearest reachable floor tile that touches a brick. Bosses
 * use this when the player is walled off, so they dig toward a route instead
 * of orbiting their spawn pocket forever.
 */
function chooseDigStep(
  position: TileCoord,
  world: RivalWorld,
  canStep: (x: number, y: number) => boolean,
): Direction | null {
  const targets: TileCoord[] = [];
  for (let y = 1; y < world.arena.height - 1; y += 1) {
    for (let x = 1; x < world.arena.width - 1; x += 1) {
      if (tileAt(world.arena, x, y) !== 'floor') {
        continue;
      }
      if (adjacentBrick(world.arena, { x, y })) {
        targets.push({ x, y });
      }
    }
  }

  targets.sort((a, b) => manhattan(position, a) - manhattan(position, b) || a.y - b.y || a.x - b.x);

  for (const target of targets) {
    const step = findStepToward(position, target, canStep, world.rng);
    if (step !== null) {
      return step;
    }
  }

  return null;
}

/**
 * Chooses one rival action for this decision interval. The rival first escapes
 * danger, then weighs personality-specific options: contact, bombing the
 * player, collecting power-ups, opening brick walls, chasing, or patrolling.
 */
export function decideRivalAction(self: RivalView, world: RivalWorld): RivalDecision {
  const canStep = makeCanStep(world.arena, world.bombs);
  const danger = buildDangerMap(world.arena, world.bombs, world.blasts);
  const tuning = PERSONALITY_TUNING[self.personality];
  // While a step is in progress the simulation counts the rival as occupying
  // `to`, so plan and flee from there rather than from the tile it is leaving.
  const position = self.moving ? self.to : self.tile;
  const safeCanStep = (x: number, y: number): boolean =>
    canStep(x, y) && !danger.has(tileKey({ x, y }));

  if (danger.has(tileKey(self.tile)) || danger.has(tileKey(self.to))) {
    return {
      direction: findNearestSafeStep(position, danger, canStep, world.rng),
      bomb: false,
    };
  }

  const playerDistance =
    world.playerAlive && world.player !== null ? manhattan(position, world.player) : Infinity;

  // Rivals can kill by touch; close the distance aggressively.
  const contactReach = self.personality === 'aggressive' ? 2 : 1;
  if (world.playerAlive && world.player !== null && playerDistance <= contactReach) {
    const step = findStepToward(position, world.player, safeCanStep, world.rng);
    if (step !== null) {
      return { direction: step, bomb: false };
    }
  }

  // A cautious rival values a visible power-up above a long chase.
  if (self.personality === 'cautious' || playerDistance > 3) {
    const pickupStep = choosePickupStep(self, world, safeCanStep);
    if (pickupStep !== null) {
      return { direction: pickupStep, bomb: false };
    }
  }

  // A rival can bomb the tile it is leaving, matching the player's mid-step
  // placement rule. The escape route is checked from that bomb tile.
  const bombTile = self.moving ? self.from : self.to;
  const bombTileFree = !world.bombs.some(
    (bomb) => bomb.tile.x === bombTile.x && bomb.tile.y === bombTile.y,
  );
  const escapeAfterBomb = (): boolean => {
    if (!bombTileFree) {
      return false;
    }
    const hypothetical: BombLike = {
      id: -1,
      tile: bombTile,
      range: self.blastRange,
      piercing: false,
    };
    const bombsWithHypothetical: BombLike[] = [...world.bombs, hypothetical];
    const dangerWithBomb = buildDangerMap(world.arena, bombsWithHypothetical, world.blasts);
    return hasEscapeRoute(bombTile, dangerWithBomb, canStep, world.rng);
  };

  const blastsClear = world.blasts.length === 0;
  if (
    world.playerAlive &&
    world.player !== null &&
    blastsClear &&
    bombTileFree &&
    bombReachesPlayer(world.arena, bombTile, self.blastRange, world.player) &&
    escapeAfterBomb()
  ) {
    return { direction: null, bomb: true };
  }

  if (self.personality !== 'aggressive' || world.rng.next() < tuning.aggression) {
    const pickupStep = choosePickupStep(self, world, safeCanStep);
    if (pickupStep !== null) {
      return { direction: pickupStep, bomb: false };
    }
  }

  const brickChance = playerDistance > 5 ? 1 : tuning.brickChance;
  if (
    blastsClear &&
    bombTileFree &&
    adjacentBrick(world.arena, bombTile) &&
    world.rng.next() < brickChance &&
    escapeAfterBomb()
  ) {
    return { direction: null, bomb: true };
  }

  if (
    world.playerAlive &&
    world.player !== null &&
    (self.personality === 'aggressive' || world.rng.next() < tuning.aggression)
  ) {
    const step = findStepToward(position, world.player, safeCanStep, world.rng);
    if (step !== null) {
      return { direction: step, bomb: false };
    }
  }

  const digStep = chooseDigStep(position, world, safeCanStep);
  if (digStep !== null) {
    return { direction: digStep, bomb: false };
  }

  return {
    direction: chooseRandomStep(position, safeCanStep, world.rng),
    bomb: false,
  };
}

function manhattan(a: TileCoord, b: TileCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
