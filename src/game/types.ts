/** Shared vocabulary for the deterministic simulation. */

export const TICKS_PER_SECOND = 60;
export const TICK_SECONDS = 1 / TICKS_PER_SECOND;

export const TILE_SIZE = 48;

/** Base player movement speed in tiles per second. */
export const BASE_MOVE_SPEED = 4.6;

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface TileCoord {
  readonly x: number;
  readonly y: number;
}

export type TileKind = 'floor' | 'wall' | 'brick';

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
  /** Placeholder until bombs arrive; the HUD already reads it. */
  readonly activeBombs: number;
  readonly bombCapacity: number;
  readonly blastRange: number;
}

/** A bomber's desired action for one tick. */
export interface Intent {
  readonly direction?: Direction | null;
  readonly bomb?: boolean;
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
    };
