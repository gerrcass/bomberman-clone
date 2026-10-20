import { TICK_SECONDS } from '../game/types';

/** Never simulate more than this many fixed steps in one animation frame. */
export const MAX_CATCH_UP_STEPS = 5;

export interface FixedStepPlan {
  readonly steps: number;
  /** Time left over, to carry into the next frame. */
  readonly accumulator: number;
}

/**
 * Converts wall-clock time into fixed simulation steps. If the page was
 * stalled for longer than the catch-up budget, the backlog is dropped instead
 * of spiralling into an unbounded update loop.
 */
export function planFixedSteps(
  accumulator: number,
  elapsedSeconds: number,
  stepSeconds: number = TICK_SECONDS,
  maxSteps: number = MAX_CATCH_UP_STEPS,
): FixedStepPlan {
  const safeAccumulator = Number.isFinite(accumulator) ? Math.max(0, accumulator) : 0;
  const safeElapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  const total = safeAccumulator + safeElapsed;
  const rawSteps = Math.floor(total / stepSeconds);

  if (rawSteps > maxSteps) {
    return { steps: maxSteps, accumulator: 0 };
  }

  return { steps: rawSteps, accumulator: total - rawSteps * stepSeconds };
}
