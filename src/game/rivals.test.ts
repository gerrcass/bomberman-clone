import { describe, expect, it } from 'vitest';
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
    });

    const events: StageEvent[] = [];
    events.push(...tickStage(stage, { bomb: true, direction: 'down' }));
    events.push(...run(stage, 70, { direction: 'down' }));
    events.push(...run(stage, 120));

    const state = getStageState(stage);
    expect(state.rivals[0]?.alive).toBe(false);
    expect(state.status).toBe('cleared');
    expect(events.some((event) => event.type === 'rival-defeated')).toBe(true);
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
