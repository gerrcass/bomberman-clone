import { describe, expect, it } from 'vitest';
import { STAGE_THEME_IDS, type StageThemeId } from '../game/themes';
import { TERRAIN_PALETTES, terrainPalette } from './theme-palettes';

const FLOOR_GLYPHS = ['a', 'b', 'c'] as const;
const WALL_GLYPHS = ['0', '1', '2', '3', 'b'] as const;
const BRICK_GLYPHS = ['0', '3', 'b'] as const;
const HEX_COLOUR = /^#[0-9a-f]{6}$/;

function brightness(colour: string): number {
  const value = Number.parseInt(colour.slice(1), 16);
  const red = (value >> 16) & 0xff;
  const green = (value >> 8) & 0xff;
  const blue = value & 0xff;
  return (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
}

function requireColour(palette: Readonly<Record<string, string>>, glyph: string): string {
  const colour = palette[glyph];
  if (colour === undefined) {
    throw new Error(`Missing terrain colour for glyph ${glyph}`);
  }
  return colour;
}

describe('Stage Theme terrain palettes', () => {
  it('defines a complete palette for every Stage Theme', () => {
    expect(Object.keys(TERRAIN_PALETTES).sort()).toEqual([...STAGE_THEME_IDS].sort());

    for (const id of STAGE_THEME_IDS) {
      const palette = terrainPalette(id);

      for (const glyph of FLOOR_GLYPHS) {
        expect(palette.floor[glyph], `${id} floor ${glyph}`).toMatch(HEX_COLOUR);
      }
      for (const glyph of WALL_GLYPHS) {
        expect(palette.wall[glyph], `${id} wall ${glyph}`).toMatch(HEX_COLOUR);
      }
      for (const glyph of BRICK_GLYPHS) {
        expect(palette.brick[glyph], `${id} brick ${glyph}`).toMatch(HEX_COLOUR);
      }

      expect(palette.debris.highlight, `${id} debris highlight`).toMatch(HEX_COLOUR);
      expect(palette.debris.body, `${id} debris body`).toMatch(HEX_COLOUR);
      for (const colour of [palette.debris.highlight, palette.debris.body]) {
        expect(Object.values(palette.brick)).toContain(colour);
      }
    }
  });

  it('gives every Stage Theme its own terrain palette', () => {
    for (const kind of ['floor', 'wall', 'brick'] as const) {
      const signatures = STAGE_THEME_IDS.map((id) =>
        Object.entries(terrainPalette(id)[kind])
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([glyph, colour]) => `${glyph}:${colour}`)
          .join(','),
      );
      expect(new Set(signatures).size, `${kind} palettes`).toBe(STAGE_THEME_IDS.length);
    }

    const debris = STAGE_THEME_IDS.map((id) => {
      const { highlight, body } = terrainPalette(id).debris;
      return `${highlight},${body}`;
    });
    expect(new Set(debris).size).toBe(STAGE_THEME_IDS.length);
  });

  it('keeps the floor dark, the walls lighter, and the bricks warm', () => {
    for (const id of STAGE_THEME_IDS) {
      const palette = terrainPalette(id);
      const floorBrightest = Math.max(
        ...FLOOR_GLYPHS.map((glyph) => brightness(requireColour(palette.floor, glyph))),
      );
      const wallBrightest = Math.max(
        ...WALL_GLYPHS.map((glyph) => brightness(requireColour(palette.wall, glyph))),
      );

      expect(floorBrightest, `${id} floor stays dark`).toBeLessThan(0.22);
      expect(wallBrightest, `${id} walls stand out`).toBeGreaterThan(floorBrightest * 2.5);

      for (const glyph of BRICK_GLYPHS) {
        const colour = requireColour(palette.brick, glyph);
        const value = Number.parseInt(colour.slice(1), 16);
        const red = (value >> 16) & 0xff;
        const blue = value & 0xff;
        expect(red, `${id} brick ${glyph} warm`).toBeGreaterThan(blue);
      }
    }
  });

  it('returns the palette for a known Stage Theme', () => {
    const expected: Record<StageThemeId, string> = {
      'pillar-hall': '#6b8cba',
      brickworks: '#c08a55',
      crossroads: '#897cc4',
      'twin-courts': '#5fb98a',
    };

    for (const id of STAGE_THEME_IDS) {
      expect(terrainPalette(id).wall['3']).toBe(expected[id]);
    }
  });
});
