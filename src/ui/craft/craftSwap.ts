/**
 * Choosing what pays for a recipe space (the Craft window's swap list, and a
 * resource dragged onto a space at the Workbench). Pure, so both share it.
 */
import {
  craftPool,
  fitsPart,
  spaceParts,
  type GameState,
  type Hiker,
  type PaidSlot,
  type Recipe,
  type ResourceId,
} from '../../engine';

export interface SwapOption {
  from: Hiker;
  resource: ResourceId;
  /** How many of it this hiker has left for this space. */
  left: number;
}

/** The space's part, and whether it's a key part (every space takes the same resource). */
function partAt(recipe: Recipe, at: number) {
  const parts = spaceParts(recipe);
  const partIndex = parts[at] ?? 0;
  const part = recipe[partIndex];
  return { parts, partIndex, part, key: !!part?.ids && part.ids.length > 1 };
}

/** How many of a hiker's resource the other spaces already use. */
const usedElsewhere = (
  slots: readonly (PaidSlot | null)[],
  from: string,
  r: ResourceId,
  skip: (k: number) => boolean,
) => slots.filter((s, k) => !skip(k) && s?.from === from && s.resource === r).length;

/** What could go in space `at`: every resource on the tile that fits it, with what's left. */
export function swapOptions(
  state: GameState,
  crafter: Hiker,
  recipe: Recipe,
  slots: readonly (PaidSlot | null)[],
  at: number,
): SwapOption[] {
  const { parts, partIndex, part, key } = partAt(recipe, at);
  if (!part) return [];
  const options: SwapOption[] = [];
  for (const h of craftPool(state, crafter)) {
    for (const [r, n] of Object.entries(h.inventory.resources) as [ResourceId, number][]) {
      if (!fitsPart(part, r)) continue;
      const skip = key ? (k: number) => parts[k] === partIndex : (k: number) => k === at;
      const left = n - usedElsewhere(slots, h.id, r, skip);
      if (left > 0) options.push({ from: h, resource: r, left });
    }
  }
  return options;
}

/** Whether a key part could be paid in full with this resource from everyone on the tile. */
export function keyEnough(
  state: GameState,
  crafter: Hiker,
  recipe: Recipe,
  at: number,
  r: ResourceId,
) {
  const { part, key } = partAt(recipe, at);
  if (!part || !key) return true;
  return (
    craftPool(state, crafter).reduce((n, h) => n + (h.inventory.resources[r] ?? 0), 0) >= part.n
  );
}

/**
 * The spaces with `from`'s `resource` in space `at`. A key part changes every
 * one of its spaces to that resource, the chosen hiker's first, then the others'.
 * Null when it doesn't fit there.
 */
export function swapInto(
  state: GameState,
  crafter: Hiker,
  recipe: Recipe,
  slots: readonly (PaidSlot | null)[],
  at: number,
  from: string,
  resource: ResourceId,
): (PaidSlot | null)[] | null {
  const fits = swapOptions(state, crafter, recipe, slots, at).some(
    (o) => o.from.id === from && o.resource === resource,
  );
  if (!fits || !keyEnough(state, crafter, recipe, at, resource)) return null;
  const { parts, partIndex, key } = partAt(recipe, at);
  const next = [...slots];
  if (!key) {
    next[at] = { from, resource };
    return next;
  }
  const pool = craftPool(state, crafter);
  const spaces = parts.flatMap((p, k) => (p === partIndex ? [k] : []));
  const givers = [from, ...pool.map((h) => h.id).filter((id) => id !== from)];
  const counts = new Map(
    givers.map((id) => [
      id,
      (pool.find((h) => h.id === id)?.inventory.resources[resource] ?? 0) -
        usedElsewhere(slots, id, resource, (k) => parts[k] === partIndex),
    ]),
  );
  for (const k of spaces) {
    const giver = givers.find((id) => (counts.get(id) ?? 0) > 0);
    if (!giver) {
      next[k] = null;
      continue;
    }
    counts.set(giver, (counts.get(giver) ?? 0) - 1);
    next[k] = { from: giver, resource };
  }
  return next;
}
