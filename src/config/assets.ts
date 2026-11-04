/**
 * Paths to the art and fonts the game loads from public/assets/ (copied from
 * the /assets masters). Always build URLs with asset() so the GitHub Pages base
 * path (/HITWO/) is applied.
 */
const BASE = import.meta.env.BASE_URL;

export function asset(path: string): string {
  return `${BASE}assets/${path}`;
}

export const ASSETS = {
  backgrounds: {
    forestMisty: asset('backgrounds/239-forest-misty.webp'),
  },
  sky: {
    sun: asset('sky/sun.png'),
  },
  textures: {
    halftone: asset('textures/pixel-halftone.png'),
  },
  /** Hex node badges for tiles and card backs. */
  nodes: {
    forest: asset('nodes/forest.png'),
    river: asset('nodes/river.png'),
    wildlife: asset('nodes/wildlife.png'),
    mountain: asset('nodes/mountain.png'),
  },
  icons: {
    acornCaps: asset('icons/acorn-caps.png'),
  },
} as const;
