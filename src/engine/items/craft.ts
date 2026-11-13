/**
 * Crafting rules (docs/design/03-items.md, "Crafting"):
 * - Every hiker crafts each type at a tier (BALANCE.items.craft.startTier;
 *   a workbench raises it in Phase 9).
 * - A basic recipe is the type's key part (2 of the same key resource) plus a
 *   broad part (any mix), more at higher tiers. Trinkets take different
 *   random resources, a new set after every trinket.
 * - A known blueprint's recipe makes exactly that item, up to the crafter's
 *   tier for its type.
 * - The spaces are paid from the crafter's own resources first, then from the
 *   other active hikers on the tile.
 */
import { BALANCE } from '../../config/balance';
import { ITEMS, craftableItems } from '../../content/items';
import { BASIC_RECIPES, TRINKET_RESOURCES } from '../../content/items/basicRecipes';
import { RESOURCES } from '../../content/resources';
import { craftModifiers, type CraftModifier, type ItemType } from '../effects';
import type { Recipe, RecipePart } from './recipe';
import { hikersOnTile } from '../map';
import { pick, roll, seedRng, shuffle } from '../rng';
import type {
  GameState,
  Hiker,
  ItemId,
  ItemTypeName,
  PaidSlot,
  ResourceId,
  RngState,
} from '../types';
import { hasQuality, type Quality } from './quality';
import { rollQuality } from './make';

const C = BALANCE.items.craft;
/** Keeps the first trinket set apart from the hike's own random numbers. */
const TRINKET_SEED = 7121;
const ALL_RESOURCES: readonly ResourceId[] = RESOURCES.map((r) => r.id);

export const CRAFT_TYPES: readonly ItemTypeName[] = [
  'tool',
  'clothes',
  'food',
  'shelter',
  'trinket',
];

/** The tier a hiker crafts this type at. */
export function craftTier(hiker: Hiker, type: ItemType): number {
  return Math.min(C.maxTier, hiker.craftTier?.[type] ?? C.startTier);
}

export const knowsBlueprint = (hiker: Hiker, itemId: ItemId) =>
  (hiker.blueprints ?? []).includes(itemId);

/** A fresh trinket recipe: the most different resources any tier needs, in a random order. */
export function rollTrinketRecipe(rng: RngState): ResourceId[] {
  const most = TRINKET_RESOURCES + Math.max(0, ...Object.values(C.tierExtra).map((e) => e.trinket));
  return shuffle(rng, ALL_RESOURCES).slice(0, most);
}

/** The basic recipe for a type at a tier. */
export function basicRecipe(state: GameState, type: ItemType, tier: number): Recipe {
  const extra = C.tierExtra[tier] ?? { key: 0, broad: 0, trinket: 0 };
  if (type === 'trinket') {
    // Until the first trinket is made, the set comes from the hike's seed.
    const ids = state.trinketRecipe ?? rollTrinketRecipe(seedRng(state.seed + TRINKET_SEED));
    return ids
      .slice(0, TRINKET_RESOURCES + extra.trinket)
      .map((id): RecipePart => ({ n: 1, ids: [id] }));
  }
  const b = BASIC_RECIPES[type];
  const parts: RecipePart[] = [];
  if (b.key) parts.push({ n: b.key.n + extra.key, ids: b.key.ids });
  parts.push({
    n: b.broad.n + extra.broad,
    ...(b.broad.any ? { any: true as const } : { nodes: b.broad.nodes ?? [] }),
  });
  return parts;
}

/** The recipe a craft pays: a blueprint's own, or the type's basic one at the crafter's tier. */
export function craftRecipe(
  state: GameState,
  hiker: Hiker,
  type: ItemType,
  blueprint?: ItemId,
): Recipe | undefined {
  if (blueprint) return ITEMS[blueprint]?.recipe;
  return basicRecipe(state, type, craftTier(hiker, type));
}

const nodeOf = (id: ResourceId) => RESOURCES.find((r) => r.id === id)?.node;

/** Whether a resource can go in a part of a recipe. */
export function fitsPart(part: RecipePart, id: ResourceId): boolean {
  if (part.ids) return part.ids.includes(id);
  if (part.any) return true;
  const node = nodeOf(id);
  return !!node && (part.nodes ?? []).includes(node);
}

/** Which part each space belongs to, in order: [0, 0, 1, 1, 1]. */
export const spaceParts = (recipe: Recipe): number[] =>
  recipe.flatMap((part, i) => Array.from({ length: part.n }, () => i));

/** The hikers whose resources a craft can use: the crafter first, then the others here. */
export function craftPool(state: GameState, crafter: Hiker): Hiker[] {
  const others = hikersOnTile(state, crafter.tileId).filter(
    (h) => h.id !== crafter.id && h.status === 'active',
  );
  return [crafter, ...others];
}

/**
 * Fills the spaces from the pool: the crafter's own first, then the others.
 * A key part (several resources named) takes the same one throughout: the
 * crafter's own if they have enough, else whichever the tile has most of.
 * Parts that name resources are filled before broad ones, so a broad part
 * never takes what a key part needs. A space nothing fits is left null.
 */
export function autoPay(state: GameState, crafter: Hiker, recipe: Recipe): (PaidSlot | null)[] {
  const pool = craftPool(state, crafter).map((h) => ({
    id: h.id,
    left: { ...h.inventory.resources } as Partial<Record<ResourceId, number>>,
  }));
  const total = (id: ResourceId) => pool.reduce((n, h) => n + (h.left[id] ?? 0), 0);
  const own = (id: ResourceId) => pool[0]?.left[id] ?? 0;
  const take = (ok: (id: ResourceId) => boolean): PaidSlot | null => {
    for (const h of pool) {
      const ids = (Object.keys(h.left) as ResourceId[])
        .filter((id) => ok(id) && (h.left[id] ?? 0) > 0)
        .sort((a, b) => (h.left[b] ?? 0) - (h.left[a] ?? 0) || a.localeCompare(b));
      const id = ids[0];
      if (id) {
        h.left[id] = (h.left[id] ?? 0) - 1;
        return { from: h.id, resource: id };
      }
    }
    return null;
  };

  const filled: (PaidSlot | null)[][] = recipe.map(() => []);
  const order = recipe.map((part, i) => ({ part, i })).sort((a, b) => rank(a.part) - rank(b.part));
  for (const { part, i } of order) {
    if (part.ids) {
      const enough = part.ids.filter((id) => total(id) >= part.n);
      const best = [...(enough.length ? enough : part.ids)].sort(
        (a, b) => Math.min(own(b), part.n) - Math.min(own(a), part.n) || total(b) - total(a),
      )[0];
      filled[i] = Array.from({ length: part.n }, () => take((id) => id === best));
    } else {
      filled[i] = Array.from({ length: part.n }, () => take((id) => fitsPart(part, id)));
    }
  }
  return filled.flat();
}

/** Named resources first, then node groups, then "any". */
const rank = (p: RecipePart) => (p.ids ? 0 : p.any ? 2 : 1);

/** Why these spaces don't pay this recipe, if they don't. */
export function paymentReason(
  state: GameState,
  crafter: Hiker,
  recipe: Recipe,
  slots: readonly (PaidSlot | null)[],
): string | undefined {
  const parts = spaceParts(recipe);
  if (slots.length !== parts.length) return 'Every space needs a resource.';
  const missing = slots.filter((s) => !s).length;
  if (missing) return `Needs ${missing} more resource${missing === 1 ? '' : 's'} on this tile.`;
  const pool = craftPool(state, crafter);
  const used = new Map<string, number>();
  for (const [k, slot] of slots.entries()) {
    if (!slot) continue;
    const part = recipe[parts[k] ?? 0];
    if (!part || !fitsPart(part, slot.resource)) return 'That resource doesn’t fit that space.';
    const giver = pool.find((h) => h.id === slot.from);
    if (!giver) return 'Only hikers on this tile can chip in.';
    const key = `${slot.from}:${slot.resource}`;
    used.set(key, (used.get(key) ?? 0) + 1);
    if ((used.get(key) ?? 0) > (giver.inventory.resources[slot.resource] ?? 0)) {
      return `${giver.name} doesn’t have that many.`;
    }
  }
  // A key part is 2 (or more) of the same resource (Wyatt, Nov 13).
  for (const [i, part] of recipe.entries()) {
    if (!part.ids || part.ids.length < 2) continue;
    const kinds = new Set(slots.filter((_, k) => parts[k] === i).map((s) => s?.resource));
    if (kinds.size > 1) return 'The key resource has to be all the same one.';
  }
  return undefined;
}

/** Takes what the spaces name from each hiker. */
export function spend(state: GameState, slots: readonly PaidSlot[]): void {
  for (const s of slots) {
    const h = state.hikers.find((x) => x.id === s.from);
    if (!h) continue;
    const left = (h.inventory.resources[s.resource] ?? 0) - 1;
    if (left > 0) h.inventory.resources[s.resource] = left;
    else delete h.inventory.resources[s.resource];
  }
}

/** Everything that changes this craft, added up. */
export interface CraftSetup {
  luck: number;
  cards: number;
  quality: number;
  durability: number;
  mods: CraftModifier[];
}

export function craftSetup(state: GameState, hiker: Hiker, type: ItemType): CraftSetup {
  const mods = craftModifiers(state, hiker, { type, tileId: hiker.tileId });
  const sum = (k: 'luck' | 'cards' | 'quality' | 'durability') =>
    mods.reduce((n, m) => n + (m[k] ?? 0), 0);
  return {
    luck: sum('luck'),
    cards: Math.max(1, C.choices + sum('cards')),
    quality: sum('quality'),
    durability: sum('durability'),
    mods,
  };
}

/** A crafted item's Quality: the Luck-shifted roll, plus any bonus, up to 5. None for shelters and trinkets. */
export function craftQuality(
  rng: RngState,
  itemId: ItemId,
  setup: CraftSetup,
): Quality | undefined {
  const def = ITEMS[itemId];
  if (!def || !hasQuality(def)) return undefined;
  if (def.fixedQuality) return def.fixedQuality;
  return Math.min(5, rollQuality(rng, setup.luck) + setup.quality) as Quality;
}

/**
 * A basic recipe's cards: the crafter's tier, each a tier higher now and
 * then, different items, never "Not crafted" ones. Each card's Quality is
 * rolled now, so it shows when it's turned over.
 */
export function dealCraft(
  state: GameState,
  type: ItemType,
  tier: number,
  setup: CraftSetup,
): { itemId: ItemId; quality?: Quality }[] {
  const out: { itemId: ItemId; quality?: Quality }[] = [];
  for (let i = 0; i < setup.cards; i++) {
    const want = Math.min(C.maxTier, roll(state.rng, C.higher) ? tier + 1 : tier);
    let options: { id: ItemId }[] = [];
    for (let t = want; t >= 1 && !options.length; t--) {
      options = craftableItems(type, t).filter((d) => !out.some((o) => o.itemId === d.id));
    }
    if (!options.length) break;
    const itemId = pick(state.rng, options).id;
    const quality = craftQuality(state.rng, itemId, setup);
    out.push({ itemId, ...(quality ? { quality } : {}) });
  }
  return out;
}
