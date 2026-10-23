import { TECHNIQUE_ORDER, type TechniqueId } from '../game';

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

export interface RunResult {
  readonly mode: RunMode;
  readonly dailyDate: string | null;
  readonly score: number;
  readonly stage: number;
  readonly bricksDestroyed: number;
  readonly rivalsDefeated: number;
  readonly powerUpsCollected: number;
  readonly elapsedTicks: number;
  readonly techniques: readonly TechniqueId[];
}

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
export function recordRun(profile: Profile, result: RunResult, now: Date): Profile {
  const score = nonNegativeInteger(result.score);
  const stage = nonNegativeInteger(result.stage);
  const dailyDate = result.mode === 'daily' ? result.dailyDate : null;
  const record: RunRecord = {
    finishedAt: now.toISOString(),
    mode: dailyDate === null ? 'endless' : 'daily',
    dailyDate,
    score,
    stage,
    bricksDestroyed: nonNegativeInteger(result.bricksDestroyed),
    rivalsDefeated: nonNegativeInteger(result.rivalsDefeated),
    powerUpsCollected: nonNegativeInteger(result.powerUpsCollected),
    elapsedTicks: nonNegativeInteger(result.elapsedTicks),
    techniques: normalizeTechniques(result.techniques),
  };

  let dailyBest = profile.dailyBest;
  if (record.mode === 'daily' && dailyDate !== null) {
    dailyBest =
      dailyBest !== null && dailyBest.date === dailyDate
        ? { date: dailyDate, score: Math.max(dailyBest.score, score) }
        : { date: dailyDate, score };
  }

  return {
    ...profile,
    highScore: Math.max(profile.highScore, score),
    bestStage: Math.max(profile.bestStage, stage),
    runsPlayed: profile.runsPlayed + 1,
    history: [record, ...profile.history].slice(0, RUN_HISTORY_LIMIT),
    dailyBest,
  };
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
