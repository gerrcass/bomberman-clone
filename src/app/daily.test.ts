import { describe, expect, it } from 'vitest';

import { createRun, type Intent, type Run } from '../game';
import { dailyDateKey, dailySeed } from './daily';

describe('dailyDateKey', () => {
  it('formats a local January date with a padded month and day', () => {
    expect(dailyDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('formats a local December date with a padded day', () => {
    expect(dailyDateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('uses the local calendar date, not the UTC date', () => {
    // 00:30 local on the first of the month is still the previous UTC day in
    // most western timezones; the key must stay local.
    const date = new Date(2026, 2, 1, 0, 30);

    expect(dailyDateKey(date)).toBe('2026-03-01');
  });
});

describe('dailySeed', () => {
  it('returns the same seed for the same local date', () => {
    const morning = new Date(2026, 9, 23, 8, 15);
    const evening = new Date(2026, 9, 23, 21, 45);

    expect(dailySeed(morning)).toBe(dailySeed(evening));
  });

  it('uses a stable unsigned 32-bit FNV-1a hash of the date key', () => {
    expect(dailySeed(new Date(2026, 0, 15))).toBe(2183670930);
  });

  it('returns a different seed for a different local date', () => {
    expect(dailySeed(new Date(2026, 9, 23))).not.toBe(dailySeed(new Date(2026, 9, 24)));
  });
});

/** Seeds a deterministic arena so the daily seed drives arena and AI draws. */
function createDailyRun(date: Date, script: readonly Intent[]): Run[] {
  const seed = dailySeed(date);
  return [0, 1].map(() => {
    const run = createRun(seed, {
      firstStage: {
        arena: ['#########', '#P......#', '#.#####.#', '#.......#', '#########'],
        rivalCount: 1,
        rivalSpawns: [{ x: 7, y: 1 }],
        blastRange: 2,
        fuseMs: 900,
      },
    });
    for (const intent of script) {
      run.step(intent);
    }
    return run;
  });
}

describe('daily-mode determinism', () => {
  it('replays identical state from the same daily seed and intent script', () => {
    const date = new Date(2026, 9, 23, 9, 30);
    const script: readonly Intent[] = [
      { direction: 'right' },
      { direction: 'right' },
      { bomb: true },
      { direction: 'down' },
      { direction: 'down' },
      ...Array.from({ length: 120 }, (): Intent => ({})),
    ];

    const [first, second] = createDailyRun(date, script);

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) {
      return;
    }
    expect(first.getState()).toEqual(second.getState());
    expect(JSON.stringify(first.getState())).toBe(JSON.stringify(second.getState()));
  });

  it('diverges when the local date seed changes', () => {
    const today = createRun(dailySeed(new Date(2026, 9, 23))).getState();
    const tomorrow = createRun(dailySeed(new Date(2026, 9, 24))).getState();

    expect(today.stageState.arena).not.toEqual(tomorrow.stageState.arena);
  });
});
