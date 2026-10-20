import { BASE_MOVE_SPEED, type Direction, TICK_SECONDS, type TileCoord } from './types';

/**
 * Mutable movement state for one bomber. A step is in progress when `from`
 * and `to` differ; `progress` then runs from 0 to 1 toward `to`.
 * At rest `from` equals `to` and `progress` is 0.
 */
export interface MovementState {
  from: TileCoord;
  to: TileCoord;
  progress: number;
  direction: Direction;
  /** Most recent perpendicular input, consumed at the next tile center. */
  pendingDirection: Direction | null;
  /** Tiles per second. */
  speed: number;
}

export interface MovementEvents {
  onStep?: (tile: TileCoord, direction: Direction) => void;
  onReverse?: (tile: TileCoord, direction: Direction) => void;
}

const DELTAS: Record<Direction, TileCoord> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITES: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export function directionDelta(direction: Direction): TileCoord {
  return DELTAS[direction];
}

export function oppositeDirection(direction: Direction): Direction {
  return OPPOSITES[direction];
}

export function isPerpendicular(a: Direction, b: Direction): boolean {
  return a !== b && a !== OPPOSITES[b];
}

export function isMoving(state: MovementState): boolean {
  return state.from.x !== state.to.x || state.from.y !== state.to.y;
}

export function createMovementState(
  tile: TileCoord,
  direction: Direction = 'up',
  speed: number = BASE_MOVE_SPEED,
): MovementState {
  return {
    from: { ...tile },
    to: { ...tile },
    progress: 0,
    direction,
    pendingDirection: null,
    speed,
  };
}

/**
 * Advances one fixed 1/60 s tick.
 *
 * Rules:
 * - a held direction continues from tile center to tile center;
 * - the newest perpendicular direction is buffered and taken at the next
 *   tile center if it is enterable;
 * - reversing mid-step swaps origin/destination and inverts progress;
 * - walls/bricks are checked only when a new step starts, so the bomber
 *   stops exactly on the last walkable tile center.
 */
export function tickMovement(
  state: MovementState,
  intent: Direction | null,
  canEnter: (x: number, y: number) => boolean,
  events: MovementEvents = {},
): void {
  if (isMoving(state)) {
    if (intent !== null && intent === oppositeDirection(state.direction)) {
      // A bomb behind the bomber blocks the retreat just like it blocks a new
      // step. The step already in progress continues toward its destination.
      if (canEnter(state.from.x, state.from.y)) {
        reverse(state, intent, events);
      }
    } else if (intent !== null && isPerpendicular(intent, state.direction)) {
      state.pendingDirection = intent;
    }
  } else if (intent !== null) {
    state.direction = intent;
    startStep(state, intent, canEnter, events);
  }

  let remaining = state.speed * TICK_SECONDS;

  while (remaining > 0 && isMoving(state)) {
    const room = 1 - state.progress;

    if (remaining < room) {
      state.progress += remaining;
      remaining = 0;
      continue;
    }

    remaining -= room;
    state.progress = 0;
    state.from = state.to;

    const nextDirection = chooseNextDirection(state, intent, canEnter);
    if (nextDirection === null) {
      break;
    }
    startStep(state, nextDirection, canEnter, events);
  }
}

function startStep(
  state: MovementState,
  direction: Direction,
  canEnter: (x: number, y: number) => boolean,
  events: MovementEvents,
): boolean {
  const delta = DELTAS[direction];
  const targetX = state.to.x + delta.x;
  const targetY = state.to.y + delta.y;

  if (!canEnter(targetX, targetY)) {
    state.pendingDirection = null;
    return false;
  }

  state.from = state.to;
  state.to = { x: targetX, y: targetY };
  state.direction = direction;
  state.progress = 0;
  state.pendingDirection = null;
  events.onStep?.(state.from, direction);
  return true;
}

function chooseNextDirection(
  state: MovementState,
  held: Direction | null,
  canEnter: (x: number, y: number) => boolean,
): Direction | null {
  const buffered = state.pendingDirection;
  state.pendingDirection = null;

  if (buffered !== null && canStep(state, buffered, canEnter)) {
    return buffered;
  }
  if (held !== null && canStep(state, held, canEnter)) {
    return held;
  }
  return null;
}

function canStep(
  state: MovementState,
  direction: Direction,
  canEnter: (x: number, y: number) => boolean,
): boolean {
  const delta = DELTAS[direction];
  return canEnter(state.to.x + delta.x, state.to.y + delta.y);
}

function reverse(state: MovementState, direction: Direction, events: MovementEvents): void {
  const previousFrom = state.from;
  state.from = state.to;
  state.to = previousFrom;
  state.progress = 1 - state.progress;
  state.direction = direction;
  state.pendingDirection = null;
  events.onReverse?.(state.from, direction);
}
