import type { StageThemeId } from '../game/themes';

/** Terrain colours for one Stage Theme. Actors and hazards keep their own palettes. */
export interface TerrainPalette {
  readonly floor: Readonly<Record<string, string>>;
  readonly wall: Readonly<Record<string, string>>;
  readonly brick: Readonly<Record<string, string>>;
  /** Highlight and body colours for the brick-debris burst. */
  readonly debris: readonly [string, string];
}

/**
 * One terrain palette per Stage Theme. Floors stay dark so actors and blasts
 * read clearly, walls stay lighter than floors, and bricks stay warm so they
 * never blend into the wall structure.
 */
export const TERRAIN_PALETTES: Readonly<Record<StageThemeId, TerrainPalette>> = {
  'pillar-hall': {
    floor: { a: '#0e1520', b: '#1a2231', c: '#26334a' },
    wall: { '0': '#0a1220', '1': '#1c2c44', '2': '#47658f', '3': '#6b8cba', b: '#314864' },
    brick: { '0': '#3b1c12', '1': '#6b301d', '2': '#a4502b', '3': '#cf7147', b: '#8b4324' },
    debris: ['#cf7147', '#8b4324'],
  },
  brickworks: {
    floor: { a: '#160f0c', b: '#241813', c: '#35241a' },
    wall: { '0': '#120c08', '1': '#3a2a1d', '2': '#7d5a3a', '3': '#c08a55', b: '#5a4028' },
    brick: { '0': '#3a120b', '1': '#6e2214', '2': '#a93d1d', '3': '#e06a33', b: '#8c2f17' },
    debris: ['#e06a33', '#8c2f17'],
  },
  crossroads: {
    floor: { a: '#0f0d1c', b: '#191530', c: '#262047' },
    wall: { '0': '#0b0a18', '1': '#252044', '2': '#4d4380', '3': '#897cc4', b: '#38305f' },
    brick: { '0': '#3a2010', '1': '#6d3a18', '2': '#a75a22', '3': '#e08a3a', b: '#8a471c' },
    debris: ['#e08a3a', '#8a471c'],
  },
  'twin-courts': {
    floor: { a: '#081410', b: '#0f211a', c: '#183229' },
    wall: { '0': '#06120e', '1': '#17352a', '2': '#2f6b52', '3': '#5fb98a', b: '#22533f' },
    brick: { '0': '#33260c', '1': '#6b4a14', '2': '#a8751f', '3': '#e0a83a', b: '#8a5f18' },
    debris: ['#e0a83a', '#8a5f18'],
  },
};

export function terrainPalette(id: StageThemeId): TerrainPalette {
  return TERRAIN_PALETTES[id];
}
