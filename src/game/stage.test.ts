import { describe, expect, it } from 'vitest';

import { tileAt } from './arena';
import { createStage, getStageState, tickStage } from './stage';
import type { Direction } from './types';

const FIXTURE = ['#######', '#.....#', '#.....#', '#P....#', '#.....#', '#######'];

describe('stage seam', () => {
  it('starts a generated 15 x 13 arena with the player at the bottom-left spawn', () => {
    const stage = createStage({ seed: 1234, stage: 3 });
    const state = getStageState(stage);

    expect(state.arena.width).toBe(15);
    expect(state.arena.height).toBe(13);
    expect(state.stage).toBe(3);
    expect(state.seed).toBe(1234);
    expect(state.tick).toBe(0);
    expect(state.lives).toBe(3);
    expect(state.score).toBe(0);
    expect(state.status).toBe('playing');
    expect(state.activeBombs).toBe(0);
    expect(state.bombCapacity).toBe(1);
    expect(state.player.tile).toEqual({ x: 1, y: 11 });
    expect(state.player.position).toEqual({ x: 1, y: 11 });
    expect(tileAt(state.arena, 1, 11)).toBe('floor');
  });

  it('advances exactly one tick per call', () => {
    const stage = createStage({ seed: 1, arena: FIXTURE });

    tickStage(stage, { direction: 'right' });
    expect(getStageState(stage).tick).toBe(1);

    tickStage(stage, {});
    tickStage(stage, {});
    expect(getStageState(stage).tick).toBe(3);
  });

  it('returns the step events produced by that tick', () => {
    const stage = createStage({ seed: 1, arena: FIXTURE });
    const events: unknown[] = [];

    for (let tick = 0; tick < 14; tick += 1) {
      events.push(...tickStage(stage, { direction: 'right' }));
    }

    expect(events).toEqual([
      { type: 'player-step', tick: 1, tile: { x: 1, y: 3 }, direction: 'right' },
      { type: 'player-step', tick: 14, tile: { x: 2, y: 3 }, direction: 'right' },
    ]);
  });

  it('returns state snapshots that do not change under later ticks', () => {
    const stage = createStage({ seed: 1, arena: FIXTURE });
    const snapshot = getStageState(stage);

    tickStage(stage, { direction: 'right' });
    tickStage(stage, { direction: 'right' });

    expect(snapshot.tick).toBe(0);
    expect(snapshot.player.position).toEqual({ x: 1, y: 3 });
    expect(getStageState(stage).tick).toBe(2);
    expect(getStageState(stage).player.position.x).toBeGreaterThan(1);
  });

  it('replays identical states for the same seed and intent script', () => {
    const first = createStage({ seed: 2024, stage: 2 });
    const second = createStage({ seed: 2024, stage: 2 });
    const directions: Direction[] = ['right', 'down', 'left', 'up'];

    const firstEvents: unknown[] = [];
    const secondEvents: unknown[] = [];

    for (let tick = 0; tick < 240; tick += 1) {
      const direction = tick % 29 === 0 ? null : (directions[Math.floor(tick / 37) % 4] ?? null);
      firstEvents.push(...tickStage(first, { direction }));
      secondEvents.push(...tickStage(second, { direction }));
    }

    expect(firstEvents).toEqual(secondEvents);
    expect(getStageState(first)).toEqual(getStageState(second));
    expect(getStageState(first).tick).toBe(240);
  });

  it('accepts a custom player spawn with an ASCII fixture', () => {
    const stage = createStage({
      seed: 1,
      arena: ['#####', '#...#', '#...#', '#####'],
      playerSpawn: { x: 2, y: 1 },
    });

    expect(getStageState(stage).player.tile).toEqual({ x: 2, y: 1 });
  });
});
