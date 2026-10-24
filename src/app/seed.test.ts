import { describe, expect, it } from 'vitest';

import { createRun, type Intent, type Run } from '../game';
import {
  buildShareLink,
  formatSeed,
  parseSeedCode,
  parseShareLinkSeed,
  removeSeedParam,
} from './seed';

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

describe('buildShareLink', () => {
  it('keeps the current path and adds the canonical Seed Code', () => {
    const link = buildShareLink('https://example.com/bomberman-clone/', 36);
    const url = new URL(link);

    expect(url.origin).toBe('https://example.com');
    expect(url.pathname).toBe('/bomberman-clone/');
    expect(url.searchParams.get('seed')).toBe('10');
  });

  it('replaces every existing seed while preserving other parameters and the hash', () => {
    const link = buildShareLink(
      'https://example.com/game/?mode=daily&seed=OLD&view=wide&seed=OLDER#top',
      0xffffffff,
    );
    const url = new URL(link);

    expect(url.pathname).toBe('/game/');
    expect(url.searchParams.getAll('seed')).toEqual(['1Z141Z3']);
    expect(url.searchParams.get('mode')).toBe('daily');
    expect(url.searchParams.get('view')).toBe('wide');
    expect(url.hash).toBe('#top');
  });

  it('writes the Seed Code in canonical uppercase', () => {
    const link = buildShareLink('https://example.com/game/?seed=z', 35);

    expect(new URL(link).searchParams.get('seed')).toBe('Z');
  });

  it('treats an invalid Seed as a programmer error', () => {
    expect(() => buildShareLink('https://example.com/', -1)).toThrow(RangeError);
    expect(() => buildShareLink('https://example.com/', 0x1_0000_0000)).toThrow(RangeError);
    expect(() => buildShareLink('https://example.com/', 1.5)).toThrow(RangeError);
  });
});

describe('parseShareLinkSeed', () => {
  it('round-trips a Share Link back to the same Seed', () => {
    const pageUrl = 'https://example.com/bomberman-clone/?mode=daily#top';

    for (const seed of [0, 35, 36, 1295, 1296, 123_456_789, 0xffffffff]) {
      expect(parseShareLinkSeed(buildShareLink(pageUrl, seed))).toBe(seed);
    }
  });

  it('normalizes lowercase and surrounding whitespace in the URL value', () => {
    expect(parseShareLinkSeed('https://example.com/?seed=%201z141z3%20')).toBe(0xffffffff);
    expect(parseShareLinkSeed('https://example.com/?seed=++10++')).toBe(36);
    expect(parseShareLinkSeed('https://example.com/?seed=0000')).toBe(0);
  });

  it('returns null when the seed parameter is missing', () => {
    expect(parseShareLinkSeed('https://example.com/game/')).toBeNull();
    expect(parseShareLinkSeed('https://example.com/game/?mode=daily')).toBeNull();
    expect(parseShareLinkSeed('https://example.com/game/#seed=1Z141Z3')).toBeNull();
    expect(parseShareLinkSeed('https://example.com/game/?xseed=1Z141Z3')).toBeNull();
  });

  it('returns null for an empty or invalid seed value', () => {
    expect(parseShareLinkSeed('https://example.com/?seed=')).toBeNull();
    expect(parseShareLinkSeed('https://example.com/?seed')).toBeNull();
    expect(parseShareLinkSeed('https://example.com/?seed=%20%20')).toBeNull();
    expect(parseShareLinkSeed('https://example.com/?seed=not-a-seed!')).toBeNull();
    expect(parseShareLinkSeed('https://example.com/?seed=1 Z')).toBeNull();
  });

  it('rejects values above the unsigned 32-bit range', () => {
    expect(parseShareLinkSeed('https://example.com/?seed=1Z141Z4')).toBeNull();
    expect(parseShareLinkSeed('https://example.com/?seed=10000000')).toBeNull();
    expect(parseShareLinkSeed('https://example.com/?seed=ZZZZZZZ')).toBeNull();
  });
});

describe('removeSeedParam', () => {
  it('removes only the seed parameter and preserves order, path, and hash', () => {
    expect(removeSeedParam('https://example.com/game/?a=1&seed=1Z141Z3&b=2&c=3#top')).toBe(
      'https://example.com/game/?a=1&b=2&c=3#top',
    );
  });

  it('removes every seed value, including invalid ones', () => {
    expect(removeSeedParam('https://example.com/game/?seed=OLD&mode=daily&seed=not-valid')).toBe(
      'https://example.com/game/?mode=daily',
    );
  });

  it('leaves a URL without a seed parameter untouched', () => {
    const pageUrl = 'https://example.com/game/?mode=daily&seedling=1#top';

    expect(removeSeedParam(pageUrl)).toBe(pageUrl);
  });

  it('drops the query when the seed was its only parameter', () => {
    expect(removeSeedParam('https://example.com/game/?seed=1Z141Z3#top')).toBe(
      'https://example.com/game/#top',
    );
    expect(removeSeedParam('https://example.com/game/?seed=1Z141Z3')).toBe(
      'https://example.com/game/',
    );
  });

  it('preserves the raw form of unrelated parameters', () => {
    expect(removeSeedParam('https://example.com/game/?q=a%20b&seed=10&flag#top')).toBe(
      'https://example.com/game/?q=a%20b&flag#top',
    );
  });

  it('treats the parameter name as case-sensitive', () => {
    expect(removeSeedParam('https://example.com/game/?Seed=OLD&seed=10')).toBe(
      'https://example.com/game/?Seed=OLD',
    );
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
