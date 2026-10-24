import { formatSeed } from './seed';

/** The mode and captured date/seed for the current Run. */
export type RunSession =
  | { readonly mode: 'endless' }
  | { readonly mode: 'daily'; readonly dailyDate: string; readonly dailySeed: number }
  | { readonly mode: 'seed'; readonly seed: number };

/** The mode line for a Stage intro, or null when the existing intro is enough. */
export function stageIntroModeLabel(session: RunSession): string | null {
  switch (session.mode) {
    case 'endless':
      return null;
    case 'daily':
      return `Daily Run · ${session.dailyDate}`;
    case 'seed':
      return `Seed Run · ${formatSeed(session.seed)}`;
  }
}

/** The mode line for Game Over. */
export function gameOverModeLabel(session: RunSession): string {
  switch (session.mode) {
    case 'endless':
      return 'Endless Run';
    case 'daily':
      return `Daily Run · ${session.dailyDate}`;
    case 'seed':
      return `Seed Run · ${formatSeed(session.seed)}`;
  }
}

/**
 * The Seed a Retry Run uses: the captured Seed for a Seed or Daily Run, and a
 * fresh draw for an Endless Run.
 */
export function retrySeed(session: RunSession, drawEndlessSeed: () => number): number {
  switch (session.mode) {
    case 'endless':
      return drawEndlessSeed();
    case 'daily':
      return session.dailySeed;
    case 'seed':
      return session.seed;
  }
}
