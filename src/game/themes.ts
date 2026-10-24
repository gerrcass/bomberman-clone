import { createRng, shuffle } from './rng';

/** The four Stage Themes; each changes terrain layout and palette only. */
export type StageThemeId = 'pillar-hall' | 'brickworks' | 'crossroads' | 'twin-courts';

export interface StageThemeDefinition {
  readonly id: StageThemeId;
  readonly name: string;
  /** Fraction of eligible interior tiles covered by bricks. */
  readonly brickDensity: number;
}

const STAGE_THEME_DEFINITIONS = {
  'pillar-hall': { id: 'pillar-hall', name: 'Pillar Hall', brickDensity: 0.58 },
  brickworks: { id: 'brickworks', name: 'Brickworks', brickDensity: 0.7 },
  crossroads: { id: 'crossroads', name: 'Crossroads', brickDensity: 0.5 },
  'twin-courts': { id: 'twin-courts', name: 'Twin Courts', brickDensity: 0.62 },
} satisfies Record<StageThemeId, StageThemeDefinition>;

/** Canonical theme order, starting with the classic Pillar Hall anchor. */
export const STAGE_THEME_IDS: readonly StageThemeId[] = [
  'pillar-hall',
  'brickworks',
  'crossroads',
  'twin-courts',
];

export const STAGE_THEMES: readonly StageThemeDefinition[] = STAGE_THEME_IDS.map(
  (id) => STAGE_THEME_DEFINITIONS[id],
);

export function themeDefinition(id: StageThemeId): StageThemeDefinition {
  return STAGE_THEME_DEFINITIONS[id];
}

/** Default Stage Theme, used whenever no theme is supplied explicitly. */
export const DEFAULT_STAGE_THEME: StageThemeId = 'pillar-hall';

const CYCLE_LENGTH = 4;
const CYCLE_THEMES: readonly StageThemeId[] = ['brickworks', 'crossroads', 'twin-courts'];

/**
 * Salt that keeps the theme permutation independent of arena and draft draws.
 * Changing it reshuffles theme orders without touching any other seeded stream.
 */
const THEME_SELECTION_SALT = 0x6a09_e667;

/**
 * Pure theme selection for a Stage: Stage 1 and every fourth Stage after it are
 * Pillar Hall, and the other three positions use a seeded permutation of the
 * remaining themes. The same Seed and stage always produce the same theme.
 */
export function themeForStage(runSeed: number, stage: number): StageThemeId {
  const normalizedStage = Number.isFinite(stage) ? Math.max(1, Math.floor(stage)) : 1;
  const cycle = Math.floor((normalizedStage - 1) / CYCLE_LENGTH);
  const position = (normalizedStage - 1) % CYCLE_LENGTH;

  if (position === 0) {
    return DEFAULT_STAGE_THEME;
  }

  return themeOrderForCycle(runSeed, cycle)[position - 1] ?? DEFAULT_STAGE_THEME;
}

function themeOrderForCycle(runSeed: number, cycle: number): readonly StageThemeId[] {
  return shuffle(createRng(themeCycleSeed(runSeed, cycle)), CYCLE_THEMES);
}

function themeCycleSeed(runSeed: number, cycle: number): number {
  let hash = (runSeed >>> 0) ^ Math.imul(cycle + 1, 0x9e37_79b9);
  hash = Math.imul(hash ^ THEME_SELECTION_SALT, 0x85eb_ca6b);
  hash = (hash ^ (hash >>> 13)) >>> 0;
  return (hash ^ (hash >>> 16)) >>> 0;
}
