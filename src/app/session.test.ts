import { describe, expect, it, vi } from 'vitest';

import type { RunRecord } from './profile';
import {
  gameOverModeLabel,
  type RunSession,
  replaySessionFor,
  retrySeed,
  stageIntroModeLabel,
} from './session';

const ENDLESS: RunSession = { mode: 'endless' };
const DAILY: RunSession = { mode: 'daily', dailyDate: '2026-10-23', dailySeed: 42 };
const SEED: RunSession = { mode: 'seed', seed: 0xffffffff };

function record(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    finishedAt: '2026-10-23T12:00:00.000Z',
    mode: 'endless',
    dailyDate: null,
    seed: 42,
    score: 1234,
    stage: 3,
    bricksDestroyed: 40,
    rivalsDefeated: 9,
    powerUpsCollected: 7,
    elapsedTicks: 5432,
    techniques: [],
    ...overrides,
  };
}

describe('replaySessionFor', () => {
  it('replays an Endless record as a Seed Run with the stored Seed', () => {
    const session = replaySessionFor(record({ mode: 'endless', seed: 42 }));

    expect(session).toEqual({ mode: 'seed', seed: 42 });
    expect(session === null ? null : stageIntroModeLabel(session)).toBe('Seed Run · 16');
  });

  it('replays a Daily record as a Seed Run and drops the original date', () => {
    const session = replaySessionFor(record({ mode: 'daily', dailyDate: '2026-10-23', seed: 42 }));

    expect(session).toEqual({ mode: 'seed', seed: 42 });
    expect(session === null ? null : stageIntroModeLabel(session)).toBe('Seed Run · 16');
  });

  it('replays a Seed record with its stored Seed', () => {
    const session = replaySessionFor(record({ mode: 'seed', seed: 0 }));

    expect(session).toEqual({ mode: 'seed', seed: 0 });
    expect(session === null ? null : stageIntroModeLabel(session)).toBe('Seed Run · 0');
  });

  it('offers no replay for a record without a Seed', () => {
    expect(replaySessionFor(record({ seed: null }))).toBeNull();
  });
});

describe('retrySeed', () => {
  it('reuses the same Seed for a Seed Run', () => {
    const draw = vi.fn(() => 7);

    expect(retrySeed(SEED, draw)).toBe(0xffffffff);
    expect(draw).not.toHaveBeenCalled();
  });

  it('reuses the captured daily Seed for a Daily Run', () => {
    const draw = vi.fn(() => 7);

    expect(retrySeed(DAILY, draw)).toBe(42);
    expect(draw).not.toHaveBeenCalled();
  });

  it('draws a fresh Seed for an Endless Run', () => {
    const draw = vi.fn(() => 1234);

    expect(retrySeed(ENDLESS, draw)).toBe(1234);
    expect(draw).toHaveBeenCalledTimes(1);
  });
});

describe('run mode labels', () => {
  it('names a Seed Run by its Seed Code', () => {
    expect(stageIntroModeLabel(SEED)).toBe('Seed Run · 1Z141Z3');
    expect(gameOverModeLabel(SEED)).toBe('Seed Run · 1Z141Z3');
  });

  it('keeps the Daily Run date in both labels', () => {
    expect(stageIntroModeLabel(DAILY)).toBe('Daily Run · 2026-10-23');
    expect(gameOverModeLabel(DAILY)).toBe('Daily Run · 2026-10-23');
  });

  it('hides the Endless stage-intro label and names the mode on game over', () => {
    expect(stageIntroModeLabel(ENDLESS)).toBeNull();
    expect(gameOverModeLabel(ENDLESS)).toBe('Endless Run');
  });
});
