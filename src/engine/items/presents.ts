/**
 * Presents (Nov 20 update, holiday hikers; 03-items.md, "Presents").
 *
 * - **Wrapping** (Gift Wrapper): four recipes. 3 of one resource or 5 of one
 *   node's resources (any mix) make a plain Present; the 3-resource wish list
 *   a Tier 2+ one; the 5-resource wish list a Tier 3 one. Both lists are
 *   rolled again after every Present. The spaces are paid like a craft's:
 *   the wrapper's own resources first, then the others on the tile.
 * - **Opening:** the hiker's action and 1 Energy, for a random item. Its tier
 *   comes from the grade's odds (the biome doesn't limit it); then any item of
 *   that tier, each equally likely (Toy Maker and Treat Sniffer tilt the
 *   types), never a Present. Its Quality rolls on the plain curve.
 */
import { BALANCE } from '../../config/balance';
import { ITEMS, OFFERED_ITEMS } from '../../content/items';
import { PRESENT_ID } from '../../content/items/presents';
import { RESOURCES } from '../../content/resources';
import { presentWeights, type ItemType } from '../effects';
import { int, weightedPick } from '../rng';
import type {
  GameState,
  Hiker,
  ItemInstance,
  NodeType,
  PaidSlot,
  PresentGrade,
  PresentRecipe,
  ResourceId,
} from '../types';
import { autoPay, craftPool } from './craft';
import { makeItem } from './make';
import type { Recipe, RecipePart } from './recipe';

const P = BALANCE.presents;
const ALL: readonly ResourceId[] = RESOURCES.map((r) => r.id);
const NODES: readonly NodeType[] = ['forest', 'river', 'wildlife', 'mountain'];
const nodeOfResource = (id: ResourceId) => RESOURCES.find((r) => r.id === id)?.node;

export const isPresent = (item: Pick<ItemInstance, 'itemId'> | undefined): boolean =>
  !!item && ITEMS[item.itemId]?.type === 'present';

/** The grade each recipe makes. */
export const RECIPE_GRADE: Readonly<Record<PresentRecipe, PresentGrade>> = {
  sameResource: 'plain',
  sameType: 'plain',
  smallWish: 'tier2plus',
  bigWish: 'tier3',
};

/** A new Present: a random wrapping (unless given), its grade and who wrapped it. */
export function makePresent(
  state: GameState,
  grade: PresentGrade,
  {
    wrappedBy,
    colorway,
    prefix = 'present',
  }: { wrappedBy?: string; colorway?: number; prefix?: string } = {},
): ItemInstance {
  const item = makeItem(state, PRESENT_ID, { prefix });
  return {
    ...item,
    colorway: colorway ?? int(state.rng, 1, P.colorways),
    grade,
    ...(wrappedBy ? { wrappedBy } : {}),
  };
}

// ── Recipes ────────────────────────────────────────────────────────────────

/** A wish list as recipe parts: each different resource, with how many. */
export function wishParts(list: readonly ResourceId[]): Recipe {
  const counts = new Map<ResourceId, number>();
  for (const id of list) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([id, n]): RecipePart => ({ n, ids: [id] }));
}

/** How much of each resource the wrapper and the others here have together. */
function poolTotals(state: GameState, wrapper: Hiker): Map<ResourceId, number> {
  const out = new Map<ResourceId, number>();
  for (const h of craftPool(state, wrapper)) {
    for (const [id, n] of Object.entries(h.inventory.resources)) {
      out.set(id, (out.get(id) ?? 0) + (n ?? 0));
    }
  }
  return out;
}

/** Resources there are enough of for "3 of one resource": the wrapper's own most first. */
export function sameResourceChoices(state: GameState, wrapper: Hiker): ResourceId[] {
  const totals = poolTotals(state, wrapper);
  const own = (id: ResourceId) => wrapper.inventory.resources[id] ?? 0;
  return ALL.filter((id) => (totals.get(id) ?? 0) >= P.sameResource).sort(
    (a, b) =>
      Math.min(own(b), P.sameResource) - Math.min(own(a), P.sameResource) ||
      (totals.get(b) ?? 0) - (totals.get(a) ?? 0) ||
      ALL.indexOf(a) - ALL.indexOf(b),
  );
}

/** Nodes there are enough resources of for "5 of one type": the wrapper's own most first. */
export function sameTypeChoices(state: GameState, wrapper: Hiker): NodeType[] {
  const totals = poolTotals(state, wrapper);
  const sum = (node: NodeType, counts: Iterable<[ResourceId, number]>) => {
    let n = 0;
    for (const [id, c] of counts) if (nodeOfResource(id) === node) n += c;
    return n;
  };
  const own = (node: NodeType) =>
    sum(
      node,
      Object.entries(wrapper.inventory.resources).map(
        ([id, c]) => [id, c ?? 0] as [string, number],
      ),
    );
  return NODES.filter((node) => sum(node, totals) >= P.sameType).sort(
    (a, b) =>
      Math.min(own(b), P.sameType) - Math.min(own(a), P.sameType) ||
      sum(b, totals) - sum(a, totals) ||
      NODES.indexOf(a) - NODES.indexOf(b),
  );
}

/**
 * A recipe's parts for this wrapper: 3 of the picked resource, 5 of the
 * picked node, or a wish list. The plain recipes pick the best one when none
 * is given. Undefined when it can't be made at all (nothing to pick, no list).
 */
export function presentRecipe(
  state: GameState,
  wrapper: Hiker,
  recipe: PresentRecipe,
  pick: { resource?: ResourceId; node?: NodeType } = {},
): { parts: Recipe; resource?: ResourceId; node?: NodeType } | undefined {
  switch (recipe) {
    case 'sameResource': {
      const resource = pick.resource ?? sameResourceChoices(state, wrapper)[0];
      return resource ? { parts: [{ n: P.sameResource, ids: [resource] }], resource } : undefined;
    }
    case 'sameType': {
      const node = pick.node ?? sameTypeChoices(state, wrapper)[0];
      return node ? { parts: [{ n: P.sameType, nodes: [node] }], node } : undefined;
    }
    case 'smallWish':
      return wrapper.wishLists ? { parts: wishParts(wrapper.wishLists.small) } : undefined;
    case 'bigWish':
      return wrapper.wishLists ? { parts: wishParts(wrapper.wishLists.big) } : undefined;
  }
}

/** The spaces a wrap pays with: as given, or filled by the game. */
export function wrapSlots(
  state: GameState,
  wrapper: Hiker,
  parts: Recipe,
  given?: readonly PaidSlot[],
): (PaidSlot | null)[] {
  return given ? [...given] : autoPay(state, wrapper, parts);
}

// ── Opening ────────────────────────────────────────────────────────────────

/** Items a Present can hold at a tier: any type but Presents, never event-only ones. */
export function presentPool(tier: number) {
  return OFFERED_ITEMS.filter((d) => d.tier === tier && !d.notFound && d.type !== 'present');
}

/** The tier inside a Present of this grade (the biome's tier doesn't limit it). */
export function rollPresentTier(state: GameState, grade: PresentGrade): 1 | 2 | 3 {
  const odds = P.tierOdds[grade];
  return weightedPick(
    state.rng,
    ([1, 2, 3] as const).map((t) => ({ item: t, weight: odds[t] ?? 0 })),
  );
}

/**
 * What a Present holds for this opener: a tier by its grade, then any item of
 * that tier, each equally likely, times the opener's type weights (Toy Maker,
 * Treat Sniffer). Quality on the plain curve.
 */
export function rollPresentItem(
  state: GameState,
  opener: Hiker,
  grade: PresentGrade,
): ItemInstance {
  const weights = presentWeights(state, opener);
  const tier = rollPresentTier(state, grade);
  // A tier with nothing in it (never, with today's items) falls back to the next one down.
  let pool = presentPool(tier);
  for (let t = tier - 1; !pool.length && t >= 1; t--) pool = presentPool(t);
  const itemId = weightedPick(
    state.rng,
    pool.map((d) => ({ item: d.id, weight: weights[d.type as ItemType] ?? 1 })),
  );
  return makeItem(state, itemId, { prefix: 'present' });
}
