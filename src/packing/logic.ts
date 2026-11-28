/**
 * The packing screen's rules (docs/design/27-packing-screen.md, sections 3,
 * 4 and 6): a slot machine for the party's starting items, then each
 * hiker's resource bundles. Both looks (TrailMate and the cabinet) draw this
 * one set of rules. Pure and seeded: every function takes a state and
 * returns a new one, and all randomness comes from the state's own stream.
 *
 * - **Items (5 reels):** the party takes 2 items plus 1 per hiker. The first
 *   spin is free; a respin spins every lit reel and costs 1. Taking an item
 *   puts it in a hiker's bag and darkens its reel for the rest of the step.
 *   Every reel dark with items still owed: Second Wind, all five light up
 *   and spin for free.
 * - **Resources (3 reels):** in party order, each hiker takes 2 bundles, with
 *   a free spin and their own respins each turn.
 * - **Bonuses:** the same type (or bundle size) on lit reels side by side;
 *   a dark reel breaks a row and only the longest row pays.
 */
import { BALANCE } from '../config/balance';
import { findableItems } from '../content/items';
import { RESOURCES } from '../content/resources';
import { pick, roll, seedRng, weightedPick } from '../engine/rng';
import type { ItemId, ResourceId, RngState } from '../engine/types';

const P = BALANCE.packing;

/** The item types on the reels (no trinkets). */
export type PackType = 'tool' | 'food' | 'clothes' | 'shelter';
export const PACK_TYPES: readonly PackType[] = ['tool', 'food', 'clothes', 'shelter'];

export interface ItemSymbol {
  kind: 'item';
  itemId: ItemId;
  type: PackType;
  tier: 1 | 2;
}

/** A bundle: just its resources (its size is how many). Never in the inventory. */
export interface BundleSymbol {
  kind: 'bundle';
  resources: ResourceId[];
}

export type ReelSymbol = ItemSymbol | BundleSymbol;

export interface Reel {
  /** What it shows; null before its first spin. */
  value: ReelSymbol | null;
  /** Lit: it spins and can be taken. Dark: taken from this step. */
  lit: boolean;
  /** After a jackpot, once one is taken the rest lock until the next spin. */
  locked: boolean;
  /** Who took from it (its shutter shows them). */
  takenBy: number | null;
}

/** A hiker at the machine, from a dry run of the hike (seats.ts). */
export interface Seat {
  id: string;
  name: string;
  color: string;
  /** Items they start with anyway (kits, gift traits): in the bag first, marked START. */
  start: readonly ItemId[];
  /** Bag slots in all, START items included. */
  bagSlots: number;
  /** Resources they can still hold after their kit and gifts. */
  resourceRoom: number;
}

/** What a hiker has taken. */
export interface Pack {
  items: ItemSymbol[];
  bundles: BundleSymbol[];
}

export type Step = 'items' | 'resources' | 'done';

/** Rows that pay: 3 or 4 in a row and the jackpot (items); all ×1, ×2 or ×3 (bundles). */
export type BonusKind = 'row3' | 'row4' | 'jackpot' | 'ones' | 'twos' | 'threes';

export interface Bonus {
  kind: BonusKind;
  /** The reels in the row. */
  reels: number[];
  /** The reels the bonus changed (turned Tier II, or grew), in order. */
  changed: number[];
}

export interface SpinReport {
  /** What each reel landed on before any bonus (null: dark). */
  landed: (ReelSymbol | null)[];
  bonus: Bonus | null;
  /** A respin paid for it (false: a free spin). */
  paid: boolean;
}

export interface PackingState {
  rng: RngState;
  step: Step;
  seats: Seat[];
  packs: Pack[];
  reels: Reel[];
  /** Items the party still takes. */
  picksLeft: number;
  respins: number;
  /** The next spin costs nothing: the first of a step or a turn, and Second Wind's. */
  freeSpin: boolean;
  /** A jackpot just paid: the next take locks the other lit reels. */
  jackpotOpen: boolean;
  /** Whose turn it is in the resource step (party order). */
  turn: number;
  /** The last spin, for the screen's animations. */
  last: SpinReport | null;
}

/** Testing (Settings → Testing → Force next spin): the prototype's buttons. */
export type ForceSpin = 'row3' | 'row4' | 'jackpot' | 'tier2' | 'ones' | 'twos' | 'threes' | 'big';

export const FORCE_ITEMS: readonly { id: ForceSpin; label: string }[] = [
  { id: 'row3', label: '3 in a row' },
  { id: 'row4', label: '4 in a row' },
  { id: 'jackpot', label: 'Jackpot' },
  { id: 'tier2', label: 'A Tier II' },
];

export const FORCE_BUNDLES: readonly { id: ForceSpin; label: string }[] = [
  { id: 'ones', label: '×1 ×1 ×1' },
  { id: 'twos', label: '×2 ×2 ×2' },
  { id: 'threes', label: '×3 ×3 ×3' },
  { id: 'big', label: 'A ×5' },
];

/** Mixed into the run's seed for packing's own stream. */
const STREAM = 0x9ac4ed;

/** Items the party takes: 2 plus 1 per hiker (Wyatt), from 3 for 1 hiker to 8 for 6. */
export const picksFor = (hikers: number): number => P.picks.base + P.picks.perHiker * hikers;

/** Free bag slots a seat has before packing. */
const roomOf = (seat: Seat): number => Math.max(0, seat.bagSlots - seat.start.length);

const pools = new Map<string, readonly ItemId[]>();

/** The items a reel can land on: offered table items of the type and tier, never trait-only ones. */
export function itemPool(type: PackType, tier: 1 | 2): readonly ItemId[] {
  const key = `${type}${tier}`;
  let pool = pools.get(key);
  if (!pool) {
    pool = findableItems(type, tier).map((d) => d.id);
    pools.set(key, pool);
  }
  return pool;
}

function itemOf(rng: RngState, type: PackType, tier: 1 | 2): ItemSymbol {
  const fallback = tier === 2 && !itemPool(type, 2).length ? 1 : tier;
  return { kind: 'item', itemId: pick(rng, itemPool(type, fallback)), type, tier: fallback };
}

function rollType(rng: RngState): PackType {
  return weightedPick(
    rng,
    PACK_TYPES.map((t) => ({ item: t, weight: P.itemTypeOdds[t] })),
  );
}

/** A reel's item: the type by its odds, then a rare Tier II. */
export function rollItem(rng: RngState): ItemSymbol {
  const type = rollType(rng);
  return itemOf(rng, type, roll(rng, P.tier2Chance) ? 2 : 1);
}

function bundleOf(rng: RngState, size: number): BundleSymbol {
  return {
    kind: 'bundle',
    resources: Array.from({ length: size }, () => pick(rng, RESOURCES).id),
  };
}

/** A reel's bundle: its size by the odds, each resource any of the 16 (repeats allowed). */
export function rollBundle(rng: RngState): BundleSymbol {
  const sizes = Object.entries(P.bundleOdds).map(([size, weight]) => ({
    item: Number(size),
    weight,
  }));
  return bundleOf(rng, weightedPick(rng, sizes));
}

/** What a row compares: the item's type, or the bundle's size. */
export const keyOf = (v: ReelSymbol): string =>
  v.kind === 'item' ? v.type : `x${v.resources.length}`;

const freshReels = (n: number): Reel[] =>
  Array.from({ length: n }, () => ({ value: null, lit: true, locked: false, takenBy: null }));

export interface NewPacking {
  seed: number;
  seats: readonly Seat[];
}

/** The machine before its first spin: 5 lit reels, the first spin free. */
export function newPacking({ seed, seats }: NewPacking): PackingState {
  const room = seats.reduce((sum, seat) => sum + roomOf(seat), 0);
  return {
    rng: seedRng((seed ^ STREAM) >>> 0),
    step: 'items',
    seats: seats.map((s) => ({ ...s, start: [...s.start] })),
    packs: seats.map(() => ({ items: [], bundles: [] })),
    reels: freshReels(P.itemReels),
    // Starting kits can fill bags: never owe more items than there's room for.
    picksLeft: Math.min(picksFor(seats.length), room),
    respins: P.itemRespins,
    freeSpin: true,
    jackpotOpen: false,
    turn: 0,
    last: null,
  };
}

/** Something is still owed: items for the party, or bundles for this turn's hiker. */
export function owed(s: PackingState): boolean {
  if (s.step === 'items') return s.picksLeft > 0;
  if (s.step === 'resources') return (s.packs[s.turn]?.bundles.length ?? 0) < P.bundlesEach;
  return false;
}

/** Every item is taken: the items step is over ("ALL PACKED"). */
export const itemsDone = (s: PackingState): boolean => s.step === 'items' && s.picksLeft <= 0;

/** Every hiker has their bundles ("READY"). */
export const bundlesDone = (s: PackingState): boolean =>
  s.step === 'resources' && s.packs.every((p) => p.bundles.length >= P.bundlesEach);

/** The lever works: a reel is lit, something is owed, and the spin is free or paid for. */
export function canSpin(s: PackingState): boolean {
  if (!owed(s) || !s.reels.some((r) => r.lit)) return false;
  return s.freeSpin || s.respins > 0;
}

/** The hikers who can take from a reel now (by seat). */
export function targets(s: PackingState): number[] {
  if (s.step === 'items') {
    if (s.picksLeft <= 0) return [];
    return s.seats.flatMap((seat, i) =>
      (s.packs[i]?.items.length ?? 0) < roomOf(seat) ? [i] : [],
    );
  }
  if (s.step === 'resources' && owed(s)) return [s.turn];
  return [];
}

/** A reel's value can be taken now. */
export function canTake(s: PackingState, reel: number): boolean {
  const r = s.reels[reel];
  return !!r && r.lit && !r.locked && r.value !== null && targets(s).length > 0;
}

/** The longest row of 3 or more: the same key on lit reels side by side. */
export function bestRow(reels: readonly Reel[]): number[] | null {
  let best: number[] | null = null;
  let cur: number[] = [];
  let curKey = '';
  reels.forEach((r, i) => {
    const key = r.lit && r.value ? keyOf(r.value) : null;
    if (key !== null && cur.length && key === curKey) cur.push(i);
    else {
      cur = key !== null ? [i] : [];
      curKey = key ?? '';
    }
    if (cur.length >= 3 && (!best || cur.length > best.length)) best = [...cur];
  });
  return best;
}

/** Turns a reel's Tier I item into a random Tier II of its type. A Tier II stays as it is. */
function upgrade(s: PackingState, reel: number): boolean {
  const r = s.reels[reel];
  const v = r?.value;
  if (!r || v?.kind !== 'item' || v.tier === 2 || !itemPool(v.type, 2).length) return false;
  r.value = itemOf(s.rng, v.type, 2);
  return true;
}

/** Grows a bundle to `size` with more random resources. */
function grow(s: PackingState, reel: number, size: number): boolean {
  const v = s.reels[reel]?.value;
  if (v?.kind !== 'bundle' || v.resources.length >= size) return false;
  while (v.resources.length < size) v.resources.push(pick(s.rng, RESOURCES).id);
  return true;
}

const BUNDLE_ROWS: Readonly<Record<number, BonusKind>> = { 1: 'ones', 2: 'twos', 3: 'threes' };

/** Pays the longest row after a spin (27, sections 3.1 and 4). */
function payBonus(s: PackingState): Bonus | null {
  const row = bestRow(s.reels);
  const first = row && s.reels[row[0] ?? -1]?.value;
  if (!row || !first) return null;
  const changed: number[] = [];
  let kind: BonusKind;
  if (first.kind === 'item') {
    if (row.length >= 5) {
      kind = 'jackpot';
      for (const i of row) if (upgrade(s, i)) changed.push(i);
      // Only one of the five can be taken this round.
      s.jackpotOpen = true;
    } else if (row.length === 4) {
      kind = 'row4';
      const plain = row.filter((i) => {
        const v = s.reels[i]?.value;
        return v?.kind === 'item' && v.tier === 1;
      });
      for (let k = 0; k < P.bonuses.fourUpgrades && plain.length; k++) {
        const i = pick(s.rng, plain);
        plain.splice(plain.indexOf(i), 1);
        if (upgrade(s, i)) changed.push(i);
      }
    } else kind = 'row3';
  } else {
    const size = first.resources.length;
    const rowKind = BUNDLE_ROWS[size];
    // A row of ×5 bundles isn't on the paytable.
    if (!rowKind) return null;
    kind = rowKind;
    const to = P.bonuses.grow[size];
    if (to !== undefined) {
      const i = pick(s.rng, row);
      if (grow(s, i, to)) changed.push(i);
    }
  }
  s.respins += P.bonuses.respins;
  return { kind, reels: row, changed };
}

const ROW_FORCE: Partial<Record<ForceSpin, number>> = { row3: 3, row4: 4, jackpot: 5 };
const BUNDLE_FORCE: Partial<Record<ForceSpin, number>> = { ones: 1, twos: 2, threes: 3 };

/** Testing: rigs the reels just spun (the prototype's `applyRig`). */
function applyForce(s: PackingState, force: ForceSpin): void {
  const lit = s.reels.flatMap((r, i) => (r.lit ? [i] : []));
  if (!lit.length) return;
  const set = (i: number, v: ReelSymbol) => {
    const r = s.reels[i];
    if (r) r.value = v;
  };
  if (s.step === 'resources') {
    const size = BUNDLE_FORCE[force];
    if (force === 'big') set(pick(s.rng, lit), bundleOf(s.rng, 5));
    // A bundle row needs all 3 reels lit.
    else if (size && lit.length === s.reels.length) {
      for (const i of lit) set(i, bundleOf(s.rng, size));
    }
    return;
  }
  if (force === 'tier2') {
    const i = pick(s.rng, lit);
    const v = s.reels[i]?.value;
    set(i, itemOf(s.rng, v?.kind === 'item' ? v.type : rollType(s.rng), 2));
    return;
  }
  const n = ROW_FORCE[force];
  if (!n) return;
  // The first n reels side by side that are all lit.
  for (let start = 0; start + n <= s.reels.length; start++) {
    const idx = Array.from({ length: n }, (_, j) => start + j);
    if (!idx.every((i) => s.reels[i]?.lit)) continue;
    const type = pick(s.rng, PACK_TYPES.slice(0, 3));
    for (const i of idx) set(i, itemOf(s.rng, type, 1));
    // The neighbors break the row, so it's exactly n long.
    const others = PACK_TYPES.filter((t) => t !== type);
    for (const i of [start - 1, start + n]) {
      if (s.reels[i]?.lit) set(i, itemOf(s.rng, pick(s.rng, others), 1));
    }
    return;
  }
}

/**
 * Pulls the lever: every lit reel spins (dark ones stay dark) and the
 * longest row pays. Free when due; otherwise it costs a respin, and with none
 * left it does nothing.
 */
export function spin(s0: PackingState, force?: ForceSpin): PackingState {
  if (!canSpin(s0)) return s0;
  const s = structuredClone(s0);
  const paid = !s.freeSpin;
  if (paid) s.respins -= 1;
  s.freeSpin = false;
  s.jackpotOpen = false;
  for (const r of s.reels) {
    r.locked = false;
    if (r.lit) r.value = s.step === 'items' ? rollItem(s.rng) : rollBundle(s.rng);
  }
  if (force) applyForce(s, force);
  const landed = s.reels.map((r) => (r.lit && r.value ? structuredClone(r.value) : null));
  const bonus = payBonus(s);
  s.last = { landed, bonus, paid };
  return s;
}

/** All reels light up again, empty, with a free spin due. */
function relight(s: PackingState): void {
  for (const r of s.reels) {
    r.lit = true;
    r.locked = false;
    r.takenBy = null;
  }
  s.freeSpin = true;
  s.jackpotOpen = false;
}

/** A hiker's resource turn: 3 fresh reels, their own respins, a free spin. */
function startTurn(s: PackingState, turn: number): void {
  s.turn = turn;
  s.reels = freshReels(P.bundleReels);
  s.respins = P.bundleRespins;
  s.freeSpin = true;
  s.jackpotOpen = false;
  s.last = null;
}

/**
 * Takes a reel's item (to any hiker with room) or bundle (only to the hiker
 * whose turn it is). Its reel goes dark. Then: Second Wind when every reel is
 * dark and items are still owed, or the next hiker's turn after a second bundle.
 */
export function take(s0: PackingState, reel: number, hiker: number): PackingState {
  if (!canTake(s0, reel) || !targets(s0).includes(hiker)) return s0;
  const s = structuredClone(s0);
  const r = s.reels[reel];
  const pack = s.packs[hiker];
  const v = r?.value;
  if (!r || !pack || !v) return s0;
  if (v.kind === 'item') {
    pack.items.push(v);
    s.picksLeft -= 1;
  } else pack.bundles.push(v);
  r.lit = false;
  r.takenBy = hiker;
  if (s.jackpotOpen) {
    s.jackpotOpen = false;
    for (const other of s.reels) if (other.lit) other.locked = true;
  }
  if (s.step === 'items') {
    // Second Wind (Claude's idea): with 5 reels and up to 8 picks, the reels come back.
    if (s.picksLeft > 0 && !s.reels.some((x) => x.lit)) relight(s);
  } else if (pack.bundles.length >= P.bundlesEach && s.turn < s.seats.length - 1) {
    startTurn(s, s.turn + 1);
  }
  return s;
}

/** Second Wind just fired: every reel is back on and the free spin is due. */
export const secondWindDue = (s: PackingState): boolean =>
  s.step === 'items' &&
  s.picksLeft > 0 &&
  s.freeSpin &&
  s.last !== null &&
  s.reels.every((r) => r.lit && r.takenBy === null);

/** NEXT: RESOURCES, once every item is taken. */
export function toResources(s0: PackingState): PackingState {
  if (!itemsDone(s0)) return s0;
  const s = structuredClone(s0);
  s.step = 'resources';
  startTurn(s, 0);
  return s;
}

/** START THE HIKE, once every hiker has their bundles. */
export function finish(s0: PackingState): PackingState {
  if (!bundlesDone(s0)) return s0;
  const s = structuredClone(s0);
  s.step = 'done';
  for (const r of s.reels) r.lit = false;
  return s;
}

/** What each hiker takes into the hike (by seat): item ids, and the resources their bundles open into. */
export interface Packed {
  items: ItemId[];
  resources: ResourceId[];
}

export function handover(s: PackingState): Packed[] {
  return s.packs.map((p) => ({
    items: p.items.map((i) => i.itemId),
    resources: p.bundles.flatMap((b) => b.resources),
  }));
}

/** Resources a hiker's bundles hold past their room: dropped when the hike starts. */
export function overLimit(s: PackingState, hiker: number): number {
  const seat = s.seats[hiker];
  const n = s.packs[hiker]?.bundles.reduce((sum, b) => sum + b.resources.length, 0) ?? 0;
  return seat ? Math.max(0, n - seat.resourceRoom) : 0;
}

/**
 * Testing → Skip packing: random picks, no respins, straight to the hike.
 * The same seed and party always pack the same way.
 */
export function autoPack(start: NewPacking): Packed[] {
  let s = newPacking(start);
  const takeRandom = () => {
    const reels = s.reels.flatMap((_, i) => (canTake(s, i) ? [i] : []));
    const who = targets(s);
    if (!reels.length || !who.length) return false;
    s = take(s, pick(s.rng, reels), pick(s.rng, who));
    return true;
  };
  // Every step ends: each take is one less owed, and a dark machine relights for free.
  // Only a jackpot's locked reels need a respin (and the jackpot paid one).
  for (let guard = 0; guard < 200 && s.step !== 'done'; guard++) {
    if (itemsDone(s)) s = toResources(s);
    else if (bundlesDone(s)) s = finish(s);
    else if (s.freeSpin) s = spin(s);
    else if (!takeRandom()) {
      if (!canSpin(s)) break;
      s = spin(s);
    }
  }
  return handover(s);
}
