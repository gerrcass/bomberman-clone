import { describe, expect, it } from 'vitest';
import { createRun, stageSeed } from './run';
import { INITIAL_TECHNIQUES, OFFERED_TECHNIQUES } from './techniques';
import { isTechniqueId } from './upgrades';

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

describe('technique carry-over', () => {
  it('reserves one technique card in the intermission draft', () => {
    const run = clearFirstStage();
    const state = run.getState();

    expect(state.status).toBe('intermission');
    expect(state.draft).toHaveLength(3);
    expect(new Set(state.draft).size).toBe(3);
    const techniqueCards = state.draft.filter((card) => isTechniqueId(card));
    expect(techniqueCards).toHaveLength(1);
    expect(OFFERED_TECHNIQUES).toContain(techniqueCards[0]);
    expect(state.draft.filter((card) => !isTechniqueId(card))).toHaveLength(2);
  });

  it('adds a chosen technique to the run and the next stage snapshot', () => {
    const run = clearFirstStage();
    const choice = run.getState().draft.find((card) => isTechniqueId(card));

    expect(choice).toBeDefined();
    if (choice === undefined) {
      return;
    }

    expect(run.chooseUpgrade(choice)).toBe(true);
    const after = run.getState();

    expect(after.status).toBe('playing');
    expect(after.stage).toBe(2);
    expect(after.draft).toEqual([]);
    expect(after.techniques[choice]).toBe(1);
    expect(after.stageState.techniques).toEqual(after.techniques);
    expect(Object.values(after.techniques).reduce((sum, count) => sum + count, 0)).toBe(1);
  });

  it('detonates through the run intent without waiting for the fuse', () => {
    const run = createRun(77, {
      firstStage: {
        arena: CLEARABLE,
        rivalCount: 1,
        rivalSpawns: [{ x: 3, y: 2 }],
        blastRange: 2,
        fuseMs: 900,
        techniques: { ...INITIAL_TECHNIQUES, remote: 1 },
      },
    });

    const events = run.step({ bomb: true, detonate: true });
    const after = run.getState();

    expect(after.stageState.techniques.remote).toBe(1);
    expect(after.stageState.bombs.filter((bomb) => bomb.owner === 'player')).toHaveLength(0);
    expect(events.some((event) => event.type === 'bomb-placed')).toBe(true);
    expect(events.some((event) => event.type === 'bomb-detonated')).toBe(true);
  });
});

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
