/**
 * The hiker selection screen's party (Phase 10b): four spots, each empty or
 * holding a roster id. Pure, so the rules are easy to test.
 *
 * - Spot order is the run's hiker order, and each spot has its color
 *   (1 orange, 2 blue, 3 yellow, 4 purple).
 * - Dropping on a filled spot swaps: the hiker who was there goes back to
 *   the list (or, from another spot, to that spot).
 * - No cloning: a variant can't join with its base hiker or another of
 *   their variants.
 * - A hike starts with 1 to 4 hikers.
 * - Phase 10.7: only unlocked hikers can be placed, and each designed hiker
 *   needs a starting trait (one of their trees' Tier 1) before the hike
 *   starts. The pick can change until then.
 */
import { PARTY_COLORS } from '../../content/partyColors';
import { blockedBy, isPlayable, ROSTER, ROSTER_BY_ID } from '../../content/roster';
import { TREES_BY_HIKER } from '../../content/trails/trees';
import type { HikerSetup } from '../../engine/newGame';

export const SPOTS = 4;

/** Each spot's roster id, or null when it's empty. */
export type Party = readonly (string | null)[];

export const EMPTY_PARTY: Party = Array.from({ length: SPOTS }, () => null);

/** The hikers in spot order, skipping empty spots. */
export const members = (party: Party): string[] => party.filter((id): id is string => !!id);

/** The spot a hiker is in, or -1. */
export const spotOf = (party: Party, id: string): number => party.indexOf(id);

export const count = (party: Party): number => members(party).length;

/** Each hiker's starting tree (a tree id), picked in their spot. */
export type Starts = Readonly<Record<string, string>>;

/** A hiker in the party with trees but no starting trait picked yet. */
export const needsStart = (id: string, starts: Starts): boolean =>
  TREES_BY_HIKER.has(id) && !starts[id];

export const canStart = (party: Party, starts: Starts = {}): boolean =>
  count(party) >= 1 &&
  count(party) <= SPOTS &&
  !members(party).some((id) => needsStart(id, starts));

/** RANDOM: a random start for every hiker in the party who has none yet. */
export function randomStarts(party: Party, starts: Starts, rand: () => number): Starts {
  const next = { ...starts };
  for (const id of members(party)) {
    const trees = TREES_BY_HIKER.get(id)?.trees;
    if (!trees || next[id]) continue;
    next[id] = trees[Math.floor(rand() * trees.length)]?.id ?? trees[0].id;
  }
  return next;
}

/**
 * Who keeps this hiker out (a variant's base or another version of them),
 * not counting `ignoring` (the spot they'd take, or the spot they're in).
 */
export function blocker(
  party: Party,
  id: string,
  ignoring: readonly number[] = [],
): string | undefined {
  const others = party.filter((other, i) => !!other && !ignoring.includes(i)) as string[];
  return blockedBy(others, id);
}

/** Whether `id` can go in `spot`: from the list, or moved from another spot. */
export function canPlace(party: Party, id: string, spot: number): boolean {
  if (spot < 0 || spot >= SPOTS || !ROSTER_BY_ID.has(id) || !isPlayable(id)) return false;
  const from = spotOf(party, id);
  if (from >= 0) return true; // moving within the party never adds anyone
  return !blocker(party, id, [spot]);
}

/**
 * `id` dropped on `spot`:
 * - from another spot, the two swap;
 * - from the list, it takes the spot, and whoever was there goes back.
 */
export function place(party: Party, id: string, spot: number): Party {
  if (!canPlace(party, id, spot)) return party;
  const next = [...party];
  const from = spotOf(party, id);
  if (from >= 0) {
    next[from] = party[spot] ?? null;
    next[spot] = id;
    return next;
  }
  next[spot] = id;
  return next;
}

/** Into the first empty spot (Enter or a double-click on a card). */
export function add(party: Party, id: string): Party {
  if (spotOf(party, id) >= 0) return party;
  const spot = party.indexOf(null);
  return spot < 0 ? party : place(party, id, spot);
}

/** The × on a spot, or a hiker dragged out of the spots. */
export function remove(party: Party, spot: number): Party {
  if (!party[spot]) return party;
  const next = [...party];
  next[spot] = null;
  return next;
}

/**
 * RANDOM: fills the empty spots with hikers who can join, keeping the ones
 * already picked. `rand` gives 0 to 1 (the browser's random: it's the
 * screen, not the run).
 */
export function fillRandom(party: Party, rand: () => number): Party {
  const next = [...party];
  for (let spot = 0; spot < SPOTS; spot++) {
    if (next[spot]) continue;
    const open = ROSTER.filter(
      (h) => !h.locked && !next.includes(h.id) && !blocker(next, h.id),
    ).map((h) => h.id);
    if (!open.length) break;
    next[spot] = open[Math.floor(rand() * open.length)] ?? open[0] ?? null;
  }
  return next;
}

/** The run's hikers, in spot order, each in their spot's color, with their starting trait. */
export function startingParty(party: Party, starts: Starts = {}): HikerSetup[] {
  return party.flatMap((id, spot) => {
    const hiker = id && isPlayable(id) ? ROSTER_BY_ID.get(id) : undefined;
    const start = id ? starts[id] : undefined;
    return hiker ? [{ ...hiker, color: PARTY_COLORS[spot], ...(start ? { start } : {}) }] : [];
  });
}

/** "START HIKE · 2 HIKERS". */
export function startLabel(party: Party): string {
  const n = count(party);
  return n ? `START HIKE · ${n} HIKER${n === 1 ? '' : 'S'}` : 'START HIKE';
}
