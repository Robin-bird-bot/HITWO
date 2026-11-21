/**
 * The land's colors (public/assets/map/palettes.json): one palette per biome,
 * 4 tones per land type from shadow to highlight. Read through a glob so it
 * works in the game, a worker and the tests.
 */
import type { BiomeId } from '../../../../engine';

export type PaletteName = 'meadow' | 'rainforest' | 'alpine';

export interface Palette {
  meadowA: string[];
  meadowB: string[];
  forestFloor: string[];
  rock: string[];
  bank: string[];
  crown: string[];
  crownShadow: string;
  autumn: string[][];
  autumnShare: number;
  snowAbove?: number;
  water: { sand: string; shallows: string; water: string; deep: string; ripple: string };
  contour: string;
  haze: string;
  flowers: string[];
}

export interface PaperLook {
  base: string;
  graphite: string;
  ink: string;
  hatch: number;
}

type PalettesJson = Record<PaletteName, Palette> & { paper: PaperLook };

const FILES = import.meta.glob<PalettesJson>('/public/assets/map/palettes.json', {
  eager: true,
  import: 'default',
});
const JSON_PALETTES = Object.values(FILES)[0] as PalettesJson;

export const PALETTES: Readonly<Record<PaletteName, Palette>> = {
  meadow: JSON_PALETTES.meadow,
  rainforest: JSON_PALETTES.rainforest,
  alpine: JSON_PALETTES.alpine,
};
export const PAPER: PaperLook = JSON_PALETTES.paper;

/**
 * Every section uses the Meadow palette until Phase 11 assigns biomes (update,
 * section 9). TODO(phase-11): turn this on to use each section's own biome.
 */
export const BIOME_PALETTES = false;

/** A section's palette from its biome (the Meadow's, for now). */
export function paletteFor(biome: BiomeId): PaletteName {
  if (!BIOME_PALETTES) return 'meadow';
  if (biome === 'temperateRainforest') return 'rainforest';
  if (biome === 'alpine') return 'alpine';
  return 'meadow';
}

/** "#AABBCC" as 0–255 numbers. */
export function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
