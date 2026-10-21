import { describe, expect, it } from 'vitest';

import { MAX_CATCH_UP_STEPS, planFixedSteps } from './loop';

const STEP = 1 / 60;

describe('fixed-step accumulator', () => {
  it('runs one simulation step for one frame of wall-clock time', () => {
    const plan = planFixedSteps(0, STEP);

    expect(plan.steps).toBe(1);
    expect(plan.accumulator).toBeCloseTo(0, 12);
  });

  it('carries leftover time between frames', () => {
    const first = planFixedSteps(0, STEP * 0.5);
    expect(first.steps).toBe(0);
    expect(first.accumulator).toBeCloseTo(STEP * 0.5, 12);

    const second = planFixedSteps(first.accumulator, STEP * 0.6);
    expect(second.steps).toBe(1);
    expect(second.accumulator).toBeCloseTo(STEP * 0.1, 12);
  });

  it('catches up several steps but caps the backlog', () => {
    const catchUp = planFixedSteps(0, 0.05);
    expect(catchUp.steps).toBe(3);
    expect(catchUp.accumulator).toBeCloseTo(0.05 - 3 * STEP, 12);

    const stalled = planFixedSteps(0, 10);
    expect(stalled.steps).toBe(MAX_CATCH_UP_STEPS);
    expect(stalled.accumulator).toBe(0);
  });

  it('ignores negative or non-finite elapsed time', () => {
    expect(planFixedSteps(0, -1)).toEqual({ steps: 0, accumulator: 0 });
    expect(planFixedSteps(0, Number.NaN)).toEqual({ steps: 0, accumulator: 0 });
  });
});
