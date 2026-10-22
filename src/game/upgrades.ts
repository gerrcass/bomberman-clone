import { MAX_SHIELD_CHARGES } from './powerups';
import type { Rng } from './rng';
import { shuffle } from './rng';
import {
  grantTechnique,
  OFFERED_TECHNIQUES,
  ownsTechnique,
  type TechniqueCounts,
  type TechniqueId,
} from './techniques';

export type StatUpgradeId =
  | 'bomb'
  | 'fire'
  | 'speed'
  | 'shield'
  | 'life'
  | 'multiplier'
  | 'fuse'
  | 'cache';

/** Every card that can appear in an intermission draft. */
export type UpgradeId = StatUpgradeId | TechniqueId;

export interface UpgradeDefinition {
  readonly id: StatUpgradeId;
  readonly name: string;
  readonly effect: string;
  readonly detail: string;
  readonly maxLabel: string;
}

export const UPGRADE_DEFINITIONS: Readonly<Record<StatUpgradeId, UpgradeDefinition>> = {
  bomb: {
    id: 'bomb',
    name: 'Extra Bomb',
    effect: '+1 bomb capacity',
    detail: 'Hold one more bomb at a time.',
    maxLabel: '8 bombs',
  },
  fire: {
    id: 'fire',
    name: 'Fire',
    effect: '+1 blast range',
    detail: 'Blasts reach one tile farther.',
    maxLabel: '8 range',
  },
  speed: {
    id: 'speed',
    name: 'Speed',
    effect: '+8% move speed',
    detail: 'Cross the maze faster.',
    maxLabel: '5 stacks',
  },
  shield: {
    id: 'shield',
    name: 'Shield',
    effect: '+1 shield charge',
    detail: 'Absorb one lethal hit.',
    maxLabel: '2 charges',
  },
  life: {
    id: 'life',
    name: 'Extra Life',
    effect: '+1 life',
    detail: 'Survive one more mistake.',
    maxLabel: '5 lives',
  },
  multiplier: {
    id: 'multiplier',
    name: 'Score Multiplier',
    effect: '+10% score',
    detail: 'Every point award is worth more.',
    maxLabel: '1.5x',
  },
  fuse: {
    id: 'fuse',
    name: 'Short Fuse',
    effect: '-8% bomb fuse',
    detail: 'Bombs detonate sooner.',
    maxLabel: '1.4s',
  },
  cache: {
    id: 'cache',
    name: 'Arena Cache',
    effect: '+750 points',
    detail: 'A guaranteed score boost.',
    maxLabel: 'Repeatable',
  },
};

/** Permanent-for-the-run improvements. Lives and shields are tracked separately. */
export interface UpgradeCounts {
  readonly bomb: number;
  readonly fire: number;
  readonly speed: number;
  readonly multiplier: number;
  readonly fuse: number;
}

export const INITIAL_UPGRADES: UpgradeCounts = {
  bomb: 0,
  fire: 0,
  speed: 0,
  multiplier: 0,
  fuse: 0,
};

export const MAX_UPGRADE_STACKS = {
  bomb: 7,
  fire: 7,
  speed: 5,
  shield: 2,
  life: 5,
  multiplier: 5,
  fuse: 4,
} as const;

export const MAX_LIVES = 5;

export function bombCapacityFor(counts: UpgradeCounts): number {
  return Math.min(8, 1 + counts.bomb);
}

export function blastRangeFor(counts: UpgradeCounts): number {
  return Math.min(8, 1 + counts.fire);
}

export function speedStacksFor(counts: UpgradeCounts): number {
  return Math.min(MAX_UPGRADE_STACKS.speed, counts.speed);
}

export function scoreMultiplierFor(counts: UpgradeCounts): number {
  return 1 + Math.min(MAX_UPGRADE_STACKS.multiplier, counts.multiplier) * 0.1;
}

export function fuseMsFor(counts: UpgradeCounts): number {
  const reduction = Math.min(MAX_UPGRADE_STACKS.fuse, counts.fuse) * 0.08;
  return Math.max(1400, Math.round(2200 * (1 - reduction)));
}

export interface DraftContext {
  readonly counts: UpgradeCounts;
  readonly lives: number;
  readonly shieldCharges: number;
  readonly techniques: TechniqueCounts;
}

/**
 * Builds a deterministic draft of three distinct cards. At most one slot is
 * reserved for an unowned technique; the other slots are stat cards. Arena
 * Cache only enters the pool when fewer than three cards remain.
 */
export function draftUpgrades(context: DraftContext, rng: Rng): readonly UpgradeId[] {
  const available: StatUpgradeId[] = [];

  if (context.counts.bomb < MAX_UPGRADE_STACKS.bomb) available.push('bomb');
  if (context.counts.fire < MAX_UPGRADE_STACKS.fire) available.push('fire');
  if (context.counts.speed < MAX_UPGRADE_STACKS.speed) available.push('speed');
  if (context.shieldCharges < MAX_SHIELD_CHARGES) available.push('shield');
  if (context.lives < MAX_LIVES) available.push('life');
  if (context.counts.multiplier < MAX_UPGRADE_STACKS.multiplier) available.push('multiplier');
  if (context.counts.fuse < MAX_UPGRADE_STACKS.fuse) available.push('fuse');

  const technique = pickTechnique(context.techniques, rng);
  const statSlots = technique === null ? 3 : 2;
  const draft: UpgradeId[] = technique === null ? [] : [technique];
  draft.push(...shuffle(rng, available).slice(0, statSlots));

  while (draft.length < 3) {
    draft.push('cache');
  }
  return draft;
}

function pickTechnique(techniques: TechniqueCounts, rng: Rng): TechniqueId | null {
  const unowned = OFFERED_TECHNIQUES.filter((id) => !ownsTechnique(techniques, id));
  return shuffle(rng, unowned)[0] ?? null;
}

/** Applies one card. Returns the new counts and the immediate score/life changes. */
export interface UpgradeResult {
  readonly counts: UpgradeCounts;
  readonly lives: number;
  readonly shieldCharges: number;
  readonly scoreGain: number;
  readonly techniques: TechniqueCounts;
}

export function applyUpgrade(
  id: UpgradeId,
  context: {
    counts: UpgradeCounts;
    lives: number;
    shieldCharges: number;
    scoreMultiplier: number;
    techniques: TechniqueCounts;
  },
): UpgradeResult {
  const counts = { ...context.counts };
  let lives = context.lives;
  let shieldCharges = context.shieldCharges;
  let techniques = context.techniques;
  let scoreGain = 0;

  switch (id) {
    case 'bomb':
      counts.bomb = Math.min(MAX_UPGRADE_STACKS.bomb, counts.bomb + 1);
      break;
    case 'fire':
      counts.fire = Math.min(MAX_UPGRADE_STACKS.fire, counts.fire + 1);
      break;
    case 'speed':
      counts.speed = Math.min(MAX_UPGRADE_STACKS.speed, counts.speed + 1);
      break;
    case 'shield':
      shieldCharges = Math.min(MAX_SHIELD_CHARGES, shieldCharges + 1);
      break;
    case 'life':
      lives = Math.min(MAX_LIVES, lives + 1);
      break;
    case 'multiplier':
      counts.multiplier = Math.min(MAX_UPGRADE_STACKS.multiplier, counts.multiplier + 1);
      break;
    case 'fuse':
      counts.fuse = Math.min(MAX_UPGRADE_STACKS.fuse, counts.fuse + 1);
      break;
    case 'cache':
      scoreGain = Math.round(750 * context.scoreMultiplier);
      break;
    case 'kick':
    case 'remote':
    case 'pierce':
      techniques = grantTechnique(techniques, id);
      break;
  }

  return { counts, lives, shieldCharges, scoreGain, techniques };
}

/** Narrows a draft card to a technique card. */
export function isTechniqueId(id: UpgradeId): id is TechniqueId {
  return id === 'kick' || id === 'remote' || id === 'pierce';
}
