/** Runtime-generated pixel-art sprites. No external image assets. */

import type { StageThemeId } from '../game/themes';
import { TERRAIN_PALETTES, type TerrainPalette } from './theme-palettes';

const MATRIX_SIZE = 16;
const SPRITE_SCALE = 3;

type Palette = Readonly<Record<string, string>>;

const PLAYER_IDLE = [
  '................',
  '.....000000.....',
  '....01111110....',
  '...0122222210...',
  '...0123223210...',
  '...0122222210...',
  '...0122222210...',
  '...0122222210...',
  '...0112222110...',
  '...0111111110...',
  '....01111110....',
  '....01111110....',
  '.....01..10.....',
  '.....01..10.....',
  '....000..000....',
  '................',
] as const;

const PLAYER_WALK_A = [
  '................',
  '.....000000.....',
  '....01111110....',
  '...0122222210...',
  '...0123223210...',
  '...0122222210...',
  '...0122222210...',
  '...0122222210...',
  '...0112222110...',
  '...0111111110...',
  '....01111110....',
  '....01111110....',
  '.....01..10.....',
  '....01....10....',
  '...000....000...',
  '................',
] as const;

const PLAYER_WALK_B = [
  '................',
  '.....000000.....',
  '....01111110....',
  '...0122222210...',
  '...0123223210...',
  '...0122222210...',
  '...0122222210...',
  '...0122222210...',
  '...0112222110...',
  '...0111111110...',
  '....01111110....',
  '....01111110....',
  '.....01..10.....',
  '...01......10...',
  '..000......000..',
  '................',
] as const;

const PLAYER_PALETTE: Palette = {
  '0': '#06232b',
  '1': '#128e9b',
  '2': '#3fe0e6',
  '3': '#eaffff',
};

const CINDER_PALETTE: Palette = {
  '0': '#2b0606',
  '1': '#8e1b1b',
  '2': '#ff5c5c',
  '3': '#ffe0e0',
};

const SPARK_PALETTE: Palette = {
  '0': '#2b1d05',
  '1': '#a86b10',
  '2': '#ffb347',
  '3': '#fff2cf',
};

const VEX_PALETTE: Palette = {
  '0': '#1b0b2b',
  '1': '#5b2b8e',
  '2': '#b07cff',
  '3': '#efe2ff',
};

const RIVAL_PALETTES: Readonly<Record<string, Palette>> = {
  cinder: CINDER_PALETTE,
  spark: SPARK_PALETTE,
  vex: VEX_PALETTE,
};

export interface BomberSprites {
  readonly idle: HTMLCanvasElement;
  readonly walkA: HTMLCanvasElement;
  readonly walkB: HTMLCanvasElement;
}

const BOMB = [
  '................',
  '.......4........',
  '......44........',
  '.....44.........',
  '....00000000....',
  '...0111111110...',
  '..011222221110..',
  '..012222222210..',
  '..012223322210..',
  '..012223322210..',
  '..012222222210..',
  '..011222221110..',
  '...0111111110...',
  '....00000000....',
  '................',
  '................',
] as const;

const BOMB_PALETTE: Palette = {
  '0': '#090c14',
  '1': '#1d2438',
  '2': '#4b5878',
  '3': '#a7bce6',
  '4': '#ffd166',
};

const BLAST = [
  '................',
  '.......43.......',
  '......4334......',
  '.....433334.....',
  '..4..433334..4..',
  '.44344333344434.',
  '..433333333334..',
  '...4333333334...',
  '...4333333334...',
  '..433333333334..',
  '.44344333344434.',
  '..4..433334..4..',
  '.....433334.....',
  '......4334......',
  '.......43.......',
  '................',
] as const;

const BLAST_PALETTE: Palette = {
  '3': '#ff7a2f',
  '4': '#ffe27a',
};

const BLAST_B_PALETTE: Palette = {
  '3': '#ffb347',
  '4': '#ffffff',
};

const BLAST_C_PALETTE: Palette = {
  '3': '#ff6b6b',
  '4': '#ffe27a',
};

const POWERUP_BOMB = [
  '................',
  '................',
  '.......4........',
  '......444.......',
  '....00000000....',
  '...0111111110...',
  '..011222221110..',
  '..012223322210..',
  '..012223322210..',
  '..012222222210..',
  '..011222221110..',
  '...0111111110...',
  '....00000000....',
  '................',
  '................',
  '................',
] as const;

const POWERUP_BOMB_PALETTE: Palette = {
  '0': '#131a2a',
  '1': '#d59b24',
  '2': '#ffd166',
  '3': '#eaffff',
  '4': '#ff7a2f',
};

const POWERUP_FIRE = [
  '................',
  '................',
  '.......4........',
  '......443.......',
  '.....44334......',
  '....4433334.....',
  '....4333334.....',
  '...443333334....',
  '...433333344....',
  '....4333334.....',
  '.....43334......',
  '......434.......',
  '.......4........',
  '................',
  '................',
  '................',
] as const;

const POWERUP_FIRE_PALETTE: Palette = {
  '3': '#ff7a2f',
  '4': '#ffe27a',
};

const POWERUP_SPEED = [
  '................',
  '................',
  '........333.....',
  '.......333......',
  '......333.......',
  '.....333........',
  '....33333333....',
  '...333333333....',
  '........333.....',
  '.......333......',
  '......333.......',
  '.....333........',
  '....33..........',
  '................',
  '................',
  '................',
] as const;

const POWERUP_SPEED_PALETTE: Palette = {
  '3': '#3fe0e6',
};

const POWERUP_SHIELD = [
  '................',
  '................',
  '....33333333....',
  '...3333333333...',
  '..333333333333..',
  '..333333333333..',
  '..333333333333..',
  '..333333333333..',
  '...3333333333...',
  '...3333333333...',
  '....33333333....',
  '.....333333.....',
  '......3333......',
  '.......33.......',
  '................',
  '................',
] as const;

const POWERUP_SHIELD_PALETTE: Palette = {
  '3': '#7aa7ff',
};

export interface TerrainSprites {
  readonly floor: HTMLCanvasElement;
  readonly wall: HTMLCanvasElement;
  readonly brick: HTMLCanvasElement;
}

export interface SpriteSet {
  readonly terrain: Readonly<Record<StageThemeId, TerrainSprites>>;
  readonly bomb: HTMLCanvasElement;
  readonly blast: HTMLCanvasElement;
  readonly blastB: HTMLCanvasElement;
  readonly blastC: HTMLCanvasElement;
  readonly powerUpBomb: HTMLCanvasElement;
  readonly powerUpFire: HTMLCanvasElement;
  readonly powerUpSpeed: HTMLCanvasElement;
  readonly powerUpShield: HTMLCanvasElement;
  readonly playerIdle: HTMLCanvasElement;
  readonly playerWalkA: HTMLCanvasElement;
  readonly playerWalkB: HTMLCanvasElement;
  readonly rivals: Readonly<Record<string, BomberSprites>>;
}

type TerrainKind = 'floor' | 'wall' | 'brick';

export function createSprites(): SpriteSet {
  return {
    terrain: createTerrainSprites(),
    bomb: createPixelSprite(BOMB, BOMB_PALETTE, SPRITE_SCALE),
    blast: createPixelSprite(BLAST, BLAST_PALETTE, SPRITE_SCALE),
    blastB: createPixelSprite(BLAST, BLAST_B_PALETTE, SPRITE_SCALE),
    blastC: createPixelSprite(BLAST, BLAST_C_PALETTE, SPRITE_SCALE),
    powerUpBomb: createPixelSprite(POWERUP_BOMB, POWERUP_BOMB_PALETTE, SPRITE_SCALE),
    powerUpFire: createPixelSprite(POWERUP_FIRE, POWERUP_FIRE_PALETTE, SPRITE_SCALE),
    powerUpSpeed: createPixelSprite(POWERUP_SPEED, POWERUP_SPEED_PALETTE, SPRITE_SCALE),
    powerUpShield: createPixelSprite(POWERUP_SHIELD, POWERUP_SHIELD_PALETTE, SPRITE_SCALE),
    playerIdle: createPixelSprite(PLAYER_IDLE, PLAYER_PALETTE, SPRITE_SCALE),
    playerWalkA: createPixelSprite(PLAYER_WALK_A, PLAYER_PALETTE, SPRITE_SCALE),
    playerWalkB: createPixelSprite(PLAYER_WALK_B, PLAYER_PALETTE, SPRITE_SCALE),
    rivals: createRivalSprites(),
  };
}

function createTerrainSprites(): Readonly<Record<StageThemeId, TerrainSprites>> {
  return {
    'pillar-hall': createTerrainSpriteSet(TERRAIN_PALETTES['pillar-hall']),
    brickworks: createTerrainSpriteSet(TERRAIN_PALETTES.brickworks),
    crossroads: createTerrainSpriteSet(TERRAIN_PALETTES.crossroads),
    'twin-courts': createTerrainSpriteSet(TERRAIN_PALETTES['twin-courts']),
  };
}

function createTerrainSpriteSet(palette: TerrainPalette): TerrainSprites {
  return {
    floor: createPixelSprite(createTerrainMatrix('floor'), palette.floor, SPRITE_SCALE),
    wall: createPixelSprite(createTerrainMatrix('wall'), palette.wall, SPRITE_SCALE),
    brick: createPixelSprite(createTerrainMatrix('brick'), palette.brick, SPRITE_SCALE),
  };
}

function createRivalSprites(): Readonly<Record<string, BomberSprites>> {
  const sprites: Record<string, BomberSprites> = {};
  for (const [id, palette] of Object.entries(RIVAL_PALETTES)) {
    sprites[id] = {
      idle: createPixelSprite(PLAYER_IDLE, palette, SPRITE_SCALE),
      walkA: createPixelSprite(PLAYER_WALK_A, palette, SPRITE_SCALE),
      walkB: createPixelSprite(PLAYER_WALK_B, palette, SPRITE_SCALE),
    };
  }
  return sprites;
}

export function spriteSize(): number {
  return MATRIX_SIZE * SPRITE_SCALE;
}

function createTerrainMatrix(kind: TerrainKind): string[] {
  const rows: string[] = [];

  for (let y = 0; y < MATRIX_SIZE; y += 1) {
    let row = '';
    for (let x = 0; x < MATRIX_SIZE; x += 1) {
      row += terrainPixel(kind, x, y);
    }
    rows.push(row);
  }

  return rows;
}

function terrainPixel(kind: TerrainKind, x: number, y: number): string {
  switch (kind) {
    case 'floor':
      if (x === 0 || y === 0 || x === MATRIX_SIZE - 1 || y === MATRIX_SIZE - 1) {
        return 'a';
      }
      if ((x * 7 + y * 13) % 17 === 0) {
        return 'c';
      }
      return 'b';

    case 'wall':
      if (x === 0 || y === 0) {
        return '3';
      }
      if (x === MATRIX_SIZE - 1 || y === MATRIX_SIZE - 1) {
        return '0';
      }
      if (x === 1 || y === 1) {
        return '2';
      }
      if (x === MATRIX_SIZE - 2 || y === MATRIX_SIZE - 2) {
        return '1';
      }
      if (x === 7 || y === 7) {
        return '1';
      }
      if ((x === 3 || x === 12) && (y === 3 || y === 12)) {
        return '2';
      }
      return 'b';

    case 'brick': {
      const brickRow = Math.floor(y / 5);
      if (y % 5 === 0) {
        return '0';
      }
      if ((x + (brickRow % 2) * 4) % 8 === 0) {
        return '0';
      }
      if (y % 5 === 1 || x % 8 === 1) {
        return '3';
      }
      return 'b';
    }
  }
}

function createPixelSprite(
  rows: readonly string[],
  palette: Palette,
  scale: number,
): HTMLCanvasElement {
  const width = rows[0]?.length ?? 0;
  if (width === 0) {
    throw new Error('Pixel sprite needs at least one row');
  }

  for (const row of rows) {
    if (row.length !== width) {
      throw new Error('Every pixel sprite row must have the same width');
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = rows.length * scale;

  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Canvas 2D is unavailable');
  }
  context.imageSmoothingEnabled = false;

  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y];
    if (row === undefined) {
      continue;
    }
    for (let x = 0; x < width; x += 1) {
      const glyph = row[x];
      if (glyph === undefined) {
        continue;
      }
      const color = palette[glyph];
      if (color !== undefined) {
        context.fillStyle = color;
        context.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }

  return canvas;
}
