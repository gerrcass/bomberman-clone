import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import {
  applyUpgrade,
  blastRangeFor,
  bombCapacityFor,
  draftUpgrades,
  fuseMsFor,
  INITIAL_UPGRADES,
  MAX_UPGRADE_STACKS,
  scoreMultiplierFor,
  speedStacksFor,
  UPGRADE_DEFINITIONS,
  type UpgradeCounts,
} from './upgrades';

function maxedCounts(): UpgradeCounts {
  return {
    bomb: MAX_UPGRADE_STACKS.bomb,
    fire: MAX_UPGRADE_STACKS.fire,
    speed: MAX_UPGRADE_STACKS.speed,
    multiplier: MAX_UPGRADE_STACKS.multiplier,
    fuse: MAX_UPGRADE_STACKS.fuse,
  };
}

describe('upgrade definitions and stat helpers', () => {
  it('starts at the spec baseline', () => {
    expect(bombCapacityFor(INITIAL_UPGRADES)).toBe(1);
    expect(blastRangeFor(INITIAL_UPGRADES)).toBe(1);
    expect(speedStacksFor(INITIAL_UPGRADES)).toBe(0);
    expect(scoreMultiplierFor(INITIAL_UPGRADES)).toBe(1);
    expect(fuseMsFor(INITIAL_UPGRADES)).toBe(2200);
    expect(Object.keys(UPGRADE_DEFINITIONS)).toEqual([
      'bomb',
      'fire',
      'speed',
      'shield',
      'life',
      'multiplier',
      'fuse',
      'cache',
    ]);
  });

  it('enforces every upgrade cap and the fuse floor', () => {
    const maxed = maxedCounts();
    expect(bombCapacityFor(maxed)).toBe(8);
    expect(blastRangeFor(maxed)).toBe(8);
    expect(speedStacksFor(maxed)).toBe(5);
    expect(scoreMultiplierFor(maxed)).toBe(1.5);
    expect(fuseMsFor(maxed)).toBeGreaterThanOrEqual(1400);
    expect(fuseMsFor({ ...maxed, fuse: 99 })).toBe(1496);
  });
});

describe('upgrade draft', () => {
  it('offers three distinct permanent upgrades when the pool is full', () => {
    const draft = draftUpgrades(
      { counts: INITIAL_UPGRADES, lives: 3, shieldCharges: 0 },
      createRng(1),
    );

    expect(draft).toHaveLength(3);
    expect(new Set(draft).size).toBe(3);
    expect(draft).not.toContain('cache');
  });

  it('fills missing slots with repeatable Arena Cache cards', () => {
    const draft = draftUpgrades(
      {
        counts: maxedCounts(),
        lives: 5,
        shieldCharges: 2,
      },
      createRng(2),
    );

    expect(draft).toEqual(['cache', 'cache', 'cache']);
  });

  it('is deterministic for the same seed and context', () => {
    const context = { counts: INITIAL_UPGRADES, lives: 3, shieldCharges: 0 };
    expect(draftUpgrades(context, createRng(9))).toEqual(draftUpgrades(context, createRng(9)));
  });
});

describe('applying upgrades', () => {
  it('applies every permanent stat and respects caps', () => {
    const base = { counts: INITIAL_UPGRADES, lives: 3, shieldCharges: 0, scoreMultiplier: 1 };

    expect(applyUpgrade('bomb', base).counts.bomb).toBe(1);
    expect(applyUpgrade('fire', base).counts.fire).toBe(1);
    expect(applyUpgrade('speed', base).counts.speed).toBe(1);
    expect(applyUpgrade('multiplier', base).counts.multiplier).toBe(1);
    expect(applyUpgrade('fuse', base).counts.fuse).toBe(1);
    expect(applyUpgrade('life', base).lives).toBe(4);
    expect(applyUpgrade('shield', base).shieldCharges).toBe(1);

    const maxed = {
      counts: maxedCounts(),
      lives: 5,
      shieldCharges: 2,
      scoreMultiplier: 1.5,
    };
    expect(applyUpgrade('bomb', maxed).counts.bomb).toBe(MAX_UPGRADE_STACKS.bomb);
    expect(applyUpgrade('fire', maxed).counts.fire).toBe(MAX_UPGRADE_STACKS.fire);
    expect(applyUpgrade('speed', maxed).counts.speed).toBe(MAX_UPGRADE_STACKS.speed);
    expect(applyUpgrade('multiplier', maxed).counts.multiplier).toBe(MAX_UPGRADE_STACKS.multiplier);
    expect(applyUpgrade('fuse', maxed).counts.fuse).toBe(MAX_UPGRADE_STACKS.fuse);
    expect(applyUpgrade('life', maxed).lives).toBe(5);
    expect(applyUpgrade('shield', maxed).shieldCharges).toBe(2);
  });

  it('rounds Arena Cache awards through the score multiplier', () => {
    expect(
      applyUpgrade('cache', {
        counts: INITIAL_UPGRADES,
        lives: 3,
        shieldCharges: 0,
        scoreMultiplier: 1,
      }).scoreGain,
    ).toBe(750);
    expect(
      applyUpgrade('cache', {
        counts: { ...INITIAL_UPGRADES, multiplier: 1 },
        lives: 3,
        shieldCharges: 0,
        scoreMultiplier: 1.1,
      }).scoreGain,
    ).toBe(825);
  });
});
