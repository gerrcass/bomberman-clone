import {
  generateArena,
  isWalkable,
  type ParsedArena,
  PLAYER_SPAWN,
  parseAsciiArena,
} from './arena';
import { createMovementState, type MovementState, tickMovement } from './movement';
import {
  BASE_MOVE_SPEED,
  type Intent,
  type PlayerState,
  type StageEvent,
  type StageState,
  type StageStatus,
  type TileCoord,
} from './types';

const STARTING_LIVES = 3;
const STARTING_BOMB_CAPACITY = 1;
const STARTING_BLAST_RANGE = 1;

export interface StageOptions {
  readonly seed: number;
  readonly stage?: number;
  /** Optional ASCII fixture; `P` marks the player spawn. */
  readonly arena?: readonly string[];
  /** Overrides the spawn when the fixture has no `P` marker. */
  readonly playerSpawn?: TileCoord;
}

/**
 * The stage seam downstream tickets extend: bombs, blasts, pickups, rivals,
 * and AI will join the tick pipeline behind this interface.
 */
export interface Stage {
  /** Advances exactly one fixed 1/60 s tick and returns this tick's events. */
  tick(intent?: Intent): readonly StageEvent[];
  /** Fresh read-only snapshot; safe to hold across ticks. */
  getState(): StageState;
}

/** Convenience function form of `stage.tick`, matching the public seam. */
export function tickStage(stage: Stage, intent: Intent = {}): readonly StageEvent[] {
  return stage.tick(intent);
}

/** Convenience function form of `stage.getState`. */
export function getStageState(stage: Stage): StageState {
  return stage.getState();
}

export function createStage(options: StageOptions): Stage {
  const arena = resolveArena(options);
  const spawn = resolveSpawn(options, arena);
  if (!isWalkable(arena.arena, spawn.x, spawn.y)) {
    throw new Error('Player spawn must be a floor tile');
  }

  const stageNumber = options.stage ?? 1;
  const movement = createMovementState(spawn, 'up', BASE_MOVE_SPEED);

  let tick = 0;
  const lives = STARTING_LIVES;
  const score = 0;
  const status: StageStatus = 'playing';

  return {
    tick(intent: Intent = {}): readonly StageEvent[] {
      const events: StageEvent[] = [];
      const eventTick = tick + 1;

      // Ordered update phases. Later tickets append bomb fuses, blasts,
      // pickups, rival AI, and win/loss resolution after movement.
      if (status === 'playing') {
        tickMovement(movement, intent.direction ?? null, (x, y) => isWalkable(arena.arena, x, y), {
          onStep: (tile, direction) => {
            events.push({ type: 'player-step', tick: eventTick, tile, direction });
          },
          onReverse: (tile, direction) => {
            events.push({ type: 'player-reversed', tick: eventTick, tile, direction });
          },
        });
      }

      tick = eventTick;
      return events;
    },

    getState(): StageState {
      return {
        stage: stageNumber,
        seed: options.seed,
        tick,
        arena: {
          width: arena.arena.width,
          height: arena.arena.height,
          tiles: [...arena.arena.tiles],
        },
        player: snapshotPlayer(movement),
        lives,
        score,
        status,
        activeBombs: 0,
        bombCapacity: STARTING_BOMB_CAPACITY,
        blastRange: STARTING_BLAST_RANGE,
      };
    },
  };
}

function resolveArena(options: StageOptions): ParsedArena {
  if (options.arena !== undefined) {
    return parseAsciiArena(options.arena);
  }
  return { arena: generateArena(options.seed), spawn: null };
}

function resolveSpawn(options: StageOptions, arena: ParsedArena): TileCoord {
  const declared = arena.spawn ?? options.playerSpawn;
  if (declared !== undefined) {
    return declared;
  }

  if (arena.arena.width === 15 && arena.arena.height === 13) {
    return { ...PLAYER_SPAWN };
  }

  return { x: 1, y: arena.arena.height - 2 };
}

function snapshotPlayer(movement: MovementState): PlayerState {
  const moving = movement.from.x !== movement.to.x || movement.from.y !== movement.to.y;
  const tile = moving ? movement.from : movement.to;

  return {
    tile: { ...tile },
    from: { ...movement.from },
    to: { ...movement.to },
    progress: movement.progress,
    position: {
      x: movement.from.x + (movement.to.x - movement.from.x) * movement.progress,
      y: movement.from.y + (movement.to.y - movement.from.y) * movement.progress,
    },
    direction: movement.direction,
    moving,
    speed: movement.speed,
  };
}
