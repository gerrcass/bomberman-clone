import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROFILE,
  loadProfile,
  PROFILE_KEY,
  recordRun,
  type StorageLike,
  saveProfile,
  updateSettings,
} from './profile';

function fakeStorage(initial: Record<string, string> = {}): StorageLike & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem(key) {
      return data[key] ?? null;
    },
    setItem(key, value) {
      data[key] = value;
    },
  };
}

describe('profile', () => {
  it('returns defaults without storage or a stored profile', () => {
    expect(loadProfile(null)).toEqual(DEFAULT_PROFILE);
    expect(loadProfile(fakeStorage())).toEqual(DEFAULT_PROFILE);
  });

  it('round-trips a profile', () => {
    const storage = fakeStorage();
    const profile = {
      ...DEFAULT_PROFILE,
      highScore: 1234,
      bestStage: 4,
      runsPlayed: 2,
      settings: { ...DEFAULT_PROFILE.settings, highContrast: true, music: false },
    };
    saveProfile(storage, profile);
    expect(loadProfile(storage)).toEqual(profile);
  });

  it('falls back on malformed data', () => {
    expect(loadProfile(fakeStorage({ [PROFILE_KEY]: '{nope' }))).toEqual(DEFAULT_PROFILE);
    expect(loadProfile(fakeStorage({ [PROFILE_KEY]: 'null' }))).toEqual(DEFAULT_PROFILE);
  });

  it('clamps invalid values and defaults missing settings', () => {
    const storage = fakeStorage({
      [PROFILE_KEY]: JSON.stringify({
        highScore: -5,
        bestStage: Number.NaN,
        runsPlayed: 2.8,
        settings: { sound: 'yes', highContrast: true },
      }),
    });
    const profile = loadProfile(storage);

    expect(profile.highScore).toBe(0);
    expect(profile.bestStage).toBe(0);
    expect(profile.runsPlayed).toBe(2);
    expect(profile.settings.sound).toBe(true);
    expect(profile.settings.highContrast).toBe(true);
    expect(profile.settings.music).toBe(true);
  });

  it('never throws when storage writes fail', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(() => saveProfile(storage, DEFAULT_PROFILE)).not.toThrow();
  });

  it('records a run and keeps the best values', () => {
    const next = recordRun(
      { ...DEFAULT_PROFILE, highScore: 500, bestStage: 3 },
      { score: 100, stage: 2 },
    );
    expect(next.highScore).toBe(500);
    expect(next.bestStage).toBe(3);
    expect(next.runsPlayed).toBe(1);
  });

  it('updates only the requested setting', () => {
    const next = updateSettings(DEFAULT_PROFILE, { highContrast: true });
    expect(next.settings.highContrast).toBe(true);
    expect(next.settings.sound).toBe(DEFAULT_PROFILE.settings.sound);
  });
});
