/**
 * Run-scoped techniques. A technique changes how the player's bombs behave
 * rather than improving a stat. Rivals never own techniques; every effect is
 * player-only. See ADR-0005.
 */

export type TechniqueId = 'kick' | 'remote' | 'pierce';

/** Ownership counts. A technique is owned at most once per run, so values are 0 or 1. */
export interface TechniqueCounts {
  readonly kick: number;
  readonly remote: number;
  readonly pierce: number;
}

export const INITIAL_TECHNIQUES: TechniqueCounts = {
  kick: 0,
  remote: 0,
  pierce: 0,
};

export interface TechniqueDefinition {
  readonly id: TechniqueId;
  readonly name: string;
  readonly effect: string;
  readonly detail: string;
  /** Short all-caps label for the HUD technique strip. */
  readonly chip: string;
  /** Key that activates the technique, or null for a passive technique. */
  readonly key: string | null;
}

export const TECHNIQUE_DEFINITIONS: Readonly<Record<TechniqueId, TechniqueDefinition>> = {
  kick: {
    id: 'kick',
    name: 'Bomb Kick',
    effect: 'Walk into a bomb to kick it',
    detail: 'The bomb slides until terrain, another bomb, or a bomber stops it.',
    chip: 'KICK',
    key: null,
  },
  remote: {
    id: 'remote',
    name: 'Remote Detonation',
    effect: 'Press X to detonate your bombs',
    detail: 'Every live bomb you own detonates at once. Its fuse still runs.',
    chip: 'REMOTE',
    key: 'X',
  },
  pierce: {
    id: 'pierce',
    name: 'Piercing Blast',
    effect: 'Blasts break every brick in range',
    detail: 'Your blasts stop only at walls, not at the first brick.',
    chip: 'PIERCE',
    key: null,
  },
};

/**
 * Techniques that may appear in the draft. Bomb Kick and Piercing Blast join
 * this pool in their own tickets; the model and the draft slot already exist.
 */
export const OFFERED_TECHNIQUES: readonly TechniqueId[] = ['remote'];

/** Stable display order for the HUD strip. */
export const TECHNIQUE_ORDER: readonly TechniqueId[] = ['kick', 'remote', 'pierce'];

export function ownsTechnique(techniques: TechniqueCounts, id: TechniqueId): boolean {
  return techniques[id] > 0;
}

export function ownedTechniqueIds(techniques: TechniqueCounts): readonly TechniqueId[] {
  return TECHNIQUE_ORDER.filter((id) => ownsTechnique(techniques, id));
}

/** Grants a technique, caps at one, and leaves the other counts untouched. */
export function grantTechnique(techniques: TechniqueCounts, id: TechniqueId): TechniqueCounts {
  switch (id) {
    case 'kick':
      return { ...techniques, kick: 1 };
    case 'remote':
      return { ...techniques, remote: 1 };
    case 'pierce':
      return { ...techniques, pierce: 1 };
  }
}
