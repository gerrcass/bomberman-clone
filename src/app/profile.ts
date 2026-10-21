export interface Settings {
  readonly sound: boolean;
  readonly music: boolean;
  readonly screenShake: boolean;
  readonly reducedMotion: boolean;
  readonly highContrast: boolean;
}

export interface Profile {
  readonly version: 1;
  readonly highScore: number;
  readonly bestStage: number;
  readonly runsPlayed: number;
  readonly settings: Settings;
}

export const PROFILE_KEY = 'bomb-blitz.profile.v1';

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  music: true,
  screenShake: true,
  reducedMotion: false,
  highContrast: false,
};

export const DEFAULT_PROFILE: Profile = {
  version: 1,
  highScore: 0,
  bestStage: 0,
  runsPlayed: 0,
  settings: DEFAULT_SETTINGS,
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadProfile(storage: StorageLike | null): Profile {
  if (storage === null) {
    return DEFAULT_PROFILE;
  }

  try {
    const raw = storage.getItem(PROFILE_KEY);
    if (raw === null) {
      return DEFAULT_PROFILE;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return DEFAULT_PROFILE;
    }

    const record = parsed as Record<string, unknown>;
    const settingsRecord =
      typeof record['settings'] === 'object' && record['settings'] !== null
        ? (record['settings'] as Record<string, unknown>)
        : {};

    return {
      version: 1,
      highScore: nonNegativeInteger(record['highScore']),
      bestStage: nonNegativeInteger(record['bestStage']),
      runsPlayed: nonNegativeInteger(record['runsPlayed']),
      settings: {
        sound: booleanOr(settingsRecord['sound'], DEFAULT_SETTINGS.sound),
        music: booleanOr(settingsRecord['music'], DEFAULT_SETTINGS.music),
        screenShake: booleanOr(settingsRecord['screenShake'], DEFAULT_SETTINGS.screenShake),
        reducedMotion: booleanOr(settingsRecord['reducedMotion'], DEFAULT_SETTINGS.reducedMotion),
        highContrast: booleanOr(settingsRecord['highContrast'], DEFAULT_SETTINGS.highContrast),
      },
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

export interface RunResult {
  readonly score: number;
  readonly stage: number;
}

/** Records a finished run and returns the updated profile. */
export function recordRun(profile: Profile, result: RunResult): Profile {
  const score = nonNegativeInteger(result.score);
  const stage = nonNegativeInteger(result.stage);
  return {
    ...profile,
    highScore: Math.max(profile.highScore, score),
    bestStage: Math.max(profile.bestStage, stage),
    runsPlayed: profile.runsPlayed + 1,
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

function nonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}
