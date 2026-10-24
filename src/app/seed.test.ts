import { describe, expect, it } from 'vitest';

import { createRun, type Intent, type Run } from '../game';
import { formatSeed, parseSeedCode } from './seed';

describe('formatSeed', () => {
  it('formats known Seeds as canonical uppercase base36', () => {
    expect(formatSeed(0)).toBe('0');
    expect(formatSeed(35)).toBe('Z');
    expect(formatSeed(36)).toBe('10');
    expect(formatSeed(0xffffffff)).toBe('1Z141Z3');
  });

  it('rejects Seeds outside the unsigned 32-bit range', () => {
    expect(() => formatSeed(-1)).toThrow(RangeError);
    expect(() => formatSeed(0x1_0000_0000)).toThrow(RangeError);
    expect(() => formatSeed(Number.NaN)).toThrow(RangeError);
    expect(() => formatSeed(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => formatSeed(1.5)).toThrow(RangeError);
  });
});

describe('parseSeedCode', () => {
  it('parses canonical Seed Codes back to their Seeds', () => {
    expect(parseSeedCode('0')).toBe(0);
    expect(parseSeedCode('Z')).toBe(35);
    expect(parseSeedCode('10')).toBe(36);
    expect(parseSeedCode('1Z141Z3')).toBe(0xffffffff);
  });

  it('accepts lowercase, surrounding whitespace, and leading zeroes', () => {
    expect(parseSeedCode('  1z141z3 ')).toBe(0xffffffff);
    expect(parseSeedCode('\t10\n')).toBe(36);
    expect(parseSeedCode('000010')).toBe(36);
    expect(parseSeedCode('0000')).toBe(0);
  });

  it('round-trips every formatted Seed', () => {
    for (const seed of [0, 1, 35, 36, 1295, 1296, 123_456_789, 0x8000_0000, 0xffffffff]) {
      expect(parseSeedCode(formatSeed(seed))).toBe(seed);
    }
  });

  it('rejects empty, non-base36, over-long, and above-range codes', () => {
    expect(parseSeedCode('')).toBeNull();
    expect(parseSeedCode('   ')).toBeNull();
    expect(parseSeedCode('1Z141Z3!')).toBeNull();
    expect(parseSeedCode('12-3')).toBeNull();
    expect(parseSeedCode('1 Z')).toBeNull();
    expect(parseSeedCode('1Z141Z4')).toBeNull();
    expect(parseSeedCode('ZZZZZZZ')).toBeNull();
    expect(parseSeedCode('10000000')).toBeNull();
  });

  it('ignores leading zeroes when counting significant characters', () => {
    expect(parseSeedCode('0000001Z141Z3')).toBe(0xffffffff);
    expect(parseSeedCode('000000000')).toBe(0);
  });
});

/** Builds a Run from a Seed Code and drives a scripted intent stream. */
function createSeedRun(code: string, script: readonly Intent[]): Run | null {
  const seed = parseSeedCode(code);
  if (seed === null) {
    return null;
  }
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
}

describe('seed-mode determinism', () => {
  it('replays identical state from the same Seed Code and intent script', () => {
    const script: readonly Intent[] = [
      { direction: 'right' },
      { direction: 'right' },
      { bomb: true },
      { direction: 'down' },
      { direction: 'down' },
      ...Array.from({ length: 120 }, (): Intent => ({})),
    ];

    const first = createSeedRun(' 1z141z3 ', script);
    const second = createSeedRun('1Z141Z3', script);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    if (first === null || second === null) {
      return;
    }
    expect(first.getState()).toEqual(second.getState());
    expect(JSON.stringify(first.getState())).toBe(JSON.stringify(second.getState()));
  });

  it('produces a different first arena for a different Seed', () => {
    const first = parseSeedCode('SEED1');
    const second = parseSeedCode('SEED2');

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    if (first === null || second === null) {
      return;
    }
    expect(createRun(first).getState().stageState.arena).not.toEqual(
      createRun(second).getState().stageState.arena,
    );
  });
});
