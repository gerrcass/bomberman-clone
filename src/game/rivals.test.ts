import { describe, expect, it } from 'vitest';
import {
  rivalBlastRangeForStage,
  rivalBombCapacityForStage,
  rivalReactionTicks,
  rivalSpeedForStage,
} from './ai';
import { createStage, getStageState, tickStage } from './stage';
import type { Direction, StageEvent } from './types';

function run(
  stage: ReturnType<typeof createStage>,
  ticks: number,
  intent: { direction?: Direction | null; bomb?: boolean } = {},
): StageEvent[] {
  const events: StageEvent[] = [];
  for (let index = 0; index < ticks; index += 1) {
    events.push(...tickStage(stage, intent));
  }
  return events;
}

const TRAPPED_RIVAL = [
  '#########',
  '#.#####.#',
  '#P.R###.#',
  '#.###...#',
  '#.......#',
  '#########',
] as const;

describe('rivals', () => {
  it('spawns the requested rivals at explicit tiles', () => {
    const stage = createStage({
      seed: 21,
      arena: ['#########', '#.......#', '#.......#', '#P.....R#', '#########'],
      rivalCount: 1,
      rivalSpawns: [{ x: 7, y: 3 }],
    });
    const state = getStageState(stage);

    expect(state.rivals).toHaveLength(1);
    expect(state.rivals[0]?.name).toBe('Cinder');
    expect(state.rivals[0]?.tile).toEqual({ x: 7, y: 3 });
  });

  it('rivals move and make decisions over time', () => {
    const stage = createStage({
      seed: 22,
      arena: ['#########', '#.......#', '#.......#', '#P.....R#', '#########'],
      rivalCount: 1,
      rivalSpawns: [{ x: 7, y: 3 }],
    });
    const before = getStageState(stage).rivals[0];
    run(stage, 90);
    const after = getStageState(stage).rivals[0];

    expect(after).toBeDefined();
    expect(
      after?.moving === true ||
        before?.tile.x !== after?.tile.x ||
        before?.tile.y !== after?.tile.y,
    ).toBe(true);
  });

  it('a rival trapped in a blast dies and clears the stage', () => {
    const stage = createStage({
      seed: 23,
      stage: 1,
      arena: TRAPPED_RIVAL,
      rivalCount: 1,
      rivalSpawns: [{ x: 3, y: 2 }],
      blastRange: 2,
      fuseMs: 1000,
      scoreMultiplier: 1.5,
    });

    const events: StageEvent[] = [];
    events.push(...tickStage(stage, { bomb: true, direction: 'down' }));
    events.push(...run(stage, 70, { direction: 'down' }));
    events.push(...run(stage, 120));

    const state = getStageState(stage);
    expect(state.rivals[0]?.alive).toBe(false);
    expect(state.status).toBe('cleared');
    const defeated = events.find((event) => event.type === 'rival-defeated');
    expect(defeated).toBeDefined();
    if (defeated?.type === 'rival-defeated') {
      expect(defeated.points).toBe(750);
    }
    expect(events.some((event) => event.type === 'stage-cleared')).toBe(true);
  });

  it('touching a rival costs the player a life', () => {
    const stage = createStage({
      seed: 24,
      arena: ['#########', '#.......#', '#.......#', '#.......#', '#P.R....#', '#########'],
      rivalCount: 1,
      rivalSpawns: [{ x: 3, y: 4 }],
    });

    const events = run(stage, 120);
    const state = getStageState(stage);

    expect(state.lives).toBeLessThan(3);
    expect(events.some((event) => event.type === 'player-hit' && event.cause === 'contact')).toBe(
      true,
    );
  });
});

describe('stage scaling', () => {
  it('spawns two rivals through stage 3 and three from stage 4', () => {
    expect(getStageState(createStage({ seed: 1, stage: 1 })).rivals).toHaveLength(2);
    expect(getStageState(createStage({ seed: 1, stage: 3 })).rivals).toHaveLength(2);
    expect(getStageState(createStage({ seed: 1, stage: 4 })).rivals).toHaveLength(3);
    expect(getStageState(createStage({ seed: 1, stage: 99 })).rivals).toHaveLength(3);
  });

  it('scales rival speed, reaction, capacity, and range with no final stage', () => {
    expect(rivalSpeedForStage(1)).toBe(3.5);
    expect(rivalSpeedForStage(10)).toBeGreaterThan(rivalSpeedForStage(9));
    expect(rivalSpeedForStage(1000)).toBe(5.2);
    expect(rivalReactionTicks(20, 'balanced')).toBeLessThan(rivalReactionTicks(1, 'balanced'));
    expect(rivalReactionTicks(1000, 'balanced')).toBe(6);
    expect(rivalBombCapacityForStage(1)).toBe(1);
    expect(rivalBombCapacityForStage(4)).toBe(2);
    expect(rivalBombCapacityForStage(1000)).toBe(8);
    expect(rivalBlastRangeForStage(1)).toBe(1);
    expect(rivalBlastRangeForStage(5)).toBe(2);
    expect(rivalBlastRangeForStage(1000)).toBe(8);
  });
});
