import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import {
  INITIAL_TECHNIQUES,
  OFFERED_TECHNIQUES,
  TECHNIQUE_DEFINITIONS,
  type TechniqueCounts,
  type TechniqueId,
} from './techniques';
import {
  applyUpgrade,
  blastRangeFor,
  bombCapacityFor,
  draftUpgrades,
  fuseMsFor,
  INITIAL_UPGRADES,
  isTechniqueId,
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

const OWNED_REMOTE: TechniqueCounts = { ...INITIAL_TECHNIQUES, remote: 1 };
const OWNED_ALL: TechniqueCounts = { ...INITIAL_TECHNIQUES, kick: 1, remote: 1, pierce: 1 };

function draftContext(overrides: {
  counts?: UpgradeCounts;
  lives?: number;
  shieldCharges?: number;
  techniques?: TechniqueCounts;
}): {
  counts: UpgradeCounts;
  lives: number;
  shieldCharges: number;
  techniques: TechniqueCounts;
} {
  return {
    counts: overrides.counts ?? INITIAL_UPGRADES,
    lives: overrides.lives ?? 3,
    shieldCharges: overrides.shieldCharges ?? 0,
    techniques: overrides.techniques ?? INITIAL_TECHNIQUES,
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
    expect(Object.keys(TECHNIQUE_DEFINITIONS)).toEqual(['kick', 'remote', 'pierce']);
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
  it('reserves one slot for an unowned technique and fills the rest with stat cards', () => {
    const draft = draftUpgrades(draftContext({}), createRng(1));
    const techniqueCards = draft.filter((card) => isTechniqueId(card));

    expect(draft).toHaveLength(3);
    expect(new Set(draft).size).toBe(3);
    expect(techniqueCards).toHaveLength(1);
    expect(OFFERED_TECHNIQUES).toContain(techniqueCards[0]);
    expect(draft.filter((card) => !isTechniqueId(card))).toHaveLength(2);
    expect(draft).not.toContain('cache');
  });

  it('offers Piercing Blast through the technique slot', () => {
    const seen = new Set<TechniqueId>();

    for (let seed = 1; seed <= 24; seed += 1) {
      const draft = draftUpgrades(draftContext({}), createRng(seed));
      const techniqueCards = draft.filter((card) => isTechniqueId(card));

      expect(techniqueCards).toHaveLength(1);
      expect(OFFERED_TECHNIQUES).toContain(techniqueCards[0]);
      if (techniqueCards[0] !== undefined) {
        seen.add(techniqueCards[0]);
      }
    }

    expect(seen).toContain('pierce');
    expect(seen).toContain('remote');
  });

  it('excludes an owned technique while another remains eligible', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const draft = draftUpgrades(draftContext({ techniques: OWNED_REMOTE }), createRng(seed));
      const techniqueCards = draft.filter((card) => isTechniqueId(card));

      expect(draft).toHaveLength(3);
      expect(draft).not.toContain('remote');
      expect(techniqueCards).toHaveLength(1);
      expect(techniqueCards[0]).not.toBe('remote');
      expect(OFFERED_TECHNIQUES).toContain(techniqueCards[0]);
    }
  });

  it('keeps three stat cards when every technique is owned', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const draft = draftUpgrades(draftContext({ techniques: OWNED_ALL }), createRng(seed));

      expect(draft).toHaveLength(3);
      expect(new Set(draft).size).toBe(3);
      expect(draft.some((card) => isTechniqueId(card))).toBe(false);
    }
  });

  it('fills a late draft with Arena Cache when a technique is the only card left', () => {
    const draft = draftUpgrades(
      draftContext({
        counts: maxedCounts(),
        lives: 5,
        shieldCharges: 2,
      }),
      createRng(2),
    );

    const technique = draft[0];
    expect(draft).toHaveLength(3);
    if (technique === undefined) {
      return;
    }
    expect(isTechniqueId(technique)).toBe(true);
    expect(OFFERED_TECHNIQUES).toContain(technique);
    expect(draft.slice(1)).toEqual(['cache', 'cache']);
  });

  it('fills every slot with Arena Cache when every technique is owned and stats are capped', () => {
    const context = {
      counts: maxedCounts(),
      lives: 5,
      shieldCharges: 2,
      techniques: { ...INITIAL_TECHNIQUES, kick: 1, remote: 1, pierce: 1 },
    };

    expect(draftUpgrades(context, createRng(2))).toEqual(['cache', 'cache', 'cache']);
  });

  it('is deterministic for the same seed and context', () => {
    const context = draftContext({});
    expect(draftUpgrades(context, createRng(9))).toEqual(draftUpgrades(context, createRng(9)));
  });
});

describe('applying upgrades', () => {
  it('applies every permanent stat and respects caps', () => {
    const base = {
      counts: INITIAL_UPGRADES,
      lives: 3,
      shieldCharges: 0,
      scoreMultiplier: 1,
      techniques: INITIAL_TECHNIQUES,
    };

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
      techniques: INITIAL_TECHNIQUES,
    };
    expect(applyUpgrade('bomb', maxed).counts.bomb).toBe(MAX_UPGRADE_STACKS.bomb);
    expect(applyUpgrade('fire', maxed).counts.fire).toBe(MAX_UPGRADE_STACKS.fire);
    expect(applyUpgrade('speed', maxed).counts.speed).toBe(MAX_UPGRADE_STACKS.speed);
    expect(applyUpgrade('multiplier', maxed).counts.multiplier).toBe(MAX_UPGRADE_STACKS.multiplier);
    expect(applyUpgrade('fuse', maxed).counts.fuse).toBe(MAX_UPGRADE_STACKS.fuse);
    expect(applyUpgrade('life', maxed).lives).toBe(5);
    expect(applyUpgrade('shield', maxed).shieldCharges).toBe(2);
  });

  it('grants a technique once and leaves the stat counts alone', () => {
    const base = {
      counts: INITIAL_UPGRADES,
      lives: 3,
      shieldCharges: 0,
      scoreMultiplier: 1,
      techniques: INITIAL_TECHNIQUES,
    };

    const granted = applyUpgrade('remote', base);
    expect(granted.techniques.remote).toBe(1);
    expect(granted.counts).toEqual(INITIAL_UPGRADES);

    const repeated = applyUpgrade('remote', { ...base, techniques: granted.techniques });
    expect(repeated.techniques.remote).toBe(1);

    const pierced = applyUpgrade('pierce', base);
    expect(pierced.techniques.pierce).toBe(1);
    expect(pierced.counts).toEqual(INITIAL_UPGRADES);

    expect(applyUpgrade('bomb', base).techniques).toEqual(INITIAL_TECHNIQUES);
  });

  it('rounds Arena Cache awards through the score multiplier', () => {
    expect(
      applyUpgrade('cache', {
        counts: INITIAL_UPGRADES,
        lives: 3,
        shieldCharges: 0,
        scoreMultiplier: 1,
        techniques: INITIAL_TECHNIQUES,
      }).scoreGain,
    ).toBe(750);
    expect(
      applyUpgrade('cache', {
        counts: { ...INITIAL_UPGRADES, multiplier: 1 },
        lives: 3,
        shieldCharges: 0,
        scoreMultiplier: 1.1,
        techniques: INITIAL_TECHNIQUES,
      }).scoreGain,
    ).toBe(825);
  });
});
