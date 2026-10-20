import { type Direction, type StageState, TILE_SIZE } from '../game';
import { createSprites, type SpriteSet } from './sprites';

export interface ArenaRenderer {
  /** Draws one frame from read-only simulation state. */
  render(state: StageState): void;
}

const BACKGROUND = '#070b13';

const DIRECTION_PIP: Readonly<Record<Direction, { x: number; y: number }>> = {
  up: { x: 0, y: -19 },
  down: { x: 0, y: 19 },
  left: { x: -19, y: 0 },
  right: { x: 19, y: 0 },
};

export function createArenaRenderer(canvas: HTMLCanvasElement): ArenaRenderer {
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Canvas 2D is unavailable');
  }

  const sprites = createSprites();
  context.imageSmoothingEnabled = false;

  return {
    render(state: StageState): void {
      context.imageSmoothingEnabled = false;
      context.fillStyle = BACKGROUND;
      context.fillRect(0, 0, canvas.width, canvas.height);

      drawTerrain(context, state, sprites);
      drawPlayer(context, state, sprites);
    },
  };
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

function drawPlayer(
  context: CanvasRenderingContext2D,
  state: StageState,
  sprites: SpriteSet,
): void {
  const { player, tick } = state;
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

  context.drawImage(frame, pixelX, pixelY, TILE_SIZE, TILE_SIZE);

  const pip = DIRECTION_PIP[player.direction];
  context.fillStyle = '#eaffff';
  context.fillRect(
    Math.round(pixelX + TILE_SIZE / 2 + pip.x) - 2,
    Math.round(pixelY + TILE_SIZE / 2 + pip.y) - 2,
    4,
    4,
  );
}
