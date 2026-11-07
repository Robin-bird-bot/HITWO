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
  /** Weather node states (Phase 6): cropped to the hex from assets/nodes, clipped to a hex in CSS. */
  nodeStates: {
    fire: asset('nodes/fire.png'),
    frozen: asset('nodes/frozen.png'),
    flooded: asset('nodes/flooded.png'),
  },
  /** The same art as squares (128px), for the weather change screen's cards. */
  nodeStateSquares: {
    fire: asset('nodes/fire-square.png'),
    frozen: asset('nodes/frozen-square.png'),
    flooded: asset('nodes/flooded-square.png'),
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
    /** White type icons, already placed on a full 5:7 card canvas. */
    typeIcons: byItemType((t) => asset(`item-cards/type-icons/${t}.png`)),
    rays: byItemType((t) => asset(`item-cards/rays/${t}.png`)),
  },
  /** Scavenge card layers (docs/ASSETS.md, "Scavenge card layers"). */
  scavenge: {
    /** Blank card backgrounds, no rays. */
    backdrops: {
      forest: asset('scavenge/backdrops/forest.jpg'),
      river: asset('scavenge/backdrops/river.jpg'),
      wildlife: asset('scavenge/backdrops/wildlife.jpg'),
      mountain: asset('scavenge/backdrops/mountain.jpg'),
      any: asset('scavenge/backdrops/any-node.jpg'),
      caps: asset('scavenge/backdrops/caps.jpg'),
      items: asset('scavenge/backdrops/items.jpg'),
    },
    rays: {
      forest: asset('scavenge/rays/forest.png'),
      river: asset('scavenge/rays/river.png'),
      wildlife: asset('scavenge/rays/wildlife.png'),
      mountain: asset('scavenge/rays/mountain.png'),
      any: asset('scavenge/rays/any-node-cream.png'),
      caps: asset('scavenge/rays/caps.png'),
      items: asset('scavenge/rays/items-white.png'),
    },
    /** Hex icons on a full card canvas, for the caps and item card backs. */
    backs: {
      caps: asset('scavenge/backs/caps-back-icon.png'),
      items: asset('scavenge/backs/item-back-icon.png'),
    },
  },
} as const;

/**
 * A card's picture, named by its id (16:9, 960×540): challenges and Trials in
 * challenges/, opportunities in opportunities/.
 */
export function cardArt(card: { id: string; kind: string }): string {
  const folder = card.kind === 'opportunity' ? 'opportunities' : 'challenges';
  return asset(`${folder}/${card.id}.jpg`);
}

/** A Wonder's banner picture (16:9, 1600×900). */
export function wonderArt(id: string): string {
  return asset(`wonders/${id}.jpg`);
}

function byItemType(path: (type: string) => string) {
  return Object.fromEntries(
    ['tool', 'food', 'clothes', 'shelter', 'trinket'].map((t) => [t, path(t)]),
  ) as Record<'tool' | 'food' | 'clothes' | 'shelter' | 'trinket', string>;
}
