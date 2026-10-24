import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROFILE,
  LEGACY_PROFILE_KEY,
  loadProfile,
  PROFILE_KEY,
  type Profile,
  RUN_HISTORY_LIMIT,
  type RunRecord,
  type RunRecordInput,
  recordRun,
  type StorageLike,
  saveProfile,
  updateSettings,
  V2_PROFILE_KEY,
} from './profile';

const NOW = new Date('2026-10-23T12:00:00.000Z');

type RecordOverrides = Partial<Omit<RunRecord, 'finishedAt'>>;

function result(overrides: RecordOverrides = {}): RunRecordInput {
  const base = {
    score: 1234,
    stage: 3,
    bricksDestroyed: 40,
    rivalsDefeated: 9,
    powerUpsCollected: 7,
    elapsedTicks: 5432,
    techniques: [],
    seed: 99,
  };
  if (overrides.mode === 'daily') {
    return {
      ...base,
      ...overrides,
      mode: 'daily',
      dailyDate: overrides.dailyDate ?? '2026-10-23',
      seed: overrides.seed ?? base.seed,
    };
  }
  if (overrides.mode === 'seed') {
    return {
      ...base,
      ...overrides,
      mode: 'seed',
      dailyDate: null,
      seed: overrides.seed ?? base.seed,
    };
  }
  return {
    ...base,
    ...overrides,
    mode: 'endless',
    dailyDate: null,
    seed: overrides.seed ?? base.seed,
  };
}

function runRecord(score: number, overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    finishedAt: '2026-10-23T12:00:00.000Z',
    mode: 'endless',
    dailyDate: null,
    score,
    stage: 2,
    bricksDestroyed: 10,
    rivalsDefeated: 4,
    powerUpsCollected: 3,
    elapsedTicks: 600,
    techniques: [],
    seed: 42,
    ...overrides,
  };
}

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
    expect(DEFAULT_PROFILE).toMatchObject({
      version: 3,
      history: [],
      dailyBest: null,
    });
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

  it('writes only the v3 key and leaves the old keys untouched', () => {
    const storage = fakeStorage({
      [V2_PROFILE_KEY]: '{"version":2}',
      [LEGACY_PROFILE_KEY]: '{"version":1}',
    });

    saveProfile(storage, DEFAULT_PROFILE);

    expect(storage.data[PROFILE_KEY]).toBe(JSON.stringify(DEFAULT_PROFILE));
    expect(storage.data[V2_PROFILE_KEY]).toBe('{"version":2}');
    expect(storage.data[LEGACY_PROFILE_KEY]).toBe('{"version":1}');
  });

  it('updates only the requested setting', () => {
    const next = updateSettings(DEFAULT_PROFILE, { highContrast: true });
    expect(next.settings.highContrast).toBe(true);
    expect(next.settings.sound).toBe(DEFAULT_PROFILE.settings.sound);
  });

  it('migrates a v1 profile without touching the v1 key', () => {
    const legacy = JSON.stringify({
      version: 1,
      highScore: 4321,
      bestStage: 6,
      runsPlayed: 9,
      settings: {
        sound: false,
        music: true,
        screenShake: false,
        reducedMotion: true,
        highContrast: true,
      },
    });
    const storage = fakeStorage({ [LEGACY_PROFILE_KEY]: legacy });

    expect(loadProfile(storage)).toEqual({
      version: 3,
      highScore: 4321,
      bestStage: 6,
      runsPlayed: 9,
      settings: {
        sound: false,
        music: true,
        screenShake: false,
        reducedMotion: true,
        highContrast: true,
      },
      history: [],
      dailyBest: null,
    });
    expect(storage.data[LEGACY_PROFILE_KEY]).toBe(legacy);
    expect(storage.data[PROFILE_KEY]).toBeUndefined();
  });

  it('migrates a v2 profile once, preserving its bests, settings, history, and Daily Best', () => {
    const dailyEntry = {
      finishedAt: '2026-10-22T18:30:00.000Z',
      mode: 'daily',
      dailyDate: '2026-10-22',
      score: 8800,
      stage: 7,
      bricksDestroyed: 99,
      rivalsDefeated: 12,
      powerUpsCollected: 4,
      elapsedTicks: 9000,
      techniques: ['kick'],
    };
    const endlessEntry = {
      finishedAt: '2026-10-21T09:15:00.000Z',
      mode: 'endless',
      dailyDate: null,
      // A stray v2 Seed must not survive migration.
      seed: 1234,
      score: 4200,
      stage: 5,
      bricksDestroyed: 55,
      rivalsDefeated: 8,
      powerUpsCollected: 2,
      elapsedTicks: 6000,
      techniques: ['remote', 'pierce'],
    };
    const v2 = JSON.stringify({
      version: 2,
      highScore: 8800,
      bestStage: 7,
      runsPlayed: 12,
      settings: {
        sound: false,
        music: true,
        screenShake: false,
        reducedMotion: true,
        highContrast: true,
      },
      history: [dailyEntry, endlessEntry],
      dailyBest: { date: '2026-10-22', score: 8800 },
    });
    const storage = fakeStorage({
      [V2_PROFILE_KEY]: v2,
      [LEGACY_PROFILE_KEY]: JSON.stringify({ highScore: 999, bestStage: 9, runsPlayed: 9 }),
    });

    expect(loadProfile(storage)).toEqual({
      version: 3,
      highScore: 8800,
      bestStage: 7,
      runsPlayed: 12,
      settings: {
        sound: false,
        music: true,
        screenShake: false,
        reducedMotion: true,
        highContrast: true,
      },
      history: [
        { ...dailyEntry, seed: null },
        { ...endlessEntry, seed: null },
      ],
      dailyBest: { date: '2026-10-22', score: 8800 },
    });
    expect(storage.data[V2_PROFILE_KEY]).toBe(v2);
    expect(storage.data[PROFILE_KEY]).toBeUndefined();
  });

  it('prefers v3 when every profile key exists', () => {
    const storage = fakeStorage({
      [PROFILE_KEY]: JSON.stringify({ ...DEFAULT_PROFILE, highScore: 200 }),
      [V2_PROFILE_KEY]: JSON.stringify({ ...DEFAULT_PROFILE, version: 2, highScore: 500 }),
      [LEGACY_PROFILE_KEY]: JSON.stringify({ highScore: 999, bestStage: 9, runsPlayed: 9 }),
    });
    expect(loadProfile(storage).highScore).toBe(200);
  });

  it('falls back to defaults for a malformed profile', () => {
    expect(loadProfile(fakeStorage({ [PROFILE_KEY]: '{nope' }))).toEqual(DEFAULT_PROFILE);
    expect(loadProfile(fakeStorage({ [PROFILE_KEY]: 'null' }))).toEqual(DEFAULT_PROFILE);
    expect(
      loadProfile(
        fakeStorage({
          [PROFILE_KEY]: '{nope',
          [LEGACY_PROFILE_KEY]: JSON.stringify({ highScore: 999 }),
        }),
      ),
    ).toEqual(DEFAULT_PROFILE);
    expect(
      loadProfile(
        fakeStorage({
          [PROFILE_KEY]: '{nope',
          [V2_PROFILE_KEY]: JSON.stringify({ version: 2, highScore: 999 }),
        }),
      ),
    ).toEqual(DEFAULT_PROFILE);
    expect(loadProfile(fakeStorage({ [LEGACY_PROFILE_KEY]: '[]' }))).toEqual(DEFAULT_PROFILE);
    expect(loadProfile(fakeStorage({ [LEGACY_PROFILE_KEY]: '{nope' }))).toEqual(DEFAULT_PROFILE);
  });

  it('never falls back to v1 when a v2 key is present but malformed', () => {
    expect(loadProfile(fakeStorage({ [V2_PROFILE_KEY]: '{nope' }))).toEqual(DEFAULT_PROFILE);
    expect(loadProfile(fakeStorage({ [V2_PROFILE_KEY]: 'null' }))).toEqual(DEFAULT_PROFILE);
    expect(
      loadProfile(
        fakeStorage({
          [V2_PROFILE_KEY]: '{nope',
          [LEGACY_PROFILE_KEY]: JSON.stringify({ highScore: 999, bestStage: 9 }),
        }),
      ),
    ).toEqual(DEFAULT_PROFILE);
    expect(
      loadProfile(
        fakeStorage({ [V2_PROFILE_KEY]: JSON.stringify({ version: 1, highScore: 500 }) }),
      ),
    ).toEqual(DEFAULT_PROFILE);
  });

  it('records a finished run as the newest record with its full summary', () => {
    const profile = recordRun(
      DEFAULT_PROFILE,
      result({ techniques: ['pierce', 'kick', 'pierce'] }),
      NOW,
    );

    expect(profile.history).toEqual([
      {
        finishedAt: '2026-10-23T12:00:00.000Z',
        mode: 'endless',
        dailyDate: null,
        seed: 99,
        score: 1234,
        stage: 3,
        bricksDestroyed: 40,
        rivalsDefeated: 9,
        powerUpsCollected: 7,
        elapsedTicks: 5432,
        techniques: ['kick', 'pierce'],
      },
    ]);
    expect(profile.runsPlayed).toBe(1);
    expect(profile.highScore).toBe(1234);
    expect(profile.bestStage).toBe(3);
  });

  it('keeps the all-time bests and counts every finish', () => {
    const profile = recordRun(
      { ...DEFAULT_PROFILE, highScore: 500, bestStage: 4, runsPlayed: 2 },
      result({ score: 100, stage: 2 }),
      NOW,
    );
    expect(profile.highScore).toBe(500);
    expect(profile.bestStage).toBe(4);
    expect(profile.runsPlayed).toBe(3);
  });

  it('keeps Run History newest-first and capped', () => {
    let profile = DEFAULT_PROFILE;
    for (let index = 1; index <= RUN_HISTORY_LIMIT + 1; index += 1) {
      profile = recordRun(
        profile,
        result({ score: index * 100 }),
        new Date(Date.UTC(2026, 9, 23, 12, 0, index)),
      );
    }

    expect(profile.history).toHaveLength(RUN_HISTORY_LIMIT);
    expect(profile.history[0]?.score).toBe((RUN_HISTORY_LIMIT + 1) * 100);
    expect(profile.history.at(-1)?.score).toBe(2 * 100);
    expect(profile.runsPlayed).toBe(RUN_HISTORY_LIMIT + 1);
    expect(profile.highScore).toBe((RUN_HISTORY_LIMIT + 1) * 100);
  });

  it('sets the Daily Best from a daily run', () => {
    const profile = recordRun(
      DEFAULT_PROFILE,
      result({ mode: 'daily', dailyDate: '2026-10-23', score: 800 }),
      NOW,
    );
    expect(profile.dailyBest).toEqual({ date: '2026-10-23', score: 800 });
    expect(profile.history[0]).toMatchObject({ mode: 'daily', dailyDate: '2026-10-23' });
  });

  it('keeps the higher score for the same daily date', () => {
    const base = recordRun(
      DEFAULT_PROFILE,
      result({ mode: 'daily', dailyDate: '2026-10-23', score: 800 }),
      NOW,
    );
    const lower = recordRun(
      base,
      result({ mode: 'daily', dailyDate: '2026-10-23', score: 500 }),
      NOW,
    );
    const higher = recordRun(
      base,
      result({ mode: 'daily', dailyDate: '2026-10-23', score: 1200 }),
      NOW,
    );

    expect(lower.dailyBest).toEqual({ date: '2026-10-23', score: 800 });
    expect(higher.dailyBest).toEqual({ date: '2026-10-23', score: 1200 });
  });

  it('replaces the Daily Best on a new date', () => {
    const base = recordRun(
      DEFAULT_PROFILE,
      result({ mode: 'daily', dailyDate: '2026-10-23', score: 800 }),
      NOW,
    );
    const next = recordRun(
      base,
      result({ mode: 'daily', dailyDate: '2026-10-24', score: 300 }),
      NOW,
    );
    expect(next.dailyBest).toEqual({ date: '2026-10-24', score: 300 });
  });

  it('never changes the Daily Best from an endless run', () => {
    const base = recordRun(
      DEFAULT_PROFILE,
      result({ mode: 'daily', dailyDate: '2026-10-23', score: 800 }),
      NOW,
    );
    const next = recordRun(base, result({ mode: 'endless', dailyDate: null, score: 5000 }), NOW);
    expect(next.dailyBest).toEqual({ date: '2026-10-23', score: 800 });
    expect(next.highScore).toBe(5000);
  });

  it('counts a daily run toward the all-time bests', () => {
    const next = recordRun(
      { ...DEFAULT_PROFILE, highScore: 500, bestStage: 2, runsPlayed: 1 },
      result({ mode: 'daily', dailyDate: '2026-10-23', score: 900, stage: 4 }),
      NOW,
    );
    expect(next.highScore).toBe(900);
    expect(next.bestStage).toBe(4);
    expect(next.runsPlayed).toBe(2);
  });

  it('records the mode and Seed for an Endless, Daily, or Seed Run', () => {
    const endless = recordRun(DEFAULT_PROFILE, result({ mode: 'endless', seed: 1 }), NOW);
    expect(endless.history[0]).toMatchObject({
      mode: 'endless',
      dailyDate: null,
      seed: 1,
    });

    const daily = recordRun(
      DEFAULT_PROFILE,
      result({ mode: 'daily', dailyDate: '2026-10-23', seed: 2 }),
      NOW,
    );
    expect(daily.history[0]).toMatchObject({
      mode: 'daily',
      dailyDate: '2026-10-23',
      seed: 2,
    });

    const seed = recordRun(DEFAULT_PROFILE, result({ mode: 'seed', seed: 0 }), NOW);
    expect(seed.history[0]).toMatchObject({
      mode: 'seed',
      dailyDate: null,
      seed: 0,
    });
  });

  it('rejects an invalid Seed on every Run Mode', () => {
    for (const mode of ['endless', 'daily', 'seed'] as const) {
      for (const seed of [-1, 1.5, 0x1_0000_0000, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(() => recordRun(DEFAULT_PROFILE, result({ mode, seed }), NOW)).toThrow(RangeError);
      }
    }
  });

  it('never changes the Daily Best from a Seed Run', () => {
    const base = recordRun(
      DEFAULT_PROFILE,
      result({ mode: 'daily', dailyDate: '2026-10-23', score: 800 }),
      NOW,
    );
    const next = recordRun(base, result({ mode: 'seed', seed: 123, score: 5000, stage: 8 }), NOW);

    expect(next.dailyBest).toEqual({ date: '2026-10-23', score: 800 });
    expect(next.highScore).toBe(5000);
    expect(next.bestStage).toBe(8);
    expect(next.runsPlayed).toBe(2);
  });

  it('round-trips history and the Daily Best', () => {
    const storage = fakeStorage();
    const profile: Profile = {
      ...DEFAULT_PROFILE,
      highScore: 1200,
      bestStage: 3,
      runsPlayed: 1,
      history: [
        runRecord(1200, {
          mode: 'daily',
          dailyDate: '2026-10-23',
          techniques: ['kick', 'pierce'],
        }),
      ],
      dailyBest: { date: '2026-10-23', score: 1200 },
    };

    saveProfile(storage, profile);
    expect(loadProfile(storage)).toEqual(profile);
  });

  it('drops invalid history entries individually', () => {
    const endless = runRecord(100);
    const daily = runRecord(200, { mode: 'daily', dailyDate: '2026-10-23' });
    const storage = fakeStorage({
      [PROFILE_KEY]: JSON.stringify({
        ...DEFAULT_PROFILE,
        history: [
          endless,
          'nope',
          null,
          { ...endless, mode: 'weekly' },
          { ...endless, finishedAt: 'not-a-date' },
          { ...endless, mode: 'daily', dailyDate: '' },
          { ...endless, mode: 'daily', dailyDate: '23/10/2026' },
          daily,
        ],
      }),
    });

    expect(loadProfile(storage).history).toEqual([endless, daily]);
  });

  it('keeps valid Seeds and nulls the Daily Run date on a Seed Run', () => {
    const zero = runRecord(100, { mode: 'seed', dailyDate: null, seed: 0 });
    const max = runRecord(200, { mode: 'seed', dailyDate: null, seed: 0xffffffff });
    const storage = fakeStorage({
      [PROFILE_KEY]: JSON.stringify({
        ...DEFAULT_PROFILE,
        history: [
          zero,
          max,
          { ...max, dailyDate: '2026-10-23' },
          { ...max, mode: 'endless', dailyDate: '2026-10-23' },
        ],
      }),
    });

    expect(loadProfile(storage).history).toEqual([
      zero,
      max,
      { ...max, dailyDate: null },
      { ...max, mode: 'endless', dailyDate: null },
    ]);
  });

  it('drops a Seed Run record without a valid Seed and keeps its neighbours', () => {
    const seedRun = runRecord(300, { mode: 'seed', dailyDate: null, seed: 7 });
    const endless = runRecord(100);
    const storage = fakeStorage({
      [PROFILE_KEY]: JSON.stringify({
        ...DEFAULT_PROFILE,
        history: [
          { ...seedRun, seed: null },
          { ...seedRun, seed: -1 },
          { ...seedRun, seed: 1.5 },
          { ...seedRun, seed: 0x1_0000_0000 },
          { ...seedRun, seed: '7' },
          seedRun,
          endless,
        ],
      }),
    });

    expect(loadProfile(storage).history).toEqual([seedRun, endless]);
  });

  it('treats an invalid Seed on an Endless or Daily record as absent', () => {
    const invalidSeeds = [-1, 1.5, 0x1_0000_0000, '42', null];
    const endless = invalidSeeds.map((seed, index) => ({ ...runRecord(index), seed }));
    const daily = { ...runRecord(99, { mode: 'daily', dailyDate: '2026-10-23' }), seed: -1 };
    const storage = fakeStorage({
      [PROFILE_KEY]: JSON.stringify({
        ...DEFAULT_PROFILE,
        history: [...endless, daily],
      }),
    });

    const loaded = loadProfile(storage).history;
    expect(loaded).toHaveLength(invalidSeeds.length + 1);
    for (const record of loaded) {
      expect(record.seed).toBeNull();
    }
  });

  it('treats a non-finite stored Seed as absent', () => {
    const raw = `{
      "version": 3,
      "highScore": 0,
      "bestStage": 0,
      "runsPlayed": 0,
      "settings": {},
      "dailyBest": null,
      "history": [{
        "finishedAt": "2026-10-23T12:00:00.000Z",
        "mode": "endless",
        "dailyDate": null,
        "seed": 1e999,
        "score": 10,
        "stage": 1,
        "bricksDestroyed": 0,
        "rivalsDefeated": 0,
        "powerUpsCollected": 0,
        "elapsedTicks": 0,
        "techniques": []
      }]
    }`;
    const loaded = loadProfile(fakeStorage({ [PROFILE_KEY]: raw })).history;

    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.seed).toBeNull();
  });

  it('filters unknown techniques and keeps display order', () => {
    const entry = {
      ...runRecord(100),
      techniques: ['pierce', 'bogus', 'kick', 'pierce'],
    };
    const storage = fakeStorage({
      [PROFILE_KEY]: JSON.stringify({
        ...DEFAULT_PROFILE,
        history: [entry],
      }),
    });

    expect(loadProfile(storage).history[0]?.techniques).toEqual(['kick', 'pierce']);
  });

  it('caps Run History on load', () => {
    const history = Array.from({ length: RUN_HISTORY_LIMIT + 1 }, (_, index) => runRecord(index));
    const storage = fakeStorage({
      [PROFILE_KEY]: JSON.stringify({ ...DEFAULT_PROFILE, history }),
    });

    const loaded = loadProfile(storage).history;
    expect(loaded).toHaveLength(RUN_HISTORY_LIMIT);
    expect(loaded[0]?.score).toBe(0);
    expect(loaded.at(-1)?.score).toBe(RUN_HISTORY_LIMIT - 1);
  });

  it('treats a non-array history as empty', () => {
    const storage = fakeStorage({
      [PROFILE_KEY]: JSON.stringify({ ...DEFAULT_PROFILE, history: 'nope' }),
    });
    expect(loadProfile(storage).history).toEqual([]);
  });

  it('clamps invalid loaded numbers to non-negative integers', () => {
    const storage = fakeStorage({
      [PROFILE_KEY]: `{
        "version": 3,
        "highScore": -5,
        "bestStage": 2.8,
        "runsPlayed": 1e999,
        "history": [{
          "finishedAt": "2026-10-23T12:00:00.000Z",
          "mode": "endless",
          "dailyDate": null,
          "score": -5,
          "stage": 2.8,
          "bricksDestroyed": 1e999,
          "rivalsDefeated": 3.9,
          "powerUpsCollected": null,
          "elapsedTicks": "7",
          "techniques": []
        }]
      }`,
    });
    const profile = loadProfile(storage);
    expect(profile.highScore).toBe(0);
    expect(profile.bestStage).toBe(2);
    expect(profile.runsPlayed).toBe(0);
    expect(profile.history[0]).toMatchObject({
      score: 0,
      stage: 2,
      bricksDestroyed: 0,
      rivalsDefeated: 3,
      powerUpsCollected: 0,
      elapsedTicks: 0,
    });
  });

  it('validates the Daily Best', () => {
    const withBest = (dailyBest: unknown) =>
      loadProfile(
        fakeStorage({
          [PROFILE_KEY]: JSON.stringify({ ...DEFAULT_PROFILE, dailyBest }),
        }),
      ).dailyBest;

    expect(withBest({ date: '2026-10-23', score: 500 })).toEqual({
      date: '2026-10-23',
      score: 500,
    });
    expect(withBest({ date: '2026-10-23', score: -5 })).toEqual({
      date: '2026-10-23',
      score: 0,
    });
    expect(withBest({ date: '23/10/2026', score: 500 })).toBeNull();
    expect(withBest({ score: 500 })).toBeNull();
    expect(withBest('nope')).toBeNull();
  });

  it('falls back per setting field', () => {
    const storage = fakeStorage({
      [PROFILE_KEY]: JSON.stringify({
        ...DEFAULT_PROFILE,
        settings: { sound: 'yes', highContrast: true, music: false },
      }),
    });
    const profile = loadProfile(storage);

    expect(profile.settings.sound).toBe(DEFAULT_PROFILE.settings.sound);
    expect(profile.settings.music).toBe(false);
    expect(profile.settings.highContrast).toBe(true);
    expect(profile.settings.screenShake).toBe(DEFAULT_PROFILE.settings.screenShake);
  });

  it('treats a wrong version under the v3 key as malformed', () => {
    const storage = fakeStorage({
      [PROFILE_KEY]: JSON.stringify({ version: 2, highScore: 500 }),
      [V2_PROFILE_KEY]: JSON.stringify({ version: 2, highScore: 600 }),
      [LEGACY_PROFILE_KEY]: JSON.stringify({ highScore: 999 }),
    });
    expect(loadProfile(storage)).toEqual(DEFAULT_PROFILE);
  });

  it('never throws when storage reads or writes fail', () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadProfile(storage)).toEqual(DEFAULT_PROFILE);
    expect(() => saveProfile(storage, DEFAULT_PROFILE)).not.toThrow();
  });
});
