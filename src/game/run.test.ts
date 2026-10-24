import { describe, expect, it } from 'vitest';
import { createRun, type RunOptions, stageSeed } from './run';
import { INITIAL_TECHNIQUES, OFFERED_TECHNIQUES } from './techniques';
import { themeForStage } from './themes';
import { isTechniqueId } from './upgrades';

const CLEARABLE = [
  '#########',
  '#.#####.#',
  '#P.R###.#',
  '#.###...#',
  '#.......#',
  '#########',
] as const;

function clearFirstStage(
  seed = 77,
  firstStage: RunOptions['firstStage'] = {},
  initialTechniques?: RunOptions['initialTechniques'],
) {
  const run = createRun(seed, {
    firstStage: {
      arena: CLEARABLE,
      rivalCount: 1,
      rivalSpawns: [{ x: 3, y: 2 }],
      blastRange: 2,
      fuseMs: 900,
      ...firstStage,
    },
    ...(initialTechniques === undefined ? {} : { initialTechniques }),
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

  it('offers Bomb Kick and carries it into the next stage', () => {
    const run = clearFirstStage(9);
    const state = run.getState();

    expect(state.status).toBe('intermission');
    expect(state.draft.filter((card) => isTechniqueId(card))).toEqual(['kick']);
    expect(run.chooseUpgrade('kick')).toBe(true);

    const after = run.getState();
    expect(after.techniques).toEqual({ kick: 1, remote: 0, pierce: 0 });
    expect(after.stageState.techniques).toEqual({ kick: 1, remote: 0, pierce: 0 });
  });

  it('detonates through the run intent without waiting for the fuse', () => {
    const run = createRun(77, {
      initialTechniques: { ...INITIAL_TECHNIQUES, remote: 1 },
      firstStage: {
        arena: CLEARABLE,
        rivalCount: 1,
        rivalSpawns: [{ x: 3, y: 2 }],
        blastRange: 2,
        fuseMs: 900,
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

  it('starts with techniques owned by the run and carries them into later stages', () => {
    const run = clearFirstStage(77, {}, { ...INITIAL_TECHNIQUES, remote: 1 });
    const before = run.getState();

    expect(before.techniques.remote).toBe(1);
    expect(before.stageState.techniques.remote).toBe(1);

    const choice = before.draft[0];
    expect(choice).toBeDefined();
    if (choice === undefined) return;
    expect(run.chooseUpgrade(choice)).toBe(true);

    const after = run.getState();
    expect(after.techniques.remote).toBe(1);
    expect(after.stageState.techniques.remote).toBe(1);
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

describe('stage themes in a run', () => {
  it('starts in Pillar Hall and passes the seeded theme into the next stage', () => {
    const run = clearFirstStage(77);
    const before = run.getState();

    expect(before.stageState.theme).toBe('pillar-hall');
    expect(before.stageState.theme).toBe(themeForStage(77, 1));

    const choice = before.draft[0];
    expect(choice).toBeDefined();
    if (choice === undefined) return;
    expect(run.chooseUpgrade(choice)).toBe(true);

    const after = run.getState();
    expect(after.stage).toBe(2);
    expect(after.stageState.theme).toBe(themeForStage(77, 2));
    expect(after.stageState.theme).not.toBe('pillar-hall');
  });

  it('reproduces the stage 2 theme for the same seed', () => {
    const first = clearFirstStage(2024);
    const second = clearFirstStage(2024);
    const firstChoice = first.getState().draft[0];
    const secondChoice = second.getState().draft[0];

    expect(firstChoice).toBeDefined();
    expect(firstChoice).toBe(secondChoice);
    if (firstChoice === undefined || secondChoice === undefined) return;

    expect(first.chooseUpgrade(firstChoice)).toBe(true);
    expect(second.chooseUpgrade(secondChoice)).toBe(true);

    expect(first.getState().stageState.theme).toBe(second.getState().stageState.theme);
    expect(first.getState().stageState.theme).toBe(themeForStage(2024, 2));
  });
});
