import { type Direction, type StageEvent, type StageState, TILE_SIZE } from '../game';
import { createSprites, type SpriteSet } from './sprites';

export interface ArenaRenderer {
  /** Draws one frame from read-only simulation state and this frame's events. */
  render(state: StageState, events?: readonly StageEvent[]): void;
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

  return {
    render(state: StageState, events: readonly StageEvent[] = []): void {
      if (state.tick === 0) {
        particles = [];
      }
      spawnBrickParticles(events, particles);
      particles = particles.filter((particle) => state.tick - particle.bornTick < PARTICLE_TICKS);

      context.imageSmoothingEnabled = false;
      context.globalAlpha = 1;
      context.fillStyle = BACKGROUND;
      context.fillRect(0, 0, canvas.width, canvas.height);

      drawTerrain(context, state, sprites);
      drawBombs(context, state, sprites);
      drawBlasts(context, state, sprites);
      drawBrickParticles(context, state, particles);
      drawPlayer(context, state, sprites);
    },
  };
}

function spawnBrickParticles(events: readonly StageEvent[], particles: BrickParticle[]): void {
  for (const event of events) {
    if (event.type !== 'brick-destroyed') {
      continue;
    }

    const seed = event.tile.x * 17 + event.tile.y * 31;
    for (let index = 0; index < BRICK_PARTICLES; index += 1) {
      const angle = (index / BRICK_PARTICLES) * Math.PI * 2 + (seed % 9) * 0.17;
      const speed = 0.9 + ((seed + index * 7) % 5) * 0.35;
      particles.push({
        x: event.tile.x * TILE_SIZE + TILE_SIZE / 2,
        y: event.tile.y * TILE_SIZE + TILE_SIZE / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        bornTick: event.tick,
        color: index % 2 === 0 ? '#cf7147' : '#8b4324',
      });
    }
  }

  // The renderer only consumes events; this guard keeps stale particles from
  // a previous stage from leaking into a fresh state.
  if (particles.length > 200) {
    particles.splice(0, particles.length - 200);
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

function drawBombs(context: CanvasRenderingContext2D, state: StageState, sprites: SpriteSet): void {
  for (const bomb of state.bombs) {
    const centerX = bomb.tile.x * TILE_SIZE + TILE_SIZE / 2;
    const centerY = bomb.tile.y * TILE_SIZE + TILE_SIZE / 2;
    const elapsed = bomb.fuseTicks - bomb.fuseRemainingTicks;
    const pulse = 1 + Math.sin((elapsed + bomb.id * 3) * 0.42) * 0.055;
    const size = TILE_SIZE * pulse;

    if (bomb.fuseRemainingTicks <= 30 && Math.floor(state.tick / 4) % 2 === 0) {
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
): void {
  for (const blast of state.blasts) {
    const pixelX = blast.tile.x * TILE_SIZE;
    const pixelY = blast.tile.y * TILE_SIZE;
    const flicker =
      0.84 + 0.16 * Math.sin((state.tick + blast.tile.x * 5 + blast.tile.y * 7) * 0.8);

    context.globalAlpha = 0.24 * flicker;
    context.fillStyle = '#ff7a2f';
    context.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);
    context.globalAlpha = flicker;
    context.drawImage(sprites.blast, pixelX, pixelY, TILE_SIZE, TILE_SIZE);
  }

  context.globalAlpha = 1;
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
