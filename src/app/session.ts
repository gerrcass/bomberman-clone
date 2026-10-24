import type { RunMode, RunRecord } from './profile';
import { formatSeed } from './seed';

/** The mode and captured date/seed for the current Run. */
export type RunSession =
  | { readonly mode: 'endless' }
  | { readonly mode: 'daily'; readonly dailyDate: string; readonly dailySeed: number }
  | { readonly mode: 'seed'; readonly seed: number };

/** The Run Record mode fields a finished Run contributes. */
export type RunRecordMode =
  | { readonly mode: 'endless'; readonly dailyDate: null }
  | { readonly mode: 'daily'; readonly dailyDate: string }
  | { readonly mode: 'seed'; readonly dailyDate: null };

/** The mode fields for the Run Record of the current Run. */
export function runRecordMode(session: RunSession): RunRecordMode {
  switch (session.mode) {
    case 'endless':
      return { mode: 'endless', dailyDate: null };
    case 'daily':
      return { mode: 'daily', dailyDate: session.dailyDate };
    case 'seed':
      return { mode: 'seed', dailyDate: null };
  }
}

/** The Seed Run a Run Record replays as, or null when the record has no Seed. */
export function replaySessionFor(
  record: Pick<RunRecord, 'seed'>,
): Extract<RunSession, { readonly mode: 'seed' }> | null {
  return record.seed === null ? null : { mode: 'seed', seed: record.seed };
}

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

/** The label for a Run Mode badge. */
export function runModeBadge(mode: RunMode): string {
  switch (mode) {
    case 'endless':
      return 'Endless';
    case 'daily':
      return 'Daily';
    case 'seed':
      return 'Seed';
  }
}

/** The mode line for Game Over. */
export function gameOverModeLabel(session: RunSession): string {
  return stageIntroModeLabel(session) ?? 'Endless Run';
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
