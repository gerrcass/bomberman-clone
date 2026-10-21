import {
  buildDangerMap,
  decideRivalAction,
  RIVAL_CONTACT_RANGE,
  RIVAL_ROSTER,
  type RivalConfig,
  type RivalView,
  type RivalWorld,
  rivalBlastRangeForStage,
  rivalBombCapacityForStage,
  rivalReactionTicks,
  rivalSpeedForStage,
} from './ai';
import {
  generateArena,
  isWalkable,
  type ParsedArena,
  PLAYER_SPAWN,
  parseAsciiArena,
  RIVAL_SPAWNS,
  SPAWN_CORNERS,
  tileAt,
} from './arena';
import {
  createMovementState,
  directionDelta,
  isMoving,
  type MovementState,
  oppositeDirection,
  tickMovement,
} from './movement';
import {
  generateHiddenPowerUps,
  type HiddenPowerUp,
  MAX_BLAST_RANGE,
  MAX_BOMB_CAPACITY,
  MAX_SHIELD_CHARGES,
  MAX_SPEED_STACKS,
  POWER_UP_POINTS,
  SHIELD_INVULNERABILITY_TICKS,
  speedForStacks,
} from './powerups';
import { createRng } from './rng';
import {
  type ArenaState,
  BASE_BLAST_RANGE,
  BASE_BOMB_CAPACITY,
  BASE_FUSE_MS,
  BASE_MOVE_SPEED,
  BLAST_LIFETIME_TICKS,
  type BlastState,
  type BombState,
  BRICK_POINTS,
  type Direction,
  type Intent,
  msToTicks,
  PLAYER_BOMBER_ID,
  type PlayerState,
  type PowerUpKind,
  type PowerUpState,
  RESPAWN_DELAY_TICKS,
  RESPAWN_INVULNERABILITY_TICKS,
  RIVAL_POINTS,
  type RivalState,
  STARTING_LIVES,
  type StageEvent,
  type StageState,
  type StageStatus,
  type TileCoord,
  type TileKind,
  ticksToMs,
} from './types';

export interface StageOptions {
  readonly seed: number;
  readonly stage?: number;
  /** Optional ASCII fixture; `P` marks the player spawn. */
  readonly arena?: readonly string[];
  /** Overrides the spawn when the fixture has no `P` marker. */
  readonly playerSpawn?: TileCoord;
  /** Player bomb capacity; defaults to 1. */
  readonly bombCapacity?: number;
  /** Blast range for newly placed bombs; defaults to 1. */
  readonly blastRange?: number;
  /** Fuse duration in milliseconds; defaults to 2200. */
  readonly fuseMs?: number;
  /** Starting lives; defaults to 3. The run layer supplies this later. */
  readonly lives?: number;
  /** Carried speed power-up stacks; defaults to 0. */
  readonly speedStacks?: number;
  /** Carried shield charges; defaults to 0. */
  readonly shieldCharges?: number;
  /** Score carried into this stage; defaults to 0. */
  readonly initialScore?: number;
  /** Multiplier applied to every point award; defaults to 1. */
  readonly scoreMultiplier?: number;
  /**
   * Test/fixture override for hidden power-ups. Production stages derive a
   * seeded layout from the arena bricks. A tile without a brick is revealed
   * immediately.
   */
  readonly hiddenPowerUps?: readonly HiddenPowerUp[];
  /** Rivals to spawn; generated stages use two (three from stage 4). */
  readonly rivalCount?: number;
  /** Explicit rival spawn tiles, primarily for deterministic fixtures. */
  readonly rivalSpawns?: readonly TileCoord[];
}

/**
 * The stage seam downstream tickets extend: bombs, blasts, pickups, rivals,
 * and AI join the tick pipeline behind this interface.
 */
export interface Stage {
  /** Advances exactly one fixed 1/60 s tick and returns this tick's events. */
  tick(intent?: Intent): readonly StageEvent[];
  /** Fresh read-only snapshot; safe to hold across ticks. */
  getState(): StageState;
}

/** Convenience function form of `stage.tick`, matching the public seam. */
export function tickStage(stage: Stage, intent: Intent = {}): readonly StageEvent[] {
  return stage.tick(intent);
}

/** Convenience function form of `stage.getState`. */
export function getStageState(stage: Stage): StageState {
  return stage.getState();
}

interface MutableBomb {
  readonly id: number;
  readonly tile: TileCoord;
  readonly owner: string;
  readonly fuseTicks: number;
  fuseRemainingTicks: number;
  readonly range: number;
  readonly placedAtTick: number;
}

interface MutableBlast {
  readonly tile: TileCoord;
  remainingTicks: number;
  readonly sourceBombId: number;
}

interface MutableRival {
  readonly config: RivalConfig;
  movement: MovementState;
  alive: boolean;
  invulnerableTicks: number;
  bombCapacity: number;
  blastRange: number;
  speedTier: number;
  shieldCharges: number;
  desiredDirection: Direction | null;
  bombIntent: boolean;
  nextDecisionTick: number;
}

const BLAST_DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

export function createStage(options: StageOptions): Stage {
  const parsed = resolveArena(options);
  const spawn = resolveSpawn(options, parsed);
  if (!isWalkable(parsed.arena, spawn.x, spawn.y)) {
    throw new Error('Player spawn must be a floor tile');
  }

  const stageNumber = options.stage ?? 1;
  let bombCapacity = clampStat(options.bombCapacity ?? BASE_BOMB_CAPACITY, 1, MAX_BOMB_CAPACITY);
  let blastRange = clampStat(options.blastRange ?? BASE_BLAST_RANGE, 1, MAX_BLAST_RANGE);
  let speedTier = clampStat(options.speedStacks ?? 0, 0, MAX_SPEED_STACKS);
  let shieldCharges = clampStat(options.shieldCharges ?? 0, 0, MAX_SHIELD_CHARGES);
  const scoreMultiplier = Math.max(0, options.scoreMultiplier ?? 1);
  const fuseTicks = Math.max(1, msToTicks(options.fuseMs ?? BASE_FUSE_MS));
  const startingLives = Math.max(1, Math.floor(options.lives ?? STARTING_LIVES));

  const tiles: TileKind[] = [...parsed.arena.tiles];
  const arena: ParsedArena = {
    arena: {
      width: parsed.arena.width,
      height: parsed.arena.height,
      tiles,
    },
    spawn,
  };

  let movement = createMovementState(spawn, 'up', speedForStacks(BASE_MOVE_SPEED, speedTier));
  const bombs: MutableBomb[] = [];
  const blasts = new Map<string, MutableBlast>();
  const hiddenPowerUps = new Map<string, PowerUpKind>();
  const powerUps = new Map<string, PowerUpState>();
  const hiddenSource = options.hiddenPowerUps ?? generateHiddenPowerUps(arena.arena, options.seed);
  for (const hidden of hiddenSource) {
    const key = tileKey(hidden.tile.x, hidden.tile.y);
    if (tileAt(arena.arena, hidden.tile.x, hidden.tile.y) === 'brick') {
      hiddenPowerUps.set(key, hidden.kind);
    } else {
      powerUps.set(key, { tile: { ...hidden.tile }, kind: hidden.kind });
    }
  }
  let nextBombId = 1;

  const respawnCorners = resolveRespawnCorners(arena.arena, spawn);
  const aiRng = createRng((options.seed ^ 0x9e37_79b9) >>> 0);
  const rivals: MutableRival[] = createRivals();

  let tick = 0;
  let lives = startingLives;
  let score = Math.max(0, Math.floor(options.initialScore ?? 0));
  let status: StageStatus = 'playing';
  let playerAlive = true;
  let invulnerableTicks = 0;
  let respawnTicks = 0;
  let respawnTile: TileCoord | null = null;
  let bricksDestroyed = 0;
  let rivalsDefeated = 0;
  let powerUpsCollected = 0;

  return {
    tick(intent: Intent = {}): readonly StageEvent[] {
      if (status !== 'playing') {
        return [];
      }

      const events: StageEvent[] = [];
      tick += 1;

      // Ordered update phases. Blast tiles and invulnerability age first,
      // respawns resolve, placement runs before movement so a bomb pressed
      // mid-step lands on the tile being left while that step keeps moving,
      // and fuses/detonations/hazard checks resolve after movement.
      ageBlasts();
      if (playerAlive) {
        if (invulnerableTicks > 0) {
          invulnerableTicks -= 1;
        }
      } else {
        respawnTicks -= 1;
        if (respawnTicks <= 0) {
          respawnPlayer(events);
        }
      }

      if (playerAlive && intent.bomb === true) {
        placeBomb(events);
      }
      if (playerAlive) {
        tickMovement(movement, intent.direction ?? null, canEnter, {
          onStep: (tile, direction) => {
            events.push({ type: 'player-step', tick, tile, direction });
          },
          onReverse: (tile, direction) => {
            events.push({ type: 'player-reversed', tick, tile, direction });
          },
        });
      }

      tickRivals(events);
      resolveBombs(events);

      if (playerAlive) {
        collectPowerUps(events);
      }
      collectRivalPowerUps(events);
      checkRivalBlastHits(events);

      if (playerAlive && invulnerableTicks === 0 && blastAt(movement.to.x, movement.to.y)) {
        hitPlayer(events, 'blast');
      }
      if (playerAlive) {
        checkRivalContact(events);
      }
      if (status === 'playing' && rivals.length > 0 && rivals.every((rival) => !rival.alive)) {
        clearStage(events);
      }

      return events;
    },

    getState(): StageState {
      return {
        stage: stageNumber,
        seed: options.seed,
        tick,
        arena: {
          width: arena.arena.width,
          height: arena.arena.height,
          tiles: [...tiles],
        },
        player: snapshotPlayer(movement, playerAlive, invulnerableTicks, respawnTicks),
        lives,
        score,
        status,
        activeBombs: bombs.filter((bomb) => bomb.owner === PLAYER_BOMBER_ID).length,
        bombCapacity,
        blastRange,
        speedTier,
        shieldCharges,
        fuseMs: ticksToMs(fuseTicks),
        bombs: bombs.map(snapshotBomb),
        blasts: [...blasts.values()]
          .sort((a, b) => a.tile.y - b.tile.y || a.tile.x - b.tile.x)
          .map(snapshotBlast),
        powerUps: [...powerUps.values()]
          .sort((a, b) => a.tile.y - b.tile.y || a.tile.x - b.tile.x)
          .map((powerUp) => ({ tile: { ...powerUp.tile }, kind: powerUp.kind })),
        rivals: rivals.map(snapshotRival),
        stats: {
          bricksDestroyed,
          rivalsDefeated,
          powerUpsCollected,
        },
      };
    },
  };

  function ageBlasts(): void {
    for (const [key, blast] of blasts) {
      blast.remainingTicks -= 1;
      if (blast.remainingTicks <= 0) {
        blasts.delete(key);
      }
    }
  }

  function blastAt(x: number, y: number): boolean {
    return blasts.has(tileKey(x, y));
  }

  function hitPlayer(events: StageEvent[], cause: 'blast' | 'contact'): void {
    const tile = { ...movement.to };

    if (shieldCharges > 0) {
      shieldCharges -= 1;
      invulnerableTicks = SHIELD_INVULNERABILITY_TICKS;
      events.push({
        type: 'shield-absorbed',
        tick,
        tile: { ...tile },
        chargesRemaining: shieldCharges,
      });
      return;
    }

    lives -= 1;
    playerAlive = false;
    invulnerableTicks = 0;
    respawnTile = null;

    events.push({ type: 'player-hit', tick, tile: { ...tile }, cause });
    events.push({ type: 'life-lost', tick, livesRemaining: lives });

    if (lives <= 0) {
      // Last life: the run ends now. The stage freezes in its final state.
      status = 'gameover';
      respawnTicks = 0;
      events.push({ type: 'game-over', tick, score });
      return;
    }

    respawnTicks = RESPAWN_DELAY_TICKS;
    // Lock in the safest corner now, while the killing hazard is still live.
    // Invulnerability covers anything that changes during the delay.
    respawnTile = chooseRespawnTile();
  }

  function collectPowerUps(events: StageEvent[]): void {
    const key = tileKey(movement.to.x, movement.to.y);
    const powerUp = powerUps.get(key);
    if (powerUp === undefined) {
      return;
    }

    powerUps.delete(key);
    powerUpsCollected += 1;
    switch (powerUp.kind) {
      case 'bomb':
        bombCapacity = Math.min(MAX_BOMB_CAPACITY, bombCapacity + 1);
        break;
      case 'fire':
        blastRange = Math.min(MAX_BLAST_RANGE, blastRange + 1);
        break;
      case 'speed':
        speedTier = Math.min(MAX_SPEED_STACKS, speedTier + 1);
        movement.speed = speedForStacks(BASE_MOVE_SPEED, speedTier);
        break;
      case 'shield':
        shieldCharges = Math.min(MAX_SHIELD_CHARGES, shieldCharges + 1);
        break;
    }

    const points = award(POWER_UP_POINTS);
    events.push({
      type: 'power-up-collected',
      tick,
      tile: { ...powerUp.tile },
      kind: powerUp.kind,
      owner: PLAYER_BOMBER_ID,
      points,
    });
  }

  function collectRivalPowerUps(events: StageEvent[]): void {
    for (const rival of rivals) {
      if (!rival.alive) {
        continue;
      }
      const key = tileKey(rival.movement.to.x, rival.movement.to.y);
      const powerUp = powerUps.get(key);
      if (powerUp === undefined) {
        continue;
      }

      powerUps.delete(key);
      switch (powerUp.kind) {
        case 'bomb':
          rival.bombCapacity = Math.min(MAX_BOMB_CAPACITY, rival.bombCapacity + 1);
          break;
        case 'fire':
          rival.blastRange = Math.min(MAX_BLAST_RANGE, rival.blastRange + 1);
          break;
        case 'speed':
          rival.speedTier = Math.min(MAX_SPEED_STACKS, rival.speedTier + 1);
          rival.movement.speed = speedForStacks(rivalSpeedForStage(stageNumber), rival.speedTier);
          break;
        case 'shield':
          rival.shieldCharges = Math.min(MAX_SHIELD_CHARGES, rival.shieldCharges + 1);
          break;
      }

      events.push({
        type: 'power-up-collected',
        tick,
        tile: { ...powerUp.tile },
        kind: powerUp.kind,
        owner: rival.config.id,
        points: 0,
      });
    }
  }

  function createRivals(): MutableRival[] {
    const defaultCount = options.arena === undefined ? (stageNumber >= 4 ? 3 : 2) : 0;
    const requested = Math.max(0, Math.floor(options.rivalCount ?? defaultCount));
    const fixtureSpawns = parsed.rivalSpawns ?? [];
    const candidates =
      options.rivalSpawns ??
      (fixtureSpawns.length > 0
        ? fixtureSpawns
        : RIVAL_SPAWNS.filter(
            (corner) =>
              !(corner.x === spawn.x && corner.y === spawn.y) &&
              isWalkable(arena.arena, corner.x, corner.y),
          ));
    const created: MutableRival[] = [];

    for (let index = 0; index < Math.min(requested, candidates.length); index += 1) {
      const tile = candidates[index];
      const config = RIVAL_ROSTER[index];
      if (tile === undefined || config === undefined || !isWalkable(arena.arena, tile.x, tile.y)) {
        continue;
      }

      created.push({
        config,
        movement: createMovementState(
          { x: tile.x, y: tile.y },
          'down',
          rivalSpeedForStage(stageNumber),
        ),
        alive: true,
        invulnerableTicks: 0,
        bombCapacity: rivalBombCapacityForStage(stageNumber),
        blastRange: rivalBlastRangeForStage(stageNumber),
        speedTier: 0,
        shieldCharges: 0,
        desiredDirection: null,
        bombIntent: false,
        nextDecisionTick: rivalReactionTicks(stageNumber, config.personality),
      });
    }

    return created;
  }

  function touchesBrick(tile: TileCoord): boolean {
    return (
      tileAt(arena.arena, tile.x + 1, tile.y) === 'brick' ||
      tileAt(arena.arena, tile.x - 1, tile.y) === 'brick' ||
      tileAt(arena.arena, tile.x, tile.y + 1) === 'brick' ||
      tileAt(arena.arena, tile.x, tile.y - 1) === 'brick'
    );
  }

  function tickRivals(events: StageEvent[]): void {
    const danger = buildDangerMap(
      arena.arena,
      bombs.map(snapshotBomb),
      [...blasts.values()].map(snapshotBlast),
    );

    for (const rival of rivals) {
      if (!rival.alive) {
        continue;
      }
      if (rival.invulnerableTicks > 0) {
        rival.invulnerableTicks -= 1;
      }

      if (tick >= rival.nextDecisionTick) {
        rival.nextDecisionTick = tick + rivalReactionTicks(stageNumber, rival.config.personality);
        const decision = decideRivalAction(rivalView(rival), rivalWorld());
        rival.desiredDirection = decision.direction;
        rival.bombIntent = decision.bomb;
      }

      // Decisions are throttled by reaction time, so a newly placed bomb can
      // appear between them. Refuse the next step into danger unless the rival
      // is already inside a blast cross and must escape through it.
      const leavingDanger = danger.has(tileKey(rival.movement.from.x, rival.movement.from.y));
      const enteringDanger = danger.has(tileKey(rival.movement.to.x, rival.movement.to.y));

      // A live blast can appear under a rival's destination while it is already
      // walking there. Reverse immediately instead of finishing the step.
      if (isMoving(rival.movement) && !leavingDanger && enteringDanger) {
        rival.desiredDirection = oppositeDirection(rival.movement.direction);
        rival.bombIntent = false;
        rival.nextDecisionTick = Math.min(rival.nextDecisionTick, tick + 1);
      }

      const inDanger = leavingDanger || enteringDanger;
      if (rival.desiredDirection !== null) {
        const delta = directionDelta(rival.desiredDirection);
        const next = {
          x: rival.movement.to.x + delta.x,
          y: rival.movement.to.y + delta.y,
        };
        if (danger.has(tileKey(next.x, next.y))) {
          if (inDanger) {
            // Already inside the danger map: ask the AI for the escape route
            // again. It may need to cross another danger tile to reach safety.
            const decision = decideRivalAction(rivalView(rival), rivalWorld());
            rival.desiredDirection = decision.direction;
            rival.bombIntent = false;
            rival.nextDecisionTick = tick + 1;
          } else {
            rival.desiredDirection = null;
            rival.nextDecisionTick = Math.min(rival.nextDecisionTick, tick + 2);
          }
        }
      }

      // Stop on a safe tile beside a brick so the next decision can open the
      // maze. Without this pause, a continuously moving rival can orbit a
      // pocket forever and never get a chance to bomb.
      if (!inDanger && isMoving(rival.movement) && touchesBrick(rival.movement.to)) {
        rival.desiredDirection = null;
        rival.nextDecisionTick = Math.min(rival.nextDecisionTick, tick + 1);
      }

      if (rival.bombIntent) {
        const placed = placeRivalBomb(rival, events);
        rival.bombIntent = false;
        if (placed) {
          if (!isMoving(rival.movement)) {
            rival.desiredDirection = null;
          }
          // Re-decide almost immediately so the rival leaves its own blast.
          rival.nextDecisionTick = tick + 3;
        } else {
          // The tile filled up in the meantime. Re-evaluate instead of
          // freezing on a brick-adjacent tile with a bomb at its feet.
          rival.nextDecisionTick = tick + 1;
        }
      }

      tickMovement(rival.movement, rival.desiredDirection, canRivalEnter, {
        onStep: (tile) => {
          // Rival steps are observable for future audio/effects; the renderer
          // already consumes interpolated state.
          void tile;
        },
      });
    }
  }

  function rivalView(rival: MutableRival): RivalView {
    const moving = isMoving(rival.movement);
    return {
      id: rival.config.id,
      name: rival.config.name,
      color: rival.config.color,
      personality: rival.config.personality,
      tile: moving ? { ...rival.movement.from } : { ...rival.movement.to },
      from: { ...rival.movement.from },
      to: { ...rival.movement.to },
      moving,
      bombCapacity: rival.bombCapacity,
      blastRange: rival.blastRange,
      speedTier: rival.speedTier,
      shieldCharges: rival.shieldCharges,
      invulnerableTicks: rival.invulnerableTicks,
    };
  }

  function rivalWorld(): RivalWorld {
    return {
      arena: arena.arena,
      bombs: bombs.map(snapshotBomb),
      blasts: [...blasts.values()].map(snapshotBlast),
      powerUps: [...powerUps.values()].map((powerUp) => ({
        tile: { ...powerUp.tile },
        kind: powerUp.kind,
      })),
      rivals: rivals.filter((rival) => rival.alive).map(rivalView),
      player: playerAlive ? { ...movement.to } : null,
      playerAlive,
      tick,
      stage: stageNumber,
      rng: aiRng,
    };
  }

  function placeRivalBomb(rival: MutableRival, events: StageEvent[]): boolean {
    const active = bombs.filter((bomb) => bomb.owner === rival.config.id).length;
    if (active >= rival.bombCapacity) {
      return false;
    }

    const target = isMoving(rival.movement) ? rival.movement.from : rival.movement.to;
    if (bombAt(target.x, target.y) !== null) {
      return false;
    }

    const bomb: MutableBomb = {
      id: nextBombId,
      tile: { ...target },
      owner: rival.config.id,
      fuseTicks,
      fuseRemainingTicks: fuseTicks,
      range: rival.blastRange,
      placedAtTick: tick,
    };
    nextBombId += 1;
    bombs.push(bomb);
    events.push({
      type: 'bomb-placed',
      tick,
      bombId: bomb.id,
      tile: { ...bomb.tile },
      owner: bomb.owner,
      fuseTicks: bomb.fuseTicks,
      range: bomb.range,
    });
    return true;
  }

  function checkRivalBlastHits(events: StageEvent[]): void {
    for (const rival of rivals) {
      if (!rival.alive || rival.invulnerableTicks > 0) {
        continue;
      }
      const tile = rival.movement.to;
      if (blastAt(tile.x, tile.y)) {
        hitRival(rival, events);
      }
    }
  }

  function hitRival(rival: MutableRival, events: StageEvent[]): void {
    const tile = { ...rival.movement.to };
    if (rival.shieldCharges > 0) {
      rival.shieldCharges -= 1;
      rival.invulnerableTicks = SHIELD_INVULNERABILITY_TICKS;
      events.push({
        type: 'rival-hit',
        tick,
        rivalId: rival.config.id,
        rivalName: rival.config.name,
        tile,
        absorbed: true,
      });
      return;
    }

    rival.alive = false;
    rivalsDefeated += 1;
    const points = award(RIVAL_POINTS);
    events.push({
      type: 'rival-hit',
      tick,
      rivalId: rival.config.id,
      rivalName: rival.config.name,
      tile,
      absorbed: false,
    });
    events.push({
      type: 'rival-defeated',
      tick,
      rivalId: rival.config.id,
      rivalName: rival.config.name,
      tile,
      points,
    });
  }

  function checkRivalContact(events: StageEvent[]): void {
    if (invulnerableTicks > 0) {
      return;
    }
    const playerPosition = playerSnapshotPosition();
    for (const rival of rivals) {
      if (!rival.alive) {
        continue;
      }
      const rivalPosition = rivalSnapshotPosition(rival);
      const distance = Math.hypot(
        playerPosition.x - rivalPosition.x,
        playerPosition.y - rivalPosition.y,
      );
      if (distance <= RIVAL_CONTACT_RANGE) {
        hitPlayer(events, 'contact');
        return;
      }
    }
  }

  function playerSnapshotPosition(): { x: number; y: number } {
    return {
      x: movement.from.x + (movement.to.x - movement.from.x) * movement.progress,
      y: movement.from.y + (movement.to.y - movement.from.y) * movement.progress,
    };
  }

  function rivalSnapshotPosition(rival: MutableRival): { x: number; y: number } {
    return {
      x:
        rival.movement.from.x +
        (rival.movement.to.x - rival.movement.from.x) * rival.movement.progress,
      y:
        rival.movement.from.y +
        (rival.movement.to.y - rival.movement.from.y) * rival.movement.progress,
    };
  }

  function clearStage(events: StageEvent[]): void {
    status = 'cleared';
    respawnTicks = 0;
    respawnTile = null;
    events.push({
      type: 'stage-cleared',
      tick,
      stage: stageNumber,
      score,
      elapsedTicks: tick,
    });
  }

  function award(basePoints: number): number {
    const points = Math.round(basePoints * scoreMultiplier);
    score += points;
    return points;
  }

  function respawnPlayer(events: StageEvent[]): void {
    const tile = respawnTile ?? spawn;
    movement = createMovementState(tile, 'up', speedForStacks(BASE_MOVE_SPEED, speedTier));
    playerAlive = true;
    invulnerableTicks = RESPAWN_INVULNERABILITY_TICKS;
    respawnTicks = 0;
    respawnTile = null;

    events.push({
      type: 'respawned',
      tick,
      tile: { ...tile },
      invulnerableTicks: RESPAWN_INVULNERABILITY_TICKS,
    });
  }

  function chooseRespawnTile(): TileCoord {
    let best = respawnCorners[0] ?? spawn;
    let bestDistance = -1;

    for (const corner of respawnCorners) {
      let nearestDanger = Number.POSITIVE_INFINITY;

      for (const blast of blasts.values()) {
        nearestDanger = Math.min(nearestDanger, manhattan(corner, blast.tile));
      }
      for (const bomb of bombs) {
        nearestDanger = Math.min(nearestDanger, manhattan(corner, bomb.tile));
      }
      for (const rival of rivals) {
        if (rival.alive) {
          nearestDanger = Math.min(nearestDanger, manhattan(corner, rival.movement.to));
        }
      }

      if (nearestDanger > bestDistance) {
        bestDistance = nearestDanger;
        best = corner;
      }
    }

    return { ...best };
  }

  function canEnter(x: number, y: number): boolean {
    return isWalkable(arena.arena, x, y) && bombAt(x, y) === null;
  }

  function canRivalEnter(x: number, y: number): boolean {
    return canEnter(x, y);
  }

  function bombAt(x: number, y: number): MutableBomb | null {
    for (const bomb of bombs) {
      if (bomb.tile.x === x && bomb.tile.y === y) {
        return bomb;
      }
    }
    return null;
  }

  function placeBomb(events: StageEvent[]): void {
    const playerBombs = bombs.filter((bomb) => bomb.owner === PLAYER_BOMBER_ID).length;
    if (playerBombs >= bombCapacity) {
      return;
    }

    // Mid-step bombs land on the tile being left, never the destination, so
    // they cannot block the step that is already in progress.
    const target = isMoving(movement) ? movement.from : movement.to;
    if (bombAt(target.x, target.y) !== null) {
      return;
    }

    const bomb: MutableBomb = {
      id: nextBombId,
      tile: { ...target },
      owner: PLAYER_BOMBER_ID,
      fuseTicks,
      fuseRemainingTicks: fuseTicks,
      range: blastRange,
      placedAtTick: tick,
    };
    nextBombId += 1;
    bombs.push(bomb);

    events.push({
      type: 'bomb-placed',
      tick,
      bombId: bomb.id,
      tile: { ...bomb.tile },
      owner: bomb.owner,
      fuseTicks: bomb.fuseTicks,
      range: bomb.range,
    });
  }

  /**
   * Ages every existing fuse, then resolves all detonations for this tick.
   * Bombs whose fuses expire seed a FIFO queue; bombs reached by a blast join
   * the same queue, so chain reactions resolve before the tick ends.
   */
  function resolveBombs(events: StageEvent[]): void {
    const due: MutableBomb[] = [];
    for (const bomb of bombs) {
      if (bomb.placedAtTick === tick) {
        continue;
      }
      bomb.fuseRemainingTicks -= 1;
      if (bomb.fuseRemainingTicks <= 0) {
        due.push(bomb);
      }
    }
    if (due.length === 0) {
      return;
    }

    due.sort((a, b) => a.id - b.id);
    const dueIds = new Set(due.map((bomb) => bomb.id));
    const queue = [...due];
    const queuedIds = new Set(dueIds);
    const detonatedIds = new Set<number>();

    while (queue.length > 0) {
      const bomb = queue.shift();
      if (bomb === undefined || detonatedIds.has(bomb.id)) {
        continue;
      }
      detonatedIds.add(bomb.id);
      removeBomb(bomb.id);

      events.push({
        type: 'bomb-detonated',
        tick,
        bombId: bomb.id,
        tile: { ...bomb.tile },
        owner: bomb.owner,
        range: bomb.range,
        chain: !dueIds.has(bomb.id),
      });

      const blastTiles: TileCoord[] = [];
      addBlastTile(blastTiles, bomb.id, bomb.tile.x, bomb.tile.y);

      for (const direction of BLAST_DIRECTIONS) {
        const delta = directionDelta(direction);
        for (let step = 1; step <= bomb.range; step += 1) {
          const x = bomb.tile.x + delta.x * step;
          const y = bomb.tile.y + delta.y * step;
          const kind = tileAt(arena.arena, x, y);

          if (kind === 'wall') {
            break;
          }

          addBlastTile(blastTiles, bomb.id, x, y);

          if (kind === 'brick') {
            destroyBrick(x, y, events);
            break;
          }

          const linked = bombAt(x, y);
          if (linked !== null && !detonatedIds.has(linked.id) && !queuedIds.has(linked.id)) {
            queue.push(linked);
            queuedIds.add(linked.id);
          }
        }
      }

      events.push({ type: 'blast-started', tick, bombId: bomb.id, tiles: blastTiles });
    }
  }

  function removeBomb(id: number): void {
    const index = bombs.findIndex((bomb) => bomb.id === id);
    if (index !== -1) {
      bombs.splice(index, 1);
    }
  }

  function addBlastTile(blastTiles: TileCoord[], sourceBombId: number, x: number, y: number): void {
    blastTiles.push({ x, y });
    const key = tileKey(x, y);
    const existing = blasts.get(key);
    if (existing === undefined) {
      blasts.set(key, {
        tile: { x, y },
        remainingTicks: BLAST_LIFETIME_TICKS,
        sourceBombId,
      });
    } else {
      // Overlapping blasts share one tile and refresh to a full lifetime.
      existing.remainingTicks = Math.max(existing.remainingTicks, BLAST_LIFETIME_TICKS);
    }
  }

  function destroyBrick(x: number, y: number, events: StageEvent[]): void {
    const index = y * arena.arena.width + x;
    if (tiles[index] !== 'brick') {
      return;
    }

    tiles[index] = 'floor';
    bricksDestroyed += 1;
    const points = award(BRICK_POINTS);
    events.push({ type: 'brick-destroyed', tick, tile: { x, y }, points });

    const key = tileKey(x, y);
    const hidden = hiddenPowerUps.get(key);
    if (hidden !== undefined) {
      hiddenPowerUps.delete(key);
      powerUps.set(key, { tile: { x, y }, kind: hidden });
      events.push({ type: 'power-up-revealed', tick, tile: { x, y }, kind: hidden });
    }
  }
}

function resolveArena(options: StageOptions): ParsedArena {
  if (options.arena !== undefined) {
    return parseAsciiArena(options.arena);
  }
  return { arena: generateArena(options.seed), spawn: null };
}

function resolveSpawn(options: StageOptions, parsed: ParsedArena): TileCoord {
  const declared = parsed.spawn ?? options.playerSpawn;
  if (declared !== undefined) {
    return declared;
  }

  if (parsed.arena.width === 15 && parsed.arena.height === 13) {
    return { ...PLAYER_SPAWN };
  }

  return { x: 1, y: parsed.arena.height - 2 };
}

/**
 * Spawn corners in canonical order: the player corner (bottom-left) first,
 * then the rival corners. Generated arenas use the spec's fixed corners;
 * fixtures derive corners from their bounds. Non-walkable corners are skipped.
 */
function resolveRespawnCorners(arena: ArenaState, fallback: TileCoord): readonly TileCoord[] {
  const candidates: readonly TileCoord[] =
    arena.width === 15 && arena.height === 13
      ? SPAWN_CORNERS
      : [
          { x: 1, y: arena.height - 2 },
          { x: 1, y: 1 },
          { x: arena.width - 2, y: 1 },
          { x: arena.width - 2, y: arena.height - 2 },
        ];

  const unique: TileCoord[] = [];
  for (const corner of candidates) {
    if (
      isWalkable(arena, corner.x, corner.y) &&
      !unique.some((tile) => tile.x === corner.x && tile.y === corner.y)
    ) {
      unique.push({ ...corner });
    }
  }

  return unique.length > 0 ? unique : [{ ...fallback }];
}

function manhattan(a: TileCoord, b: TileCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function snapshotPlayer(
  movement: MovementState,
  alive: boolean,
  invulnerableTicks: number,
  respawnTicks: number,
): PlayerState {
  const moving = movement.from.x !== movement.to.x || movement.from.y !== movement.to.y;
  const tile = moving ? movement.from : movement.to;

  return {
    tile: { ...tile },
    from: { ...movement.from },
    to: { ...movement.to },
    progress: movement.progress,
    position: {
      x: movement.from.x + (movement.to.x - movement.from.x) * movement.progress,
      y: movement.from.y + (movement.to.y - movement.from.y) * movement.progress,
    },
    direction: movement.direction,
    moving,
    speed: movement.speed,
    alive,
    invulnerableTicks,
    respawnTicks,
  };
}

function snapshotRival(rival: MutableRival): RivalState {
  const moving = isMoving(rival.movement);
  return {
    id: rival.config.id,
    name: rival.config.name,
    color: rival.config.color,
    personality: rival.config.personality,
    tile: moving ? { ...rival.movement.from } : { ...rival.movement.to },
    from: { ...rival.movement.from },
    to: { ...rival.movement.to },
    progress: rival.movement.progress,
    position: {
      x:
        rival.movement.from.x +
        (rival.movement.to.x - rival.movement.from.x) * rival.movement.progress,
      y:
        rival.movement.from.y +
        (rival.movement.to.y - rival.movement.from.y) * rival.movement.progress,
    },
    direction: rival.movement.direction,
    moving,
    alive: rival.alive,
    bombCapacity: rival.bombCapacity,
    blastRange: rival.blastRange,
    speedTier: rival.speedTier,
    shieldCharges: rival.shieldCharges,
    invulnerableTicks: rival.invulnerableTicks,
  };
}

function snapshotBomb(bomb: MutableBomb): BombState {
  return {
    id: bomb.id,
    tile: { ...bomb.tile },
    owner: bomb.owner,
    fuseTicks: bomb.fuseTicks,
    fuseRemainingTicks: bomb.fuseRemainingTicks,
    fuseRemainingMs: ticksToMs(bomb.fuseRemainingTicks),
    range: bomb.range,
  };
}

function snapshotBlast(blast: MutableBlast): BlastState {
  return {
    tile: { ...blast.tile },
    remainingTicks: blast.remainingTicks,
    remainingMs: ticksToMs(blast.remainingTicks),
    sourceBombId: blast.sourceBombId,
  };
}

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

function clampStat(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  return Math.max(minimum, Math.min(maximum, Math.floor(value)));
}
