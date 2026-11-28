/**
 * The workbench's rules on screen (35-ui-overhaul.md, section 6): which
 * recipes the crafter can make now, and which one a bench filled by hand
 * matches (Minecraft style), with its resources put in the recipe's order
 * for the craft action. What can pay a space is the engine's (`fitsPart`,
 * `paymentReason`); this only finds an arrangement.
 */
import { ITEMS } from '../../content';
import {
  basicKey,
  blueprintKey,
  canUseBlueprint,
  craftRecipe,
  craftTier,
  fitsPart,
  paymentReason,
  spaceParts,
  CRAFT_TYPES,
  type GameState,
  type Hiker,
  type ItemId,
  type ItemTypeName,
  type PaidSlot,
  type Recipe,
} from '../../engine';

/** A recipe the bench can make: a type's basic recipe at the crafter's tier, or a known blueprint. */
export interface Craftable {
  key: string;
  type: ItemTypeName;
  blueprint?: ItemId;
  recipe: Recipe;
}

/** Everything this crafter can make right now (resources aside). */
export function craftables(state: GameState, hiker: Hiker): Craftable[] {
  const out: Craftable[] = [];
  for (const type of CRAFT_TYPES) {
    const recipe = craftRecipe(state, hiker, type);
    if (recipe) out.push({ key: basicKey(type, craftTier(state, hiker, type)), type, recipe });
  }
  for (const id of hiker.blueprints ?? []) {
    const def = ITEMS[id];
    if (!def || def.type === 'present' || !canUseBlueprint(state, hiker, id)) continue;
    const recipe = craftRecipe(state, hiker, def.type, id);
    if (recipe) out.push({ key: blueprintKey(id), type: def.type, blueprint: id, recipe });
  }
  return out;
}

/**
 * Puts these resources in the recipe's spaces, if they fit it exactly (one
 * per space, each where it fits). Null when they don't.
 */
export function arrange(recipe: Recipe, slots: readonly PaidSlot[]): PaidSlot[] | null {
  const parts = spaceParts(recipe);
  if (slots.length !== parts.length) return null;
  // Each space's resource, found by augmenting paths (a small bipartite matching).
  const owner: (number | null)[] = parts.map(() => null);
  const fits = (space: number, s: number) => {
    const part = recipe[parts[space] ?? 0];
    const slot = slots[s];
    return !!part && !!slot && fitsPart(part, slot.resource);
  };
  const tryPlace = (s: number, seen: Set<number>): boolean => {
    for (let space = 0; space < parts.length; space++) {
      if (seen.has(space) || !fits(space, s)) continue;
      seen.add(space);
      const held = owner[space];
      if (held === null || held === undefined || tryPlace(held, seen)) {
        owner[space] = s;
        return true;
      }
    }
    return false;
  };
  for (let s = 0; s < slots.length; s++) if (!tryPlace(s, new Set())) return null;
  return owner.map((s) => slots[s ?? 0]!);
}

/**
 * The recipe a bench filled by hand makes, and its resources in that
 * recipe's order: the one the player picked first, then any other.
 */
export function matchBench(
  state: GameState,
  hiker: Hiker,
  slots: readonly PaidSlot[],
  preferred?: string | null,
): { craftable: Craftable; ordered: PaidSlot[] } | null {
  if (!slots.length) return null;
  const all = craftables(state, hiker);
  const sorted = [
    ...all.filter((c) => c.key === preferred),
    ...all.filter((c) => c.key !== preferred),
  ];
  for (const craftable of sorted) {
    // The bench as it is first (a recipe's own fill), then rearranged.
    const tries = [slots, ...keyChoices(craftable.recipe).map((r) => arrange(r, slots))];
    for (const ordered of tries) {
      if (ordered && !paymentReason(state, hiker, craftable.recipe, ordered)) {
        return { craftable, ordered: [...ordered] };
      }
    }
  }
  return null;
}

/**
 * The recipe with each key part ("2 Fur or Moss") narrowed to one of its
 * resources, every way: a key part takes the same resource throughout.
 */
function keyChoices(recipe: Recipe): Recipe[] {
  let out: Recipe[] = [recipe];
  recipe.forEach((part, i) => {
    if (!part.ids || part.ids.length < 2) return;
    out = out.flatMap((r) =>
      part.ids!.map((id) => r.map((p, k) => (k === i ? { ...p, ids: [id] } : p))),
    );
  });
  return out;
}
