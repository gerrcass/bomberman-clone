import { describe, expect, it } from 'vitest';

import { createStage, getStageState, tickStage } from './stage';
import { TICK_SECONDS } from './types';

const OPEN_ROOM = [
  '###########',
  '#.........#',
  '#.........#',
  '#P........#',
  '#.........#',
  '###########',
];

const CORNER_ROOM = ['#######', '#.....#', '#..#..#', '#P....#', '#.....#', '#######'];

const ONE_ROW_ROOM = ['#######', '#P....#', '#######'];

const BLOCKED_EDGE_ROOM = ['#########', '#P......#', '#.......#', '#########'];

function createFixtureStage(rows: readonly string[]) {
  return createStage({ seed: 1, arena: rows });
}

function hold(
  stage: ReturnType<typeof createFixtureStage>,
  direction: 'up' | 'down' | 'left' | 'right',
  ticks: number,
) {
  for (let tick = 0; tick < ticks; tick += 1) {
    tickStage(stage, { direction });
  }
}

describe('player movement', () => {
  it('moves smoothly at 4.6 tiles per second while a direction is held', () => {
    const stage = createFixtureStage(OPEN_ROOM);
    const start = getStageState(stage).player;

    expect(start.tile).toEqual({ x: 1, y: 3 });
    expect(start.position).toEqual({ x: 1, y: 3 });
    expect(start.moving).toBe(false);

    hold(stage, 'right', 13);
    const nearlyThere = getStageState(stage).player;
    expect(nearlyThere.from).toEqual({ x: 1, y: 3 });
    expect(nearlyThere.to).toEqual({ x: 2, y: 3 });
    expect(nearlyThere.progress).toBeGreaterThan(0.99);
    expect(nearlyThere.moving).toBe(true);

    hold(stage, 'right', 47);
    const afterOneSecond = getStageState(stage).player;
    expect(afterOneSecond.position.x).toBeCloseTo(1 + 4.6, 6);
    expect(afterOneSecond.position.y).toBeCloseTo(3, 10);
    expect(afterOneSecond.direction).toBe('right');
    expect(afterOneSecond.moving).toBe(true);
  });

  it.each([
    ['wall', ['#####', '#P#.#', '#...#', '#####']],
    ['brick', ['#####', '#PB.#', '#...#', '#####']],
  ])('is blocked by a %s', (_kind, rows) => {
    const stage = createFixtureStage(rows);

    hold(stage, 'right', 30);

    const blocked = getStageState(stage).player;
    expect(blocked.from).toEqual({ x: 1, y: 1 });
    expect(blocked.to).toEqual({ x: 1, y: 1 });
    expect(blocked.position).toEqual({ x: 1, y: 1 });
    expect(blocked.progress).toBe(0);
    expect(blocked.moving).toBe(false);

    // A blocked attempt must not wedge the bomber; another direction still works.
    hold(stage, 'down', 1);
    expect(getStageState(stage).player.from).toEqual({ x: 1, y: 1 });
    expect(getStageState(stage).player.to).toEqual({ x: 1, y: 2 });
  });

  it('buffers a perpendicular direction and takes it at the next tile center', () => {
    const stage = createFixtureStage(CORNER_ROOM);

    hold(stage, 'right', 7);
    expect(getStageState(stage).player.from).toEqual({ x: 1, y: 3 });

    // Tap down for a single tick while still travelling right.
    hold(stage, 'down', 1);
    expect(getStageState(stage).player.direction).toBe('right');

    hold(stage, 'right', 6);

    const turned = getStageState(stage).player;
    expect(turned.from).toEqual({ x: 2, y: 3 });
    expect(turned.to).toEqual({ x: 2, y: 4 });
    expect(turned.direction).toBe('down');
    expect(turned.progress).toBeCloseTo(0.073_333, 5);
    expect(turned.position.x).toBeCloseTo(2, 10);
    expect(turned.position.y).toBeGreaterThan(3);
  });

  it('keeps travelling when the buffered perpendicular tile is blocked', () => {
    const stage = createFixtureStage(ONE_ROW_ROOM);

    hold(stage, 'right', 7);
    hold(stage, 'up', 1);
    hold(stage, 'right', 6);

    const continued = getStageState(stage).player;
    expect(continued.from).toEqual({ x: 2, y: 1 });
    expect(continued.to).toEqual({ x: 3, y: 1 });
    expect(continued.direction).toBe('right');
  });

  it('reverses mid-step by swapping origin and destination and inverting progress', () => {
    const stage = createFixtureStage(OPEN_ROOM);

    hold(stage, 'right', 5);
    const before = getStageState(stage).player;
    expect(before.progress).toBeCloseTo(5 * 4.6 * TICK_SECONDS, 10);
    expect(before.position.x).toBeGreaterThan(1);

    hold(stage, 'left', 1);
    const after = getStageState(stage).player;

    expect(after.from).toEqual({ x: 2, y: 3 });
    expect(after.to).toEqual({ x: 1, y: 3 });
    expect(after.direction).toBe('left');
    expect(after.progress).toBeCloseTo(1 - before.progress + 4.6 * TICK_SECONDS, 10);
    expect(after.position.x).toBeLessThan(before.position.x);
    expect(before.position.x - after.position.x).toBeCloseTo(4.6 * TICK_SECONDS, 10);

    hold(stage, 'left', 20);
    const stopped = getStageState(stage).player;
    expect(stopped.tile).toEqual({ x: 1, y: 3 });
    expect(stopped.position).toEqual({ x: 1, y: 3 });
    expect(stopped.progress).toBe(0);
    expect(stopped.moving).toBe(false);
  });

  it('finishes the current step and stops when direction is released', () => {
    const stage = createFixtureStage(OPEN_ROOM);

    hold(stage, 'right', 5);
    for (let tick = 0; tick < 20; tick += 1) {
      tickStage(stage, { direction: null });
    }

    const stopped = getStageState(stage).player;
    expect(stopped.tile).toEqual({ x: 2, y: 3 });
    expect(stopped.position).toEqual({ x: 2, y: 3 });
    expect(stopped.progress).toBe(0);
    expect(stopped.moving).toBe(false);
  });

  it('stops cleanly at the edge of a blocking tile', () => {
    const stage = createFixtureStage(BLOCKED_EDGE_ROOM);

    hold(stage, 'right', 300);

    const stopped = getStageState(stage).player;
    expect(stopped.tile).toEqual({ x: 7, y: 1 });
    expect(stopped.position).toEqual({ x: 7, y: 1 });
    expect(stopped.progress).toBe(0);
    expect(stopped.moving).toBe(false);
  });
});
