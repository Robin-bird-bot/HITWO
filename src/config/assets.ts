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
  /** Land layers for each biome's backdrop, back to front (docs/ASSETS.md). */
  land: {
    blueMountains: asset('backgrounds/241-mountains-blue.webp'),
    greenRidge: asset('backgrounds/240-ridge-green-with-trees.webp'),
    grassHills: asset('backgrounds/247-grass-hills-foreground.webp'),
  },
  sky: {
    sun: asset('sky/sun.png'),
    moon: asset('sky/moon.png'),
  },
  portraits: {
    placeholder: asset('portraits/placeholder.png'),
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
  /** Resource icons by resource id (all 16). */
  resources: Object.fromEntries(
    [
      'wood',
      'moss',
      'mushroom',
      'grass',
      'fish',
      'clay',
      'shell',
      'seaweed',
      'meat',
      'fur',
      'oil',
      'stone',
      'metal',
      'bones',
      'flint',
      'salt',
    ].map((id) => [id, asset(`resources/${id}.png`)]),
  ) as Record<string, string>,
  itemCards: {
    clothesGradient: asset('item-cards/gradients/clothes.png'),
    clothesIcon: asset('item-cards/type-icons/clothes.png'),
  },
} as const;
