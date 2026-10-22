import {
  type Direction,
  type PowerUpKind,
  type RivalState,
  type StageEvent,
  type StageState,
  TILE_SIZE,
} from '../game';
import { createSprites, type SpriteSet } from './sprites';

export interface RenderPreferences {
  readonly screenShake: boolean;
  readonly reducedMotion: boolean;
  readonly highContrast: boolean;
}

export interface ArenaRenderer {
  /** Draws one frame from read-only simulation state and this frame's events. */
  render(state: StageState, events?: readonly StageEvent[]): void;
  setPreferences(preferences: RenderPreferences): void;
}

const BACKGROUND = '#070b13';

const PARTICLE_TICKS = 18;
const BRICK_PARTICLES = 7;

const DIRECTION_PIP: Readonly<Record<Direction, { x: number; y: number }>> = {
  up: { x: 0, y: -19 },
  down: { x: 0, y: 19 },
  left: { x: -19, y: 0 },
  right: { x: 19, y: 0 },
};

interface BrickParticle {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly bornTick: number;
  readonly color: string;
}

export function createArenaRenderer(canvas: HTMLCanvasElement): ArenaRenderer {
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Canvas 2D is unavailable');
  }

  const sprites = createSprites();
  context.imageSmoothingEnabled = false;

  let particles: BrickParticle[] = [];
  let preferences: RenderPreferences = {
    screenShake: true,
    reducedMotion: false,
    highContrast: false,
  };
  let shakeUntilTick = 0;

  return {
    setPreferences(next: RenderPreferences): void {
      preferences = next;
    },
    render(state: StageState, events: readonly StageEvent[] = []): void {
      if (state.tick === 0) {
        particles = [];
        shakeUntilTick = 0;
      }
      for (const event of events) {
        if (event.type === 'bomb-detonated' || event.type === 'player-hit') {
          shakeUntilTick = Math.max(shakeUntilTick, event.tick + 13);
        }
      }
      spawnParticles(events, particles, preferences.reducedMotion);
      particles = particles.filter((particle) => state.tick - particle.bornTick < PARTICLE_TICKS);

      context.imageSmoothingEnabled = false;
      context.globalAlpha = 1;
      context.fillStyle = BACKGROUND;
      context.fillRect(0, 0, canvas.width, canvas.height);

      const shaking =
        preferences.screenShake && !preferences.reducedMotion && state.tick < shakeUntilTick;
      if (shaking) {
        const strength = 3;
        context.save();
        context.translate(
          Math.sin(state.tick * 2.7) * strength,
          Math.cos(state.tick * 3.4) * strength * 0.7,
        );
      }

      drawTerrain(context, state, sprites);
      if (preferences.highContrast) {
        drawHighContrastTerrain(context, state);
      }
      drawBombs(context, state, sprites, preferences.reducedMotion);
      drawBlasts(context, state, sprites, preferences.reducedMotion);
      drawPowerUps(context, state, sprites, preferences.reducedMotion);
      drawBrickParticles(context, state, particles);
      drawRivals(context, state, sprites);
      drawPlayer(context, state, sprites);
      if (preferences.highContrast) {
        drawHighContrastHazards(context, state);
      }

      if (shaking) {
        context.restore();
      }
    },
  };
}

function spawnParticles(
  events: readonly StageEvent[],
  particles: BrickParticle[],
  reducedMotion: boolean,
): void {
  if (reducedMotion) {
    return;
  }

  for (const event of events) {
    if (event.type === 'brick-destroyed') {
      spawnBurst(particles, event.tile, event.tick, BRICK_PARTICLES, '#cf7147', '#8b4324');
      continue;
    }
    if (event.type === 'player-hit') {
      spawnBurst(particles, event.tile, event.tick, 12, '#ff6b6b', '#ffd166');
      continue;
    }
    if (event.type === 'rival-defeated') {
      spawnBurst(particles, event.tile, event.tick, 14, '#b07cff', '#ffd166');
      continue;
    }
    if (event.type === 'stage-cleared') {
      // A short centre-arena flash; the stage overlay carries the detail.
      const centre = { x: Math.floor((events.length % 15) + 7), y: 6 };
      spawnBurst(particles, centre, event.tick, 20, '#ffd166', '#3fe0e6');
    }
  }

  // The renderer only consumes events; this guard keeps stale particles from
  // a previous stage from leaking into a fresh state.
  if (particles.length > 240) {
    particles.splice(0, particles.length - 240);
  }
}

function spawnBurst(
  particles: BrickParticle[],
  tile: { readonly x: number; readonly y: number },
  tick: number,
  count: number,
  colorA: string,
  colorB: string,
): void {
  const seed = tile.x * 17 + tile.y * 31;
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 + (seed % 9) * 0.17;
    const speed = 0.9 + ((seed + index * 7) % 5) * 0.35;
    particles.push({
      x: tile.x * TILE_SIZE + TILE_SIZE / 2,
      y: tile.y * TILE_SIZE + TILE_SIZE / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.2,
      bornTick: tick,
      color: index % 2 === 0 ? colorA : colorB,
    });
  }
}

function drawTerrain(
  context: CanvasRenderingContext2D,
  state: StageState,
  sprites: SpriteSet,
): void {
  const { arena } = state;

  for (let y = 0; y < arena.height; y += 1) {
    for (let x = 0; x < arena.width; x += 1) {
      const kind = arena.tiles[y * arena.width + x] ?? 'wall';
      const sprite =
        kind === 'wall' ? sprites.wall : kind === 'brick' ? sprites.brick : sprites.floor;
      context.drawImage(sprite, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
}

function drawHighContrastTerrain(context: CanvasRenderingContext2D, state: StageState): void {
  const { arena } = state;
  for (let y = 0; y < arena.height; y += 1) {
    for (let x = 0; x < arena.width; x += 1) {
      const kind = arena.tiles[y * arena.width + x] ?? 'wall';
      if (kind === 'floor') {
        continue;
      }
      context.strokeStyle = kind === 'wall' ? '#b9ecff' : '#ffd166';
      context.lineWidth = kind === 'wall' ? 2 : 1.5;
      context.strokeRect(x * TILE_SIZE + 1, y * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    }
  }
}

function drawHighContrastHazards(context: CanvasRenderingContext2D, state: StageState): void {
  for (const blast of state.blasts) {
    // Piercing tiles get a cyan, heavier outline so they stay distinct from a
    // classic white hazard without relying on the tint underneath.
    context.strokeStyle = blast.piercing ? '#7df9ff' : '#ffffff';
    context.lineWidth = blast.piercing ? 3 : 2;
    context.strokeRect(
      blast.tile.x * TILE_SIZE + 2,
      blast.tile.y * TILE_SIZE + 2,
      TILE_SIZE - 4,
      TILE_SIZE - 4,
    );
    if (blast.piercing) {
      // A second, inset frame makes the marker a shape cue as well as a colour
      // cue, so it survives forced-colours and low-vision viewing.
      context.lineWidth = 1.5;
      context.strokeRect(
        blast.tile.x * TILE_SIZE + 8,
        blast.tile.y * TILE_SIZE + 8,
        TILE_SIZE - 16,
        TILE_SIZE - 16,
      );
    }
  }
  context.strokeStyle = '#ffffff';
  context.lineWidth = 2;
  for (const powerUp of state.powerUps) {
    context.strokeRect(
      powerUp.tile.x * TILE_SIZE + 5,
      powerUp.tile.y * TILE_SIZE + 5,
      TILE_SIZE - 10,
      TILE_SIZE - 10,
    );
  }
  for (const bomb of state.bombs) {
    const inset = TILE_SIZE * 0.18;
    context.strokeRect(
      bomb.position.x * TILE_SIZE + inset,
      bomb.position.y * TILE_SIZE + inset,
      TILE_SIZE - inset * 2,
      TILE_SIZE - inset * 2,
    );
  }
}

function drawBombs(
  context: CanvasRenderingContext2D,
  state: StageState,
  sprites: SpriteSet,
  reducedMotion: boolean,
): void {
  for (const bomb of state.bombs) {
    // Interpolation is the slide itself, so Reduced Motion never freezes it.
    const centerX = bomb.position.x * TILE_SIZE + TILE_SIZE / 2;
    const centerY = bomb.position.y * TILE_SIZE + TILE_SIZE / 2;
    const elapsed = bomb.fuseTicks - bomb.fuseRemainingTicks;
    const pulse = reducedMotion ? 1 : 1 + Math.sin((elapsed + bomb.id * 3) * 0.42) * 0.055;
    const size = TILE_SIZE * pulse;

    if (!reducedMotion && bomb.fuseRemainingTicks <= 30 && Math.floor(state.tick / 4) % 2 === 0) {
      context.globalAlpha = 0.32;
      context.fillStyle = '#ff6b6b';
      context.beginPath();
      context.arc(centerX, centerY, TILE_SIZE * 0.44, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }

    context.drawImage(
      sprites.bomb,
      Math.round(centerX - size / 2),
      Math.round(centerY - size / 2),
      Math.round(size),
      Math.round(size),
    );
  }
}

function drawBlasts(
  context: CanvasRenderingContext2D,
  state: StageState,
  sprites: SpriteSet,
  reducedMotion: boolean,
): void {
  for (const blast of state.blasts) {
    const pixelX = blast.tile.x * TILE_SIZE;
    const pixelY = blast.tile.y * TILE_SIZE;
    const flicker = reducedMotion
      ? 1
      : 0.84 + 0.16 * Math.sin((state.tick + blast.tile.x * 5 + blast.tile.y * 7) * 0.8);

    context.globalAlpha = 0.24 * flicker;
    context.fillStyle = blast.piercing ? '#2fd6e6' : '#ff7a2f';
    context.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);
    context.globalAlpha = flicker;
    const frame = Math.floor((state.tick + blast.tile.x * 3 + blast.tile.y * 5) / 3) % 3;
    const sprite = frame === 0 ? sprites.blast : frame === 1 ? sprites.blastB : sprites.blastC;
    context.drawImage(sprite, pixelX, pixelY, TILE_SIZE, TILE_SIZE);

    if (blast.piercing) {
      // A static cyan core distinguishes the longer ray in both motion modes.
      const inset = TILE_SIZE * 0.3;
      context.globalAlpha = 0.55;
      context.fillStyle = '#b9fbff';
      context.fillRect(
        pixelX + inset,
        pixelY + inset,
        TILE_SIZE - inset * 2,
        TILE_SIZE - inset * 2,
      );
    }
  }

  context.globalAlpha = 1;
}

function drawPowerUps(
  context: CanvasRenderingContext2D,
  state: StageState,
  sprites: SpriteSet,
  reducedMotion: boolean,
): void {
  for (const powerUp of state.powerUps) {
    const sprite = powerUpSprite(sprites, powerUp.kind);
    const bob = reducedMotion
      ? 0
      : Math.sin((state.tick + powerUp.tile.x * 7 + powerUp.tile.y * 13) / 14) * 2;
    const pixelX = powerUp.tile.x * TILE_SIZE;
    const pixelY = powerUp.tile.y * TILE_SIZE;
    const inset = TILE_SIZE * 0.14;

    context.globalAlpha = 0.18;
    context.fillStyle = '#eaffff';
    context.fillRect(pixelX + inset, pixelY + inset, TILE_SIZE - inset * 2, TILE_SIZE - inset * 2);
    context.globalAlpha = 1;
    context.drawImage(
      sprite,
      Math.round(pixelX + inset),
      Math.round(pixelY + inset + bob),
      Math.round(TILE_SIZE - inset * 2),
      Math.round(TILE_SIZE - inset * 2),
    );
  }
}

function powerUpSprite(sprites: SpriteSet, kind: PowerUpKind): HTMLCanvasElement {
  switch (kind) {
    case 'bomb':
      return sprites.powerUpBomb;
    case 'fire':
      return sprites.powerUpFire;
    case 'speed':
      return sprites.powerUpSpeed;
    case 'shield':
      return sprites.powerUpShield;
  }
}

function drawBrickParticles(
  context: CanvasRenderingContext2D,
  state: StageState,
  particles: readonly BrickParticle[],
): void {
  for (const particle of particles) {
    const age = state.tick - particle.bornTick;
    context.globalAlpha = Math.max(0, 1 - age / PARTICLE_TICKS);
    context.fillStyle = particle.color;
    context.fillRect(
      Math.round(particle.x + particle.vx * age),
      Math.round(particle.y + particle.vy * age + 0.28 * age * age),
      age < 8 ? 4 : 3,
      age < 8 ? 4 : 3,
    );
  }

  context.globalAlpha = 1;
}

function drawRivals(
  context: CanvasRenderingContext2D,
  state: StageState,
  sprites: SpriteSet,
): void {
  for (const rival of state.rivals) {
    if (rival.alive) {
      drawRival(context, state, sprites, rival);
    }
  }
}

function drawRival(
  context: CanvasRenderingContext2D,
  state: StageState,
  sprites: SpriteSet,
  rival: RivalState,
): void {
  const frames = sprites.rivals[rival.id];
  if (frames === undefined) {
    return;
  }

  const pixelX = Math.round(rival.position.x * TILE_SIZE);
  const pixelY = Math.round(rival.position.y * TILE_SIZE);
  const frame = rival.moving
    ? Math.floor(state.tick / 6) % 2 === 0
      ? frames.walkA
      : frames.walkB
    : frames.idle;

  context.save();
  context.fillStyle = 'rgba(0, 0, 0, 0.35)';
  context.beginPath();
  context.ellipse(pixelX + TILE_SIZE / 2, pixelY + TILE_SIZE - 7, 13, 5, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  if (rival.invulnerableTicks > 0 && Math.floor(state.tick / 4) % 2 === 0) {
    context.globalAlpha = 0.5;
  }
  context.drawImage(frame, pixelX, pixelY, TILE_SIZE, TILE_SIZE);
  context.globalAlpha = 1;

  context.save();
  context.font = 'bold 10px "Courier New", ui-monospace, monospace';
  context.textAlign = 'center';
  context.textBaseline = 'bottom';
  context.fillStyle = '#05070d';
  context.fillText(rival.name.toUpperCase(), pixelX + TILE_SIZE / 2 + 1, pixelY - 1 + 1);
  context.fillStyle = rival.color;
  context.fillText(rival.name.toUpperCase(), pixelX + TILE_SIZE / 2, pixelY - 1);
  context.restore();
}

function drawPlayer(
  context: CanvasRenderingContext2D,
  state: StageState,
  sprites: SpriteSet,
): void {
  const { player, tick } = state;
  if (!player.alive) {
    return;
  }

  const pixelX = Math.round(player.position.x * TILE_SIZE);
  const pixelY = Math.round(player.position.y * TILE_SIZE);
  const frame = player.moving
    ? Math.floor(tick / 6) % 2 === 0
      ? sprites.playerWalkA
      : sprites.playerWalkB
    : sprites.playerIdle;

  context.save();
  context.fillStyle = 'rgba(0, 0, 0, 0.35)';
  context.beginPath();
  context.ellipse(pixelX + TILE_SIZE / 2, pixelY + TILE_SIZE - 7, 13, 5, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  if (player.invulnerableTicks > 0 && Math.floor(tick / 4) % 2 === 0) {
    context.globalAlpha = 0.45;
  }

  context.drawImage(frame, pixelX, pixelY, TILE_SIZE, TILE_SIZE);

  const pip = DIRECTION_PIP[player.direction];
  context.fillStyle = '#eaffff';
  context.fillRect(
    Math.round(pixelX + TILE_SIZE / 2 + pip.x) - 2,
    Math.round(pixelY + TILE_SIZE / 2 + pip.y) - 2,
    4,
    4,
  );
  context.globalAlpha = 1;
}
