import { createRng } from './rng';
import { createStage, type Stage, type StageOptions } from './stage';
import type { Intent, StageEvent, StageState, StageStats, TileCoord } from './types';
import {
  applyUpgrade,
  blastRangeFor,
  bombCapacityFor,
  draftUpgrades,
  fuseMsFor,
  INITIAL_UPGRADES,
  scoreMultiplierFor,
  speedStacksFor,
  type UpgradeCounts,
  type UpgradeId,
} from './upgrades';

export type RunStatus = 'playing' | 'intermission' | 'gameover';

export interface RunStats extends StageStats {
  readonly elapsedTicks: number;
}

export interface StageClearSummary {
  readonly stage: number;
  readonly basePoints: number;
  readonly timePoints: number;
  readonly bonusPoints: number;
  readonly elapsedTicks: number;
}

export interface RunState {
  readonly seed: number;
  readonly stage: number;
  readonly lives: number;
  readonly score: number;
  readonly status: RunStatus;
  readonly stageState: StageState;
  readonly upgrades: UpgradeCounts;
  readonly shieldCharges: number;
  readonly draft: readonly UpgradeId[];
  readonly stats: RunStats;
  readonly lastClear: StageClearSummary | null;
}

export interface RunOptions {
  /**
   * Test/fixture overrides for the first stage only. Generated stages after
   * the first always use the run's seeded arena.
   */
  readonly firstStage?: Partial<
    Pick<StageOptions, 'arena' | 'rivalCount' | 'rivalSpawns' | 'fuseMs' | 'blastRange'>
  >;
}

export interface Run {
  /** Advances one fixed tick and returns the events produced by the stage. */
  step(intent?: Intent): readonly StageEvent[];
  /** Applies an intermission card and starts the next stage. */
  chooseUpgrade(id: UpgradeId): boolean;
  /** Ends the run early, preserving the score earned so far. */
  quit(): void;
  getState(): RunState;
}

const STARTING_LIVES = 3;
const STARTING_SCORE = 0;

export function stageSeed(runSeed: number, stage: number): number {
  let hash = (runSeed ^ Math.imul(stage + 0x9e37_79b9, 0x85eb_ca6b)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2_ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

export function createRun(seed: number, options: RunOptions = {}): Run {
  const normalizedSeed = seed >>> 0;
  const draftRng = createRng((normalizedSeed ^ 0xa511_e9b3) >>> 0);
  let stageNumber = 1;
  let upgrades: UpgradeCounts = INITIAL_UPGRADES;
  let lives = STARTING_LIVES;
  let shieldCharges = 0;
  let score = STARTING_SCORE;
  let status: RunStatus = 'playing';
  let draft: readonly UpgradeId[] = [];
  let lastClear: StageClearSummary | null = null;
  let completedStats: RunStats = {
    bricksDestroyed: 0,
    rivalsDefeated: 0,
    powerUpsCollected: 0,
    elapsedTicks: 0,
  };

  let stage = createStageFor(stageNumber);

  return {
    step(intent: Intent = {}): readonly StageEvent[] {
      if (status !== 'playing') {
        return [];
      }

      const events = stage.tick(intent);
      const stageState = stage.getState();
      score = stageState.score;

      if (stageState.status === 'cleared') {
        score = finishStage(stageState);
        status = 'intermission';
        draft = draftUpgrades({ counts: upgrades, lives, shieldCharges }, draftRng);
      } else if (stageState.status === 'gameover') {
        status = 'gameover';
        lives = 0;
        completedStats = addStats(completedStats, stageState.stats, stageState.tick);
      }

      return events;
    },

    chooseUpgrade(id: UpgradeId): boolean {
      if (status !== 'intermission' || !draft.includes(id)) {
        return false;
      }

      const result = applyUpgrade(id, {
        counts: upgrades,
        lives,
        shieldCharges,
        scoreMultiplier: scoreMultiplierFor(upgrades),
      });
      upgrades = result.counts;
      lives = result.lives;
      shieldCharges = result.shieldCharges;
      score += result.scoreGain;
      draft = [];
      lastClear = null;
      stageNumber += 1;
      status = 'playing';
      stage = createStageFor(stageNumber);
      return true;
    },

    quit(): void {
      if (status === 'gameover') {
        return;
      }
      if (status === 'playing') {
        const stageState = stage.getState();
        score = stageState.score;
        completedStats = addStats(completedStats, stageState.stats, stageState.tick);
      }
      lives = 0;
      status = 'gameover';
      draft = [];
    },

    getState(): RunState {
      const stageState = stage.getState();
      const currentStats = addStats(completedStats, stageState.stats, stageState.tick);
      const stats = status === 'playing' ? currentStats : completedStats;

      return {
        seed: normalizedSeed,
        stage: stageNumber,
        lives,
        score,
        status,
        stageState,
        upgrades,
        shieldCharges,
        draft,
        stats,
        lastClear,
      };
    },
  };

  function createStageFor(number: number): Stage {
    const base: StageOptions = {
      seed: stageSeed(normalizedSeed, number),
      stage: number,
      lives,
      bombCapacity: bombCapacityFor(upgrades),
      blastRange: blastRangeFor(upgrades),
      speedStacks: speedStacksFor(upgrades),
      shieldCharges,
      scoreMultiplier: scoreMultiplierFor(upgrades),
      fuseMs: fuseMsFor(upgrades),
      initialScore: score,
    };

    if (number === 1 && options.firstStage !== undefined) {
      return createStage({ ...base, ...options.firstStage });
    }

    return createStage(base);
  }

  function finishStage(stageState: StageState): number {
    const elapsedSeconds = Math.floor(stageState.tick / 60);
    const timePoints = Math.max(0, 1500 - elapsedSeconds * 20);
    const basePoints = 1000 + 250 * (stageNumber - 1);
    const multiplier = scoreMultiplierFor(upgrades);
    const bonusPoints = Math.round((basePoints + timePoints) * multiplier);
    const total = stageState.score + bonusPoints;

    completedStats = addStats(completedStats, stageState.stats, stageState.tick);
    lives = stageState.lives;
    shieldCharges = stageState.shieldCharges;
    lastClear = {
      stage: stageNumber,
      basePoints,
      timePoints,
      bonusPoints,
      elapsedTicks: stageState.tick,
    };

    return total;
  }
}

function addStats(accumulated: RunStats, stageStats: StageStats, elapsedTicks: number): RunStats {
  return {
    bricksDestroyed: accumulated.bricksDestroyed + stageStats.bricksDestroyed,
    rivalsDefeated: accumulated.rivalsDefeated + stageStats.rivalsDefeated,
    powerUpsCollected: accumulated.powerUpsCollected + stageStats.powerUpsCollected,
    elapsedTicks: accumulated.elapsedTicks + elapsedTicks,
  };
}

export type { TileCoord };
