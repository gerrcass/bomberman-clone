/** Runtime-generated pixel-art sprites. No external image assets. */

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

const FLOOR_PALETTE: Palette = {
  a: '#0e1520',
  b: '#1a2231',
  c: '#26334a',
};

const WALL_PALETTE: Palette = {
  '0': '#0a1220',
  '1': '#1c2c44',
  '2': '#47658f',
  '3': '#6b8cba',
  b: '#314864',
};

const BRICK_PALETTE: Palette = {
  '0': '#3b1c12',
  '1': '#6b301d',
  '2': '#a4502b',
  '3': '#cf7147',
  b: '#8b4324',
};

export interface SpriteSet {
  readonly floor: HTMLCanvasElement;
  readonly wall: HTMLCanvasElement;
  readonly brick: HTMLCanvasElement;
  readonly bomb: HTMLCanvasElement;
  readonly blast: HTMLCanvasElement;
  readonly playerIdle: HTMLCanvasElement;
  readonly playerWalkA: HTMLCanvasElement;
  readonly playerWalkB: HTMLCanvasElement;
}

type TerrainKind = 'floor' | 'wall' | 'brick';

export function createSprites(): SpriteSet {
  return {
    floor: createPixelSprite(createTerrainMatrix('floor'), FLOOR_PALETTE, SPRITE_SCALE),
    wall: createPixelSprite(createTerrainMatrix('wall'), WALL_PALETTE, SPRITE_SCALE),
    brick: createPixelSprite(createTerrainMatrix('brick'), BRICK_PALETTE, SPRITE_SCALE),
    bomb: createPixelSprite(BOMB, BOMB_PALETTE, SPRITE_SCALE),
    blast: createPixelSprite(BLAST, BLAST_PALETTE, SPRITE_SCALE),
    playerIdle: createPixelSprite(PLAYER_IDLE, PLAYER_PALETTE, SPRITE_SCALE),
    playerWalkA: createPixelSprite(PLAYER_WALK_A, PLAYER_PALETTE, SPRITE_SCALE),
    playerWalkB: createPixelSprite(PLAYER_WALK_B, PLAYER_PALETTE, SPRITE_SCALE),
  };
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
