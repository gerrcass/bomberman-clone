import { describe, expect, it } from 'vitest';

import {
  STAGE_THEME_IDS,
  STAGE_THEMES,
  type StageThemeId,
  themeDefinition,
  themeForStage,
} from './themes';

const SEEDS = [1, 2, 7, 99, 2024, 4_294_967_295];
const NON_PILLAR_THEMES: readonly StageThemeId[] = ['brickworks', 'crossroads', 'twin-courts'];

const GOLDEN_THEME_SEQUENCES: readonly {
  readonly seed: number;
  readonly stages: readonly StageThemeId[];
}[] = [
  {
    seed: 1,
    stages: [
      'pillar-hall',
      'twin-courts',
      'brickworks',
      'crossroads',
      'pillar-hall',
      'brickworks',
      'crossroads',
      'twin-courts',
      'pillar-hall',
      'twin-courts',
      'brickworks',
      'crossroads',
    ],
  },
  {
    seed: 42,
    stages: [
      'pillar-hall',
      'crossroads',
      'twin-courts',
      'brickworks',
      'pillar-hall',
      'brickworks',
      'crossroads',
      'twin-courts',
      'pillar-hall',
      'twin-courts',
      'crossroads',
      'brickworks',
    ],
  },
  {
    seed: 2026,
    stages: [
      'pillar-hall',
      'crossroads',
      'twin-courts',
      'brickworks',
      'pillar-hall',
      'crossroads',
      'brickworks',
      'twin-courts',
      'pillar-hall',
      'twin-courts',
      'brickworks',
      'crossroads',
    ],
  },
  {
    seed: 4_294_967_295,
    stages: [
      'pillar-hall',
      'crossroads',
      'brickworks',
      'twin-courts',
      'pillar-hall',
      'twin-courts',
      'crossroads',
      'brickworks',
      'pillar-hall',
      'twin-courts',
      'brickworks',
      'crossroads',
    ],
  },
];

describe('Stage Theme definitions', () => {
  it('defines the four themes with their display names and brick densities', () => {
    expect(STAGE_THEME_IDS).toEqual(['pillar-hall', 'brickworks', 'crossroads', 'twin-courts']);

    expect(STAGE_THEMES.map((theme) => [theme.id, theme.name, theme.brickDensity])).toEqual([
      ['pillar-hall', 'Pillar Hall', 0.58],
      ['brickworks', 'Brickworks', 0.7],
      ['crossroads', 'Crossroads', 0.5],
      ['twin-courts', 'Twin Courts', 0.62],
    ]);

    for (const theme of STAGE_THEMES) {
      expect(themeDefinition(theme.id)).toBe(theme);
    }
  });
});

describe('themeForStage', () => {
  it('makes stage 1 and every cycle opener Pillar Hall', () => {
    for (const seed of SEEDS) {
      for (const stage of [1, 5, 9, 13, 17, 21]) {
        expect(themeForStage(seed, stage)).toBe('pillar-hall');
      }
    }
  });

  it('covers all four themes exactly once per cycle and never repeats adjacently', () => {
    for (const seed of SEEDS) {
      for (let cycle = 0; cycle < 3; cycle += 1) {
        const themes = [0, 1, 2, 3].map((offset) => themeForStage(seed, cycle * 4 + offset + 1));

        expect(themes[0]).toBe('pillar-hall');
        expect(new Set(themes)).toEqual(new Set(STAGE_THEME_IDS));
        expect(themes).toHaveLength(4);
      }

      for (let stage = 1; stage < 12; stage += 1) {
        expect(themeForStage(seed, stage)).not.toBe(themeForStage(seed, stage + 1));
      }
    }
  });

  it('uses a seeded permutation of the three non-Pillar themes after each opener', () => {
    for (const seed of SEEDS) {
      const cycleThemes = [1, 2, 3].map((offset) => themeForStage(seed, offset + 1));
      expect(new Set(cycleThemes)).toEqual(new Set(NON_PILLAR_THEMES));
    }
  });

  it('matches golden theme sequences for known Seeds across twelve stages', () => {
    for (const { seed, stages } of GOLDEN_THEME_SEQUENCES) {
      const actual = Array.from({ length: stages.length }, (_, index) =>
        themeForStage(seed, index + 1),
      );

      expect(actual, `Seed ${seed}`).toEqual(stages);
    }
  });

  it('varies the non-Pillar order between seeds', () => {
    const orders = new Set<string>();

    // Seeds 1–64 cover all six permutations of the three non-Pillar themes.
    for (let seed = 1; seed <= 64; seed += 1) {
      orders.add([2, 3, 4].map((stage) => themeForStage(seed, stage)).join(','));
    }

    expect([...orders].sort()).toEqual([
      'brickworks,crossroads,twin-courts',
      'brickworks,twin-courts,crossroads',
      'crossroads,brickworks,twin-courts',
      'crossroads,twin-courts,brickworks',
      'twin-courts,brickworks,crossroads',
      'twin-courts,crossroads,brickworks',
    ]);
  });
});
