import { describe, expect, it } from 'vitest';
import { createRun, stageSeed } from './run';

const CLEARABLE = [
  '#########',
  '#.#####.#',
  '#P.R###.#',
  '#.###...#',
  '#.......#',
  '#########',
] as const;

function clearFirstStage() {
  const run = createRun(77, {
    firstStage: {
      arena: CLEARABLE,
      rivalCount: 1,
      rivalSpawns: [{ x: 3, y: 2 }],
      blastRange: 2,
      fuseMs: 900,
    },
  });

  run.step({ bomb: true, direction: 'down' });
  for (let index = 0; index < 70; index += 1) {
    run.step({ direction: 'down' });
  }
  for (let index = 0; index < 120; index += 1) {
    run.step({});
  }
  return run;
}

describe('run', () => {
  it('starts with the spec baseline', () => {
    const state = createRun(123).getState();

    expect(state.stage).toBe(1);
    expect(state.lives).toBe(3);
    expect(state.score).toBe(0);
    expect(state.status).toBe('playing');
    expect(state.shieldCharges).toBe(0);
    expect(state.upgrades.bomb).toBe(0);
    expect(state.draft).toEqual([]);
  });

  it('derives distinct deterministic stage seeds', () => {
    expect(stageSeed(9, 1)).toBe(stageSeed(9, 1));
    expect(stageSeed(9, 1)).not.toBe(stageSeed(9, 2));
  });

  it('clears a stage, awards bonus points, and opens a draft', () => {
    const run = clearFirstStage();
    const state = run.getState();

    expect(state.status).toBe('intermission');
    expect(state.lastClear).not.toBeNull();
    expect(state.lastClear?.basePoints).toBe(1000);
    expect(state.score).toBeGreaterThanOrEqual(1000);
    expect(state.draft).toHaveLength(3);
    expect(new Set(state.draft).size).toBe(3);
    expect(state.stats.rivalsDefeated).toBe(1);
  });

  it('applies an upgrade and carries stats into the next stage', () => {
    const run = clearFirstStage();
    const before = run.getState();
    const choice = before.draft[0];
    expect(choice).toBeDefined();
    if (choice === undefined) {
      return;
    }

    expect(run.chooseUpgrade(choice)).toBe(true);
    const after = run.getState();

    expect(after.status).toBe('playing');
    expect(after.stage).toBe(2);
    expect(after.score).toBeGreaterThanOrEqual(before.score);
    expect(after.stageState.score).toBe(after.score);
    expect(after.draft).toEqual([]);
  });

  it('awards the base and time bonus using the stage clock', () => {
    const run = createRun(88, {
      firstStage: {
        arena: CLEARABLE,
        rivalCount: 1,
        rivalSpawns: [{ x: 3, y: 2 }],
        blastRange: 2,
        fuseMs: 2200,
      },
    });

    run.step({ bomb: true, direction: 'down' });
    for (let index = 0; index < 80; index += 1) {
      run.step({ direction: 'down' });
    }
    for (let index = 0; index < 120; index += 1) {
      run.step({});
    }

    const state = run.getState();
    const clear = state.lastClear;
    expect(clear).not.toBeNull();
    if (clear === null) return;
    expect(clear.basePoints).toBe(1000);
    expect(clear.timePoints).toBe(Math.max(0, 1500 - 20 * Math.floor(clear.elapsedTicks / 60)));
    expect(clear.bonusPoints).toBe(clear.basePoints + clear.timePoints);
    expect(state.score).toBeGreaterThanOrEqual(clear.bonusPoints);
  });

  it('ends the run when the player quits', () => {
    const run = createRun(5);
    run.step({ direction: 'right' });
    run.quit();
    const state = run.getState();

    expect(state.status).toBe('gameover');
    expect(state.lives).toBe(0);
  });
});

describe('quit accounting', () => {
  it('does not double-count a cleared stage when quitting at intermission', () => {
    const run = clearFirstStage();
    const before = run.getState();
    run.quit();
    const after = run.getState();

    expect(after.status).toBe('gameover');
    expect(after.stats).toEqual(before.stats);
    expect(after.score).toBeGreaterThanOrEqual(before.score);
  });
});
