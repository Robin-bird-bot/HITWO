/**
 * The basic recipes (docs/design/03-items.md, "Basic recipes"): each type has
 * one key resource (pick from 2 or 3, and the key is 2 of the same one: Wyatt,
 * Nov 13) plus a broad part, any mix from a wide group. Trinkets take 5
 * different resources picked at random, a new set after every trinket. Higher
 * tiers add to the key and broad parts (BALANCE.items.craftTierExtra).
 */
import type { ItemType } from '../../engine/effects';
import type { NodeType, ResourceId } from '../../engine/types';

export interface BasicRecipe {
  key?: { n: number; ids: readonly ResourceId[] };
  broad: { n: number; nodes?: readonly NodeType[]; any?: true };
}

export const BASIC_RECIPES: Readonly<Record<Exclude<ItemType, 'trinket'>, BasicRecipe>> = {
  tool: {
    key: { n: 2, ids: ['metal', 'wood'] },
    broad: { n: 3, nodes: ['mountain', 'forest'] },
  },
  clothes: {
    key: { n: 2, ids: ['fur', 'moss'] },
    broad: { n: 3, nodes: ['wildlife', 'forest'] },
  },
  food: {
    key: { n: 2, ids: ['fish', 'meat', 'mushroom'] },
    broad: { n: 2, nodes: ['forest', 'river'] },
  },
  shelter: {
    key: { n: 3, ids: ['wood', 'stone'] },
    broad: { n: 3, any: true },
  },
};

/** Trinkets: this many different random resources at Tier 1. */
export const TRINKET_RESOURCES = 5;
