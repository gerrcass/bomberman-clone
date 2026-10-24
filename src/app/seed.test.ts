import { describe, expect, it } from 'vitest';

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
