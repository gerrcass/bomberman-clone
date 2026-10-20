import { describe, expect, it } from 'vitest';
import { arenaToAscii, generateArena, type ParsedArena, parseAsciiArena, tileAt } from './arena';
import {
  generateHiddenPowerUps,
  MAX_BLAST_RANGE,
  MAX_BOMB_CAPACITY,
  MAX_SHIELD_CHARGES,
  MAX_SPEED_STACKS,
  POWER_UP_POINTS,
  POWER_UP_TABLE,
  SPEED_STACK_BONUS,
  speedForStacks,
} from './powerups';
import { createStage, getStageState, type Stage, type StageOptions } from './stage';
import {
  BASE_MOVE_SPEED,
  BRICK_POINTS,
  type PowerUpKind,
  type StageEvent,
  type StageState,
} from './types';

/**
 * Player at (3,2) with one brick directly above at (3,1). The player can drop
 * a bomb and walk down out of the range-1 cross before it detonates.
 */
const ONE_BRICK = ['#######', '#..B..#', '#..P..#', '#.....#', '#.....#', '#######'];

/** Open corridor for comparing movement timing at different speed tiers. */
const CORRIDOR = ['##########', '#P.......#', '##########'];

function stageWithPickup(kind: PowerUpKind, options: Partial<StageOptions> = {}): Stage {
  return createStage({
    seed: 99,
    arena: ONE_BRICK,
    hiddenPowerUps: [{ tile: { x: 3, y: 1 }, kind }],
    ...options,
  });
}

function tickMany(
  stage: Stage,
  ticks: number,
  intent: Parameters<Stage['tick']>[0] = {},
): StageEvent[] {
  const events: StageEvent[] = [];
  for (let index = 0; index < ticks; index += 1) {
    events.push(...stage.tick(intent));
  }
  return events;
}

/** Drops a bomb under the brick and escapes downward, then waits for the blast. */
function explodeBrick(stage: Stage): StageEvent[] {
  const events: StageEvent[] = [...stage.tick({ bomb: true })];
  events.push(...tickMany(stage, 40, { direction: 'down' }));

  for (let index = 0; index < 200 && getStageState(stage).bombs.length > 0; index += 1) {
    events.push(...stage.tick({ direction: 'down' }));
  }

  // Let the 450 ms blast clear without stepping onto the revealed pickup.
  events.push(...tickMany(stage, 30, { direction: 'down' }));
  return events;
}

/** Walks up from the escape tile onto the revealed pickup. */
function collectRevealed(stage: Stage): StageEvent[] {
  return tickMany(stage, 70, { direction: 'up' });
}

function revealAndCollect(kind: PowerUpKind, options: Partial<StageOptions> = {}): StageState {
  const stage = stageWithPickup(kind, options);
  explodeBrick(stage);
  collectRevealed(stage);
  return getStageState(stage);
}

function brickTiles(arena: ParsedArena): number {
  let count = 0;
  for (const tile of arena.arena.tiles) {
    if (tile === 'brick') {
      count += 1;
    }
  }
  return count;
}

describe('hidden power-up generation', () => {
  it('hides a power-up under 55% of bricks and guarantees extra bomb and fire', () => {
    const weights = new Map(POWER_UP_TABLE);
    expect([...weights.keys()].sort()).toEqual(['bomb', 'fire', 'shield', 'speed']);
    expect([...weights.values()].reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 10);

    const seen = new Set<PowerUpKind>();

    for (let seed = 1; seed <= 40; seed += 1) {
      const arena = generateArena(seed);
      const bricks = brickTiles({ arena, spawn: null });
      const hidden = generateHiddenPowerUps(arena, seed);

      expect(hidden).toHaveLength(Math.round(bricks * 0.55));
      expect(new Set(hidden.map((powerUp) => `${powerUp.tile.x},${powerUp.tile.y}`)).size).toBe(
        hidden.length,
      );
      expect(hidden.some((powerUp) => powerUp.kind === 'bomb')).toBe(true);
      expect(hidden.some((powerUp) => powerUp.kind === 'fire')).toBe(true);
      for (const powerUp of hidden) {
        expect(tileAt(arena, powerUp.tile.x, powerUp.tile.y)).toBe('brick');
      }
      for (const powerUp of hidden) {
        seen.add(powerUp.kind);
      }
    }

    expect([...seen].sort()).toEqual(['bomb', 'fire', 'shield', 'speed']);
  });

  it('is reproducible from the stage seed', () => {
    const arena = generateArena(777);
    expect(generateHiddenPowerUps(arena, 777)).toEqual(generateHiddenPowerUps(arena, 777));
    expect(generateHiddenPowerUps(arena, 777)).not.toEqual(generateHiddenPowerUps(arena, 778));
  });

  it('keeps ASCII fixtures deterministic and puts fixtures under their bricks', () => {
    const parsed = parseAsciiArena(ONE_BRICK);
    const hidden = generateHiddenPowerUps(parsed.arena, 5);
    expect(hidden).toHaveLength(1);
    expect(hidden[0]?.tile).toEqual({ x: 3, y: 1 });
    expect(arenaToAscii(parsed.arena)[1]).toBe('#..B..#');
  });
});

describe('power-up reveal and collection', () => {
  it('reveals a hidden power-up on the brick tile and keeps it through the blast', () => {
    const stage = stageWithPickup('fire');
    const events = explodeBrick(stage);
    const state = getStageState(stage);

    expect(state.score).toBe(BRICK_POINTS);
    expect(state.powerUps).toEqual([{ tile: { x: 3, y: 1 }, kind: 'fire' }]);
    expect(state.blasts).toHaveLength(0);
    expect(events).toContainEqual({
      type: 'power-up-revealed',
      tick: 133,
      tile: { x: 3, y: 1 },
      kind: 'fire',
    });
  });

  it('collects a revealed power-up on entry, awards points once, and applies it immediately', () => {
    const stage = stageWithPickup('fire');
    explodeBrick(stage);

    const events = collectRevealed(stage);
    const state = getStageState(stage);

    expect(state.player.tile).toEqual({ x: 3, y: 1 });
    expect(state.powerUps).toHaveLength(0);
    expect(state.blastRange).toBe(2);
    expect(state.score).toBe(BRICK_POINTS + POWER_UP_POINTS);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'power-up-collected',
        tile: { x: 3, y: 1 },
        kind: 'fire',
        points: POWER_UP_POINTS,
      }),
    );

    // Walking over the same tile again cannot award the pickup twice.
    tickMany(stage, 30, { direction: 'down' });
    tickMany(stage, 70, { direction: 'up' });
    expect(getStageState(stage).score).toBe(BRICK_POINTS + POWER_UP_POINTS);
  });

  it('applies every power-up kind to the HUD stats', () => {
    expect(revealAndCollect('bomb').bombCapacity).toBe(2);
    expect(revealAndCollect('fire').blastRange).toBe(2);
    expect(revealAndCollect('speed').speedTier).toBe(1);
    expect(revealAndCollect('shield').shieldCharges).toBe(1);
  });

  it('clamps every stat at its cap', () => {
    expect(revealAndCollect('bomb', { bombCapacity: MAX_BOMB_CAPACITY }).bombCapacity).toBe(
      MAX_BOMB_CAPACITY,
    );
    expect(revealAndCollect('fire', { blastRange: MAX_BLAST_RANGE }).blastRange).toBe(
      MAX_BLAST_RANGE,
    );
    expect(revealAndCollect('speed', { speedStacks: MAX_SPEED_STACKS }).speedTier).toBe(
      MAX_SPEED_STACKS,
    );
    expect(revealAndCollect('shield', { shieldCharges: MAX_SHIELD_CHARGES }).shieldCharges).toBe(
      MAX_SHIELD_CHARGES,
    );
  });

  it('makes speed stacks change movement timing', () => {
    const slow = createStage({ seed: 1, arena: CORRIDOR });
    const fast = createStage({ seed: 1, arena: CORRIDOR, speedStacks: 1 });

    tickMany(slow, 60, { direction: 'right' });
    tickMany(fast, 60, { direction: 'right' });

    const slowPlayer = getStageState(slow).player;
    const fastPlayer = getStageState(fast).player;

    expect(slowPlayer.speed).toBeCloseTo(BASE_MOVE_SPEED, 10);
    expect(fastPlayer.speed).toBeCloseTo(BASE_MOVE_SPEED * (1 + SPEED_STACK_BONUS), 10);
    expect(fastPlayer.position.x).toBeGreaterThan(slowPlayer.position.x);
    expect(speedForStacks(BASE_MOVE_SPEED, MAX_SPEED_STACKS)).toBeCloseTo(
      BASE_MOVE_SPEED * 1.08 ** MAX_SPEED_STACKS,
      10,
    );
  });

  it('scales all point awards by the score multiplier with consistent rounding', () => {
    const state = revealAndCollect('shield', { scoreMultiplier: 1.1 });

    // 10 * 1.1 = 11, 25 * 1.1 = 27.5 -> 28.
    expect(state.score).toBe(11 + 28);
    expect(state.shieldCharges).toBe(1);
  });
});

describe('shields', () => {
  it('absorbs one lethal blast without losing a life and grants invulnerability', () => {
    const stage = stageWithPickup('shield');
    explodeBrick(stage);
    collectRevealed(stage);

    expect(getStageState(stage).shieldCharges).toBe(1);

    const before = getStageState(stage);
    stage.tick({ bomb: true });
    tickMany(stage, 133);

    const after = getStageState(stage);
    expect(after.lives).toBe(before.lives);
    expect(after.player.alive).toBe(true);
    expect(after.shieldCharges).toBe(0);
    expect(after.player.invulnerableTicks).toBeGreaterThan(0);
    expect(after.status).toBe('playing');
  });

  it('carries shield charges into the next stage through stage options', () => {
    const stage = createStage({ seed: 3, arena: CORRIDOR, shieldCharges: 2, lives: 2 });
    const state = getStageState(stage);
    expect(state.shieldCharges).toBe(2);
    expect(state.lives).toBe(2);
  });
});
