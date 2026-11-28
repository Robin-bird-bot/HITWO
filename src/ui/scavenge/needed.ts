/**
 * What the party's starred recipes still need (35-ui-overhaul.md, sections
 * 5 and 6). A recipe is starred by its key: `bp:<item>` for a blueprint, or
 * `basic:<type>:<tier>` for a type's basic recipe at a tier. "Still needs"
 * counts what the hiker and the others on the tile already hold, the way
 * crafting pays (`autoPay`).
 *
 * - A scavenge card is NEEDED while a starred recipe still lacks one of its
 *   resources ("NEEDED · SACK"), or STARRED when the resource itself is.
 * - Looking for lists each starred recipe with its parts, had or missing.
 */
import { ITEMS } from '../../content';
import {
  autoPay,
  basicRecipe,
  craftRecipe,
  fitsPart,
  spaceParts,
  type GameState,
  type Hiker,
  type ItemTypeName,
  type ResourceId,
} from '../../engine';
import type { RecipePart } from '../../engine/items/recipe';

export type RecipeKey = string;

export const blueprintKey = (itemId: string): RecipeKey => `bp:${itemId}`;
export const basicKey = (type: ItemTypeName, tier: number): RecipeKey => `basic:${type}:${tier}`;

const TYPE_WORD: Record<ItemTypeName, string> = {
  tool: 'Tools',
  clothes: 'Clothes',
  food: 'Food',
  shelter: 'Shelters',
  trinket: 'Trinkets',
};
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/** A starred recipe: its name, its parts, and which spaces are paid (null: missing). */
export interface StarredRecipe {
  key: RecipeKey;
  name: string;
  parts: readonly RecipePart[];
  /** One per space, in order: the part it belongs to, and whether it's paid. */
  spaces: readonly { part: number; paid: boolean }[];
  missing: number;
}

/** The recipe a key names, for this hiker, or null when it isn't one. */
export function recipeOf(
  state: GameState,
  hiker: Hiker,
  key: RecipeKey,
): { name: string; parts: readonly RecipePart[] } | null {
  const [kind, a, b] = key.split(':');
  if (kind === 'bp' && a) {
    const def = ITEMS[a];
    if (!def || def.type === 'present') return null;
    const parts = craftRecipe(state, hiker, def.type, def.id);
    return parts ? { name: def.name, parts } : null;
  }
  if (kind === 'basic' && a && b && a in TYPE_WORD) {
    const type = a as ItemTypeName;
    const tier = Number(b);
    if (!Number.isInteger(tier) || tier < 1) return null;
    return {
      name: `${TYPE_WORD[type]} · Tier ${ROMAN[tier - 1] ?? tier}`,
      parts: basicRecipe(state, type, tier),
    };
  }
  return null;
}

/** The party's starred recipes, with what each still needs for this hiker. */
export function starredRecipes(state: GameState, hiker: Hiker): StarredRecipe[] {
  return (state.starred?.recipes ?? []).flatMap((key) => {
    const r = recipeOf(state, hiker, key);
    if (!r) return [];
    const slots = autoPay(state, hiker, r.parts);
    const parts = spaceParts(r.parts);
    const spaces = slots.map((slot, i) => ({ part: parts[i] ?? 0, paid: !!slot }));
    return [{ key, ...r, spaces, missing: spaces.filter((s) => !s.paid).length }];
  });
}

/**
 * The ribbon a scavenge card gets: NEEDED · <recipe> when a starred recipe
 * still lacks one of the card's resources, STARRED when a resource on it is
 * starred, or none.
 */
export function wantedRibbon(
  state: GameState,
  hiker: Hiker,
  resources: readonly ResourceId[],
): string | null {
  if (!resources.length) return null;
  for (const r of starredRecipes(state, hiker)) {
    const lacking = r.spaces.filter((s) => !s.paid).map((s) => r.parts[s.part]);
    if (lacking.some((part) => part && resources.some((id) => fitsPart(part, id)))) {
      return `NEEDED · ${r.name.toUpperCase()}`;
    }
  }
  const starred = state.starred?.resources ?? [];
  return resources.some((id) => starred.includes(id)) ? 'STARRED' : null;
}
