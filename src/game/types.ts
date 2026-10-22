import type { TechniqueCounts } from './techniques';

/** Shared vocabulary for the deterministic simulation. */

export const TICKS_PER_SECOND = 60;
export const TICK_SECONDS = 1 / TICKS_PER_SECOND;

export const TILE_SIZE = 48;

/** Base player movement speed in tiles per second. */
export const BASE_MOVE_SPEED = 4.6;

/**
 * Fixed slide speed for a kicked bomb in tiles per second. The bomb crosses
 * one tile every eight ticks (7.5 / 60 = 0.125 tiles per tick), fast enough
 * that the kicker can follow into the tile it left.
 */
export const BOMB_KICK_SPEED = 7.5;

export const STARTING_LIVES = 3;
export const BASE_BOMB_CAPACITY = 1;
export const BASE_BLAST_RANGE = 1;
export const BASE_FUSE_MS = 2200;
export const BASE_FUSE_TICKS = 132;
export const BLAST_LIFETIME_MS = 450;
export const BLAST_LIFETIME_TICKS = 27;
export const RESPAWN_DELAY_TICKS = 90;
export const RESPAWN_INVULNERABILITY_TICKS = 150;
export const BRICK_POINTS = 10;
export const RIVAL_POINTS = 500;

export const PLAYER_BOMBER_ID = 'player';

/** Converts a duration in milliseconds to whole simulation ticks. */
export function msToTicks(ms: number): number {
  return Math.max(1, Math.round((ms * TICKS_PER_SECOND) / 1000));
}

/** Converts a whole number of simulation ticks to milliseconds. */
export function ticksToMs(ticks: number): number {
  return (ticks * 1000) / TICKS_PER_SECOND;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface TileCoord {
  readonly x: number;
  readonly y: number;
}

export type TileKind = 'floor' | 'wall' | 'brick';

/** Collectible power-up kinds hidden under bricks. */
export type PowerUpKind = 'bomb' | 'fire' | 'speed' | 'shield';

/** A revealed power-up waiting on the arena floor. */
export interface PowerUpState {
  readonly tile: TileCoord;
  readonly kind: PowerUpKind;
}

/**
 * Row-major tile grid. `tiles[y * width + x]`.
 * The arena is the static terrain of a stage; bombers, bombs, blasts, and
 * power-ups are separate stage state.
 */
export interface ArenaState {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly TileKind[];
}

export type StageStatus = 'playing' | 'cleared' | 'gameover';

/** AI temperament that drives rival decision weights. */
export type RivalPersonality = 'aggressive' | 'balanced' | 'cautious';

/** Read-only view of the player bomber used by the renderer, HUD, and tests. */
export interface PlayerState {
  /** Tile occupied at rest, or the tile being left while mid-step. */
  readonly tile: TileCoord;
  readonly from: TileCoord;
  readonly to: TileCoord;
  /** Step completion in [0, 1). Always 0 while at rest. */
  readonly progress: number;
  /** Interpolated position in tile units for rendering. */
  readonly position: { readonly x: number; readonly y: number };
  readonly direction: Direction;
  readonly moving: boolean;
  /** Movement speed in tiles per second. */
  readonly speed: number;
  /** False while waiting to respawn and after game over. */
  readonly alive: boolean;
  /** Remaining respawn invulnerability in ticks; 0 when vulnerable. */
  readonly invulnerableTicks: number;
  /** Remaining respawn delay in ticks; 0 when alive. */
  readonly respawnTicks: number;
}

/** Read-only view of one AI rival. */
export interface RivalState {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly personality: RivalPersonality;
  readonly tile: TileCoord;
  readonly from: TileCoord;
  readonly to: TileCoord;
  readonly progress: number;
  readonly position: { readonly x: number; readonly y: number };
  readonly direction: Direction;
  readonly moving: boolean;
  readonly alive: boolean;
  readonly bombCapacity: number;
  readonly blastRange: number;
  readonly speedTier: number;
  readonly shieldCharges: number;
  readonly invulnerableTicks: number;
}

/** Read-only view of one live bomb. */
export interface BombState {
  readonly id: number;
  /**
   * Effective tile. While sliding this is the tile the bomb is entering; at
   * rest it equals `from` and `to`.
   */
  readonly tile: TileCoord;
  /** Bomber that placed it. The player is `PLAYER_BOMBER_ID`. */
  readonly owner: string;
  readonly fuseTicks: number;
  readonly fuseRemainingTicks: number;
  readonly fuseRemainingMs: number;
  readonly range: number;
  /** True when the owner may detonate this bomb early (captured at placement). */
  readonly remote: boolean;
  /** True when this bomb's rays continue through bricks (captured at placement). */
  readonly piercing: boolean;
  /** Tile the slide started from, or the resting tile. */
  readonly from: TileCoord;
  /** Tile the slide is entering, or the resting tile. */
  readonly to: TileCoord;
  /** Slide completion in [0, 1). Always 0 while at rest. */
  readonly progress: number;
  readonly moving: boolean;
  /** Interpolated position in tile units for rendering. */
  readonly position: { readonly x: number; readonly y: number };
}

/** Read-only view of one live blast tile. */
export interface BlastState {
  readonly tile: TileCoord;
  readonly remainingTicks: number;
  readonly remainingMs: number;
  /** Bomb whose blast first covered this tile. */
  readonly sourceBombId: number;
  /** True when any bomb contributing to this tile pierces bricks. */
  readonly piercing: boolean;
}

/** Counters accumulated during one stage. */
export interface StageStats {
  readonly bricksDestroyed: number;
  readonly rivalsDefeated: number;
  readonly powerUpsCollected: number;
}

/** Snapshot of everything an observer may read from a stage. */
export interface StageState {
  readonly stage: number;
  readonly seed: number;
  readonly tick: number;
  readonly arena: ArenaState;
  readonly player: PlayerState;
  readonly lives: number;
  readonly score: number;
  readonly status: StageStatus;
  /** Bombs owned by the player, across every owner in `bombs`. */
  readonly activeBombs: number;
  readonly bombCapacity: number;
  readonly blastRange: number;
  /** Number of collected speed power-ups; each adds 8% movement speed. */
  readonly speedTier: number;
  /** Shield charges currently held; each absorbs one lethal hit. */
  readonly shieldCharges: number;
  /** Fuse duration for newly placed bombs, in milliseconds. */
  readonly fuseMs: number;
  /** Techniques owned by the player for the rest of the run. */
  readonly techniques: TechniqueCounts;
  readonly bombs: readonly BombState[];
  readonly blasts: readonly BlastState[];
  readonly powerUps: readonly PowerUpState[];
  readonly rivals: readonly RivalState[];
  readonly stats: StageStats;
}

/** A bomber's desired action for one tick. */
export interface Intent {
  readonly direction?: Direction | null;
  readonly bomb?: boolean;
  /** Edge-triggered: detonate every live bomb the player owns immediately. */
  readonly detonate?: boolean;
}

/**
 * Observable facts emitted by a tick. Consumers render/play audio from these
 * and never mutate simulation state. New event kinds are added additively.
 */
export type StageEvent =
  | {
      readonly type: 'player-step';
      readonly tick: number;
      readonly tile: TileCoord;
      readonly direction: Direction;
    }
  | {
      readonly type: 'player-reversed';
      readonly tick: number;
      readonly tile: TileCoord;
      readonly direction: Direction;
    }
  | {
      readonly type: 'bomb-placed';
      readonly tick: number;
      readonly bombId: number;
      readonly tile: TileCoord;
      readonly owner: string;
      readonly fuseTicks: number;
      readonly range: number;
    }
  | {
      readonly type: 'bomb-kicked';
      readonly tick: number;
      readonly bombId: number;
      readonly owner: string;
      /** Tile the bomb left when the slide started. */
      readonly tile: TileCoord;
      readonly direction: Direction;
    }
  | {
      readonly type: 'bomb-detonated';
      readonly tick: number;
      readonly bombId: number;
      readonly tile: TileCoord;
      readonly owner: string;
      readonly range: number;
      /** True when another bomb's blast caused this detonation. */
      readonly chain: boolean;
    }
  | {
      readonly type: 'blast-started';
      readonly tick: number;
      readonly bombId: number;
      readonly tiles: readonly TileCoord[];
    }
  | {
      readonly type: 'brick-destroyed';
      readonly tick: number;
      readonly tile: TileCoord;
      readonly points: number;
    }
  | {
      readonly type: 'power-up-revealed';
      readonly tick: number;
      readonly tile: TileCoord;
      readonly kind: PowerUpKind;
    }
  | {
      readonly type: 'power-up-collected';
      readonly tick: number;
      readonly tile: TileCoord;
      readonly kind: PowerUpKind;
      readonly owner: string;
      readonly points: number;
    }
  | {
      readonly type: 'shield-absorbed';
      readonly tick: number;
      readonly tile: TileCoord;
      readonly chargesRemaining: number;
    }
  | {
      readonly type: 'player-hit';
      readonly tick: number;
      readonly tile: TileCoord;
      readonly cause: 'blast' | 'contact';
    }
  | {
      readonly type: 'life-lost';
      readonly tick: number;
      readonly livesRemaining: number;
    }
  | {
      readonly type: 'respawned';
      readonly tick: number;
      readonly tile: TileCoord;
      readonly invulnerableTicks: number;
    }
  | {
      readonly type: 'rival-hit';
      readonly tick: number;
      readonly rivalId: string;
      readonly rivalName: string;
      readonly tile: TileCoord;
      readonly absorbed: boolean;
    }
  | {
      readonly type: 'rival-defeated';
      readonly tick: number;
      readonly rivalId: string;
      readonly rivalName: string;
      readonly tile: TileCoord;
      readonly points: number;
    }
  | {
      readonly type: 'stage-cleared';
      readonly tick: number;
      readonly stage: number;
      readonly score: number;
      readonly elapsedTicks: number;
    }
  | {
      readonly type: 'game-over';
      readonly tick: number;
      readonly score: number;
    };
