import { describe, expect, it } from 'vitest';
import { createRun } from './run';
import type { Intent } from './types';

const TRAPPED_RIVAL = [
  '#########',
  '#.#####.#',
  '#P.R###.#',
  '#.###...#',
  '#.......#',
  '#########',
] as const;

function clearFirstStage(
  options: Parameters<typeof createRun>[1] = {},
): ReturnType<typeof createRun> {
  const run = createRun(1234, options);
  run.step({ bomb: true, direction: 'down' });
  for (let index = 0; index < 70; index += 1) {
    run.step({ direction: 'down' });
  }
  for (let index = 0; index < 120; index += 1) {
    run.step({});
  }
  return run;
}

describe('run loop', () => {
  it('starts a fresh run at stage 1 with three lives and two rivals', () => {
    const run = createRun(7);
    const state = run.getState();

    expect(state.stage).toBe(1);
    expect(state.lives).toBe(3);
    expect(state.score).toBe(0);
    expect(state.status).toBe('playing');
    expect(state.stageState.rivals).toHaveLength(2);
    expect(state.upgrades).toEqual({
      bomb: 0,
      fire: 0,
      speed: 0,
      multiplier: 0,
      fuse: 0,
    });
  });

  it('clears a stage, awards a bonus, and offers a three-card draft', () => {
    const run = clearFirstStage({
      firstStage: {
        arena: TRAPPED_RIVAL,
        rivalCount: 1,
        rivalSpawns: [{ x: 3, y: 2 }],
        blastRange: 2,
        fuseMs: 900,
      },
    });
    const state = run.getState();

    expect(state.status).toBe('intermission');
    expect(state.lastClear).not.toBeNull();
    expect(state.lastClear?.basePoints).toBe(1000);
    expect(state.lastClear?.bonusPoints).toBeGreaterThanOrEqual(1000);
    expect(state.score).toBeGreaterThanOrEqual(1000);
    expect(state.draft).toHaveLength(3);
    expect(new Set(state.draft).size).toBe(3);
    expect(state.stats.rivalsDefeated).toBe(1);
  });

  it('applies the chosen upgrade and starts the next stage with carried score', () => {
    const run = clearFirstStage({
      firstStage: {
        arena: TRAPPED_RIVAL,
        rivalCount: 1,
        rivalSpawns: [{ x: 3, y: 2 }],
        blastRange: 2,
        fuseMs: 900,
      },
    });
    const cleared = run.getState();
    const chosen = cleared.draft[0];
    expect(chosen).toBeDefined();
    if (chosen === undefined) {
      return;
    }

    expect(run.chooseUpgrade(chosen)).toBe(true);
    const next = run.getState();

    expect(next.status).toBe('playing');
    expect(next.stage).toBe(2);
    expect(next.score).toBeGreaterThanOrEqual(cleared.score);
    expect(next.stageState.score).toBe(next.score);
    expect(next.draft).toHaveLength(0);
  });

  it('rejects an upgrade outside the intermission', () => {
    const run = createRun(7);
    expect(run.chooseUpgrade('bomb')).toBe(false);
  });

  it('quit ends the run and preserves the score', () => {
    const run = createRun(7);
    run.step({ direction: 'right' });
    const score = run.getState().score;
    run.quit();
    const state = run.getState();

    expect(state.status).toBe('gameover');
    expect(state.lives).toBe(0);
    expect(state.score).toBeGreaterThanOrEqual(score);
  });

  it('plays the same seed identically', () => {
    const script: Intent[] = [
      { direction: 'right' },
      { direction: 'right' },
      { bomb: true },
      { direction: 'down' },
      {},
      {},
    ];
    const first = createRun(99);
    const second = createRun(99);
    const firstEvents = script.flatMap((intent) => first.step(intent));
    const secondEvents = script.flatMap((intent) => second.step(intent));

    expect(firstEvents).toEqual(secondEvents);
    expect(first.getState().stageState.player.position).toEqual(
      second.getState().stageState.player.position,
    );
  });
});
