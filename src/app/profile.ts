import { TECHNIQUE_ORDER, type TechniqueId } from '../game';
import { isDailyKey } from './daily';

export interface Settings {
  readonly sound: boolean;
  readonly music: boolean;
  readonly screenShake: boolean;
  readonly reducedMotion: boolean;
  readonly highContrast: boolean;
}

export type RunMode = 'endless' | 'daily';

/** The persisted summary of one finished Run. */
export interface RunRecord {
  /** ISO timestamp supplied by the app when the Run finished. */
  readonly finishedAt: string;
  readonly mode: RunMode;
  /** `YYYY-MM-DD` for a Daily Run, null for an Endless Run. */
  readonly dailyDate: string | null;
  readonly score: number;
  readonly stage: number;
  readonly bricksDestroyed: number;
  readonly rivalsDefeated: number;
  readonly powerUpsCollected: number;
  readonly elapsedTicks: number;
  /** Owned Techniques in stable display order. */
  readonly techniques: readonly TechniqueId[];
}

export interface DailyBest {
  /** Local date key, `YYYY-MM-DD`. */
  readonly date: string;
  readonly score: number;
}

export interface Profile {
  readonly version: 2;
  readonly highScore: number;
  readonly bestStage: number;
  readonly runsPlayed: number;
  readonly settings: Settings;
  readonly history: readonly RunRecord[];
  readonly dailyBest: DailyBest | null;
}

export const PROFILE_KEY = 'bomb-blitz.profile.v2';
export const LEGACY_PROFILE_KEY = 'bomb-blitz.profile.v1';
export const RUN_HISTORY_LIMIT = 20;

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  music: true,
  screenShake: true,
  reducedMotion: false,
  highContrast: false,
};

export const DEFAULT_PROFILE: Profile = {
  version: 2,
  highScore: 0,
  bestStage: 0,
  runsPlayed: 0,
  settings: DEFAULT_SETTINGS,
  history: [],
  dailyBest: null,
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type RunRecordBase = Omit<RunRecord, 'finishedAt' | 'mode' | 'dailyDate'>;

/** The summary a finished Run supplies to `recordRun`. */
export type RunRecordInput = RunRecordBase &
  (
    | { readonly mode: 'endless'; readonly dailyDate: null }
    | { readonly mode: 'daily'; readonly dailyDate: string }
  );

export function loadProfile(storage: StorageLike | null): Profile {
  if (storage === null) {
    return DEFAULT_PROFILE;
  }

  try {
    const raw = storage.getItem(PROFILE_KEY);
    if (raw === null) {
      return loadLegacyProfile(storage);
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return DEFAULT_PROFILE;
    }

    const record = parsed as Record<string, unknown>;
    if (record['version'] !== 2) {
      return DEFAULT_PROFILE;
    }
    return {
      version: 2,
      highScore: nonNegativeInteger(record['highScore']),
      bestStage: nonNegativeInteger(record['bestStage']),
      runsPlayed: nonNegativeInteger(record['runsPlayed']),
      settings: parseSettings(record['settings']),
      history: parseHistory(record['history']),
      dailyBest: parseDailyBest(record['dailyBest']),
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

/**
 * Reads the v1 key once, when v2 is absent, and maps it into v2. The v1 key is
 * never written, so a downgrade still finds the old profile intact.
 */
function loadLegacyProfile(storage: StorageLike): Profile {
  try {
    const raw = storage.getItem(LEGACY_PROFILE_KEY);
    if (raw === null) {
      return DEFAULT_PROFILE;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return DEFAULT_PROFILE;
    }

    const record = parsed as Record<string, unknown>;
    return {
      version: 2,
      highScore: nonNegativeInteger(record['highScore']),
      bestStage: nonNegativeInteger(record['bestStage']),
      runsPlayed: nonNegativeInteger(record['runsPlayed']),
      settings: parseSettings(record['settings']),
      history: [],
      dailyBest: null,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(storage: StorageLike | null, profile: Profile): void {
  if (storage === null) {
    return;
  }
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // A full or unavailable storage must never stop the game.
  }
}

/** Records a finished Run and returns the updated profile. */
export function recordRun(profile: Profile, input: RunRecordInput, now: Date): Profile {
  const record: RunRecord = {
    ...input,
    finishedAt: now.toISOString(),
    score: nonNegativeInteger(input.score),
    stage: nonNegativeInteger(input.stage),
    bricksDestroyed: nonNegativeInteger(input.bricksDestroyed),
    rivalsDefeated: nonNegativeInteger(input.rivalsDefeated),
    powerUpsCollected: nonNegativeInteger(input.powerUpsCollected),
    elapsedTicks: nonNegativeInteger(input.elapsedTicks),
    techniques: normalizeTechniques(input.techniques),
  };

  let dailyBest = profile.dailyBest;
  if (input.mode === 'daily') {
    dailyBest =
      dailyBest !== null && dailyBest.date === input.dailyDate
        ? { date: input.dailyDate, score: Math.max(dailyBest.score, record.score) }
        : { date: input.dailyDate, score: record.score };
  }

  return {
    ...profile,
    highScore: Math.max(profile.highScore, record.score),
    bestStage: Math.max(profile.bestStage, record.stage),
    runsPlayed: profile.runsPlayed + 1,
    history: [record, ...profile.history].slice(0, RUN_HISTORY_LIMIT),
    dailyBest,
  };
}

/** True when a finished score beats the profile's all-time high score. */
export function isNewBest(profile: Profile, score: number): boolean {
  return nonNegativeInteger(score) > profile.highScore;
}

/** True when a daily score beats the stored Daily Best for that date. */
export function isNewDailyBest(profile: Profile, dailyDate: string | null, score: number): boolean {
  if (dailyDate === null || !isDailyKey(dailyDate)) {
    return false;
  }
  const previous = profile.dailyBest?.date === dailyDate ? profile.dailyBest.score : 0;
  return nonNegativeInteger(score) > previous;
}

export function updateSettings(profile: Profile, patch: Partial<Settings>): Profile {
  return {
    ...profile,
    settings: {
      ...profile.settings,
      ...patch,
    },
  };
}

function parseHistory(value: unknown): readonly RunRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const history: RunRecord[] = [];
  for (const entry of value) {
    const record = parseRunRecord(entry);
    if (record !== null) {
      history.push(record);
    }
    if (history.length === RUN_HISTORY_LIMIT) {
      break;
    }
  }
  return history;
}

function parseRunRecord(value: unknown): RunRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const mode = record['mode'];
  if (mode !== 'endless' && mode !== 'daily') {
    return null;
  }

  const finishedAt = record['finishedAt'];
  if (typeof finishedAt !== 'string' || Number.isNaN(Date.parse(finishedAt))) {
    return null;
  }

  let dailyDate: string | null = null;
  if (mode === 'daily') {
    const value = record['dailyDate'];
    if (!isDailyKey(value)) {
      return null;
    }
    dailyDate = value;
  }

  return {
    finishedAt,
    mode,
    dailyDate,
    score: nonNegativeInteger(record['score']),
    stage: nonNegativeInteger(record['stage']),
    bricksDestroyed: nonNegativeInteger(record['bricksDestroyed']),
    rivalsDefeated: nonNegativeInteger(record['rivalsDefeated']),
    powerUpsCollected: nonNegativeInteger(record['powerUpsCollected']),
    elapsedTicks: nonNegativeInteger(record['elapsedTicks']),
    techniques: normalizeTechniques(record['techniques']),
  };
}

function parseDailyBest(value: unknown): DailyBest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const date = record['date'];
  if (!isDailyKey(date)) {
    return null;
  }

  return { date, score: nonNegativeInteger(record['score']) };
}

function parseSettings(value: unknown): Settings {
  const record =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  return {
    sound: booleanOr(record['sound'], DEFAULT_SETTINGS.sound),
    music: booleanOr(record['music'], DEFAULT_SETTINGS.music),
    screenShake: booleanOr(record['screenShake'], DEFAULT_SETTINGS.screenShake),
    reducedMotion: booleanOr(record['reducedMotion'], DEFAULT_SETTINGS.reducedMotion),
    highContrast: booleanOr(record['highContrast'], DEFAULT_SETTINGS.highContrast),
  };
}

function normalizeTechniques(value: unknown): readonly TechniqueId[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const owned = new Set(value);
  return TECHNIQUE_ORDER.filter((id) => owned.has(id));
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}
