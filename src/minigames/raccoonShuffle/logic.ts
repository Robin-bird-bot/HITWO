/**
 * Raccoon Shuffle, the challenge version (docs/design/18-minigames-quick.md,
 * section 6): raccoons hide in trash bins, then the bins get shuffled like
 * the cup-and-ball game. Find an empty bin.
 *
 * - One hiker at a time, each with their own fill and shuffle.
 * - **The show** ([2.5 s]): the lids open; in most bins a raccoon holds up a
 *   card with what it would steal from this hiker; the empty bins say EMPTY.
 * - **What the raccoons would steal:** each card is a resource from the
 *   hiker's own pack, picked at random without putting it back (one unit
 *   each, so two cards show wood only if they carry two). Once the pack runs
 *   out, the rest show energy ([1] energy).
 * - **The shuffle (revised Nov 26, much harder):** two bins swap places at
 *   a time, often bins that aren't neighbors (far swaps); from Tier II two
 *   pairs sometimes swap at once (each pair counts as a swap), and some
 *   steps are fake-outs (two bins start to cross, then go back; they take a
 *   swap's time but don't count). Each shuffle starts at the tier's first
 *   swap time and speeds up evenly to its last. A bin keeps its contents as
 *   it moves.
 * - **The take-away** (22-minigame-revisions.md, section 1.2; Tier III and
 *   up): after the last swap, a short pause, then a raccoon hauls off one
 *   of the empty bins at random (Tier V: two, one after the other). A
 *   dashed gap stays where it was, and it can't be picked. LURE ONE OUT's
 *   extra empty bin is never taken, so one empty bin is always left (two
 *   with the lure).
 * - **The pick:** empty passes with no cost; a raccoon steals the item on
 *   its card (the hiker fails, and loses that instead of energy).
 * - Then the other bins open for [1 s], and the next hiker gets a new fill.
 *
 * Pure and seeded.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat, seedRng, shuffle } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import {
  allDone,
  current,
  endTurn,
  newTurns,
  playing,
  quickResult,
  tickTurns,
  type Turns,
} from '../quick/turns';
import type { MinigameResult, Pay, Tier } from '../types';

const RS = BALANCE.minigames.raccoonShuffle;

export type Pack = Readonly<Partial<Record<string, number>>>;

/** What a raccoon's card shows: a resource from the hiker's pack, or energy when there's nothing to take. */
export type Card = { kind: 'resource'; id: string } | { kind: 'energy' };

/** A bin: a raccoon with its card, or empty. It keeps its contents as it moves. */
export interface Bin {
  id: number;
  card: Card | null;
  /** An empty bin LURE ONE OUT added: never taken away. */
  lure?: true;
}

export type ShufflePhase = 'show' | 'shuffle' | 'takeAway' | 'pick' | 'open' | 'after';

/** A bin a raccoon hauls off (by id), and when the haul starts (game time). */
export interface Haul {
  bin: number;
  at: number;
}

export interface RaccoonShuffleOptions {
  tier: Tier;
  /** The Night setting ("auto": the tier's chance). */
  night?: 'auto' | 'on' | 'off';
  /** What each hiker carries (the raccoons steal from it). */
  packs: Readonly<Record<string, Pack>>;
  /** Prepare: more empty bins (Lure one out), and more time on every swap (Slower shuffle). */
  extraEmpty?: number;
  extraSwapSec?: number;
}

/** One step of the shuffle: the pairs that swap, a fake-out pair (if any), and how long it takes. */
export interface ShuffleStep {
  pairs: [number, number][];
  fake: [number, number] | null;
  sec: number;
}

export interface RaccoonShuffleState {
  tier: Tier;
  emptyCount: number;
  /** Of those, how many LURE ONE OUT added (never taken). */
  lureCount: number;
  extraSwapSec: number;
  night: boolean;
  packs: Readonly<Record<string, Pack>>;
  turns: Turns;
  /** This hiker's turn: the bins (by id), which bin stands in each slot, left to right. */
  bins: Bin[];
  slots: number[];
  /** The shuffle's steps. */
  steps: ShuffleStep[];
  /** The bins hauled off after the shuffle (Tier III and up): gaps that can't be picked. */
  hauls: Haul[];
  /** The step under way (during the shuffle), and swaps done so far. */
  step: number;
  swapsDone: number;
  swapsTotal: number;
  phase: ShufflePhase;
  /** When the phase (or the step) began (game time). */
  phaseAt: number;
  /** The slot picked, and the slot selected with keys. */
  picked: number | null;
  selected: number;
  /** Each hiker's turn, once done: the bin they picked (its card, if any). */
  record: Readonly<Record<string, { card: Card | null }>>;
  time: number;
  over: boolean;
  rng: RngState;
}

/** The resource units in a pack, one entry each (wood ×2 → wood, wood), in a fixed order. */
export const packUnits = (pack: Pack | undefined): string[] =>
  Object.entries(pack ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([id, n]) => Array.from({ length: Math.max(0, n ?? 0) }, () => id));

/**
 * A hiker's fill: the tier's empty bins at random spots, and a raccoon in
 * the rest, each card a random unit from their pack (not put back), energy
 * once it runs out.
 */
export function fill(
  rng: RngState,
  tier: Tier,
  pack: Pack | undefined,
  emptyCount: number,
  lureCount = 0,
): Bin[] {
  const n = RS.tiers[tier].bins;
  emptyCount = Math.min(n - 1, emptyCount);
  const order = shuffle(
    rng,
    Array.from({ length: n }, (_, i) => i),
  ).slice(0, emptyCount);
  const empties = new Set(order);
  // The last of them are the lure's.
  const lures = new Set(order.slice(Math.max(0, emptyCount - lureCount)));
  const units = shuffle(rng, packUnits(pack));
  return Array.from({ length: n }, (_, id) => {
    if (lures.has(id)) return { id, card: null, lure: true as const };
    if (empties.has(id)) return { id, card: null };
    const unit = units.shift();
    return {
      id,
      card: unit ? { kind: 'resource' as const, id: unit } : { kind: 'energy' as const },
    };
  });
}

/**
 * The shuffle (revised Nov 26): the tier's swaps, a pair of slots at a time.
 * A share of them are far swaps (not neighbors). From Tier II some steps
 * swap two pairs at once (never sharing a bin), and some are fake-outs that
 * don't count (alone, or alongside a swap when two at once are on). Step
 * times go evenly from the tier's first swap time to its last, plus any
 * extra from Prepare.
 */
export function planSwaps(rng: RngState, tier: Tier, bins: number, extraSec = 0): ShuffleStep[] {
  const t = RS.tiers[tier];
  const raw: { pairs: [number, number][]; fake: [number, number] | null }[] = [];
  let left = t.swaps;
  const pair = (avoid: number[]): [number, number] => {
    const free = Array.from({ length: bins }, (_, i) => i).filter((i) => !avoid.includes(i));
    const far = nextFloat(rng) < t.far;
    const options: [number, number][] = [];
    for (const a of free) {
      for (const b of free) {
        if (b <= a) continue;
        if (far ? b - a >= 2 : b - a === 1) options.push([a, b]);
      }
    }
    if (options.length) return options[Math.floor(nextFloat(rng) * options.length)]!;
    const [a, b] = shuffle(rng, free);
    return [Math.min(a!, b!), Math.max(a!, b!)];
  };
  while (left > 0) {
    const both = bins >= 4 && t.double > 0 && nextFloat(rng) < t.double;
    if (t.fake > 0 && nextFloat(rng) < t.fake) {
      // A fake-out: alone, or beside a real swap when two at once are on.
      if (both) {
        const real = pair([]);
        raw.push({ pairs: [real], fake: pair(real) });
        left -= 1;
      } else raw.push({ pairs: [], fake: pair([]) });
      continue;
    }
    const first = pair([]);
    if (left >= 2 && both) {
      raw.push({ pairs: [first, pair(first)], fake: null });
      left -= 2;
    } else {
      raw.push({ pairs: [first], fake: null });
      left -= 1;
    }
  }
  const [a, b] = t.swapSec;
  return raw.map((r, k) => ({
    ...r,
    sec: (raw.length > 1 ? a + ((b - a) * k) / (raw.length - 1) : a) + extraSec,
  }));
}

/** A fresh turn for the hiker now up: a new fill and a new shuffle. */
function startTurn(s: RaccoonShuffleState, rng: RngState): RaccoonShuffleState {
  const id = current(s.turns);
  const bins = fill(rng, s.tier, id ? s.packs[id] : undefined, s.emptyCount, s.lureCount);
  return {
    ...s,
    bins,
    slots: bins.map((b) => b.id),
    steps: planSwaps(rng, s.tier, bins.length, s.extraSwapSec),
    hauls: [],
    step: 0,
    swapsDone: 0,
    phase: 'show',
    phaseAt: s.time + s.turns.handoff,
    picked: null,
    selected: Math.floor(bins.length / 2),
  };
}

export function newRaccoonShuffle(
  options: RaccoonShuffleOptions,
  order: readonly string[],
  seed: number,
): RaccoonShuffleState {
  const t = RS.tiers[options.tier];
  const rng = seedRng(seed);
  const night =
    options.night === 'on' ? true : options.night === 'off' ? false : nextFloat(rng) < t.night;
  const s: RaccoonShuffleState = {
    tier: options.tier,
    emptyCount: t.empty + (options.extraEmpty ?? 0),
    lureCount: options.extraEmpty ?? 0,
    extraSwapSec: options.extraSwapSec ?? 0,
    night,
    packs: options.packs,
    turns: newTurns(order),
    bins: [],
    slots: [],
    steps: [],
    hauls: [],
    step: 0,
    swapsDone: 0,
    swapsTotal: t.swaps,
    phase: 'show',
    phaseAt: 0,
    picked: null,
    selected: 0,
    record: {},
    time: 0,
    over: order.length === 0,
    rng,
  };
  return startTurn(s, rng);
}

/** The bin standing in a slot now. */
export const binAt = (s: RaccoonShuffleState, slot: number): Bin => s.bins[s.slots[slot]!]!;

/** Swaps the bins in each pair of slots. */
function swapped(slots: readonly number[], pairs: readonly [number, number][]): number[] {
  const out = [...slots];
  for (const [a, b] of pairs) [out[a], out[b]] = [out[b]!, out[a]!];
  return out;
}

/** Whether the bin in a slot was hauled off (its haul has started): a gap. */
export const takenAt = (s: RaccoonShuffleState, slot: number): boolean =>
  s.hauls.some((h) => h.bin === s.slots[slot] && s.time >= h.at);

/** Pick the bin in a slot (only while it's time to pick; never a gap). */
export function pickBin(s: RaccoonShuffleState, slot: number): RaccoonShuffleState {
  if (s.over || s.phase !== 'pick' || !playing(s.turns)) return s;
  if (slot < 0 || slot >= s.slots.length || takenAt(s, slot)) return s;
  return { ...s, picked: slot, selected: slot, phase: 'open', phaseAt: s.time };
}

/** Move the key selection left or right, over any gaps. */
export function select(s: RaccoonShuffleState, by: -1 | 1): RaccoonShuffleState {
  if (s.over || s.phase === 'open' || s.phase === 'after') return s;
  let selected = s.selected;
  for (let k = s.selected + by; k >= 0 && k < s.slots.length; k += by) {
    if (!takenAt(s, k)) {
      selected = k;
      break;
    }
  }
  return selected === s.selected ? s : { ...s, selected };
}

/** How many bins are taken away this turn: the tier's, but never the last empty one the tier gave. */
export function takeCount(s: Pick<RaccoonShuffleState, 'tier' | 'bins'>): number {
  const plain = s.bins.filter((b) => !b.card && !b.lure).length;
  return Math.max(0, Math.min(RS.tiers[s.tier].takeAway, plain - 1));
}

/**
 * After the last swap: a pause, then the hauls, one after the other, each
 * an empty bin (never the lure's) picked at random. Then the pick.
 */
function afterShuffle(s: RaccoonShuffleState): RaccoonShuffleState {
  const n = takeCount(s);
  if (n <= 0) return { ...s, phase: 'pick', phaseAt: s.time };
  const rng: RngState = [...s.rng];
  const T = RS.takeAway;
  const plain = s.bins.filter((b) => !b.card && !b.lure).map((b) => b.id);
  const hauls = shuffle(rng, plain)
    .slice(0, n)
    .map((bin, k) => ({ bin, at: s.time + T.pauseSec + k * (T.haulSec + T.apartSec) }));
  return { ...s, rng, hauls, phase: 'takeAway', phaseAt: s.time };
}

/** When the take-away is over: the last haul is done. */
const takeAwayEnds = (s: RaccoonShuffleState): number =>
  Math.max(s.phaseAt, ...s.hauls.map((h) => h.at + RS.takeAway.haulSec));

/** The selection, moved off a gap (to the nearest bin still there). */
function offGaps(s: RaccoonShuffleState): RaccoonShuffleState {
  if (!takenAt(s, s.selected)) return s;
  for (let d = 1; d < s.slots.length; d++) {
    for (const k of [s.selected - d, s.selected + d]) {
      if (k >= 0 && k < s.slots.length && !takenAt(s, k)) return { ...s, selected: k };
    }
  }
  return s;
}

function finish(s: RaccoonShuffleState, rng: RngState): RaccoonShuffleState {
  const id = current(s.turns);
  const card = s.picked === null ? null : binAt(s, s.picked).card;
  const record = id ? { ...s.record, [id]: { card } } : s.record;
  const turns = endTurn(s.turns, card === null);
  const next = { ...s, record, turns };
  if (allDone(turns)) return { ...next, over: true };
  return startTurn(next, rng);
}

export function tick(s0: RaccoonShuffleState, dt: number): RaccoonShuffleState {
  if (s0.over) return s0;
  const s: RaccoonShuffleState = { ...s0, time: s0.time + dt, turns: tickTurns(s0.turns, dt) };
  if (!playing(s.turns)) return s;
  const since = s.time - s.phaseAt;
  switch (s.phase) {
    case 'show':
      if (since < RS.tiers[s.tier].showSec) return s;
      return s.steps.length
        ? { ...s, phase: 'shuffle', phaseAt: s.time, step: 0 }
        : afterShuffle(s);
    case 'shuffle': {
      const now = s.steps[s.step];
      if (now && since < now.sec) return s;
      // A fake-out moves nothing and doesn't count.
      const pairs = now?.pairs ?? [];
      const slots = swapped(s.slots, pairs);
      const step = s.step + 1;
      const swapsDone = s.swapsDone + pairs.length;
      if (step >= s.steps.length) return afterShuffle({ ...s, slots, step, swapsDone });
      return { ...s, slots, step, swapsDone, phaseAt: s.time };
    }
    case 'takeAway':
      return s.time < takeAwayEnds(s) ? s : offGaps({ ...s, phase: 'pick', phaseAt: s.time });
    case 'open':
      return since < RS.pickedSec ? s : { ...s, phase: 'after', phaseAt: s.time };
    case 'after': {
      if (since < RS.afterSec) return s;
      const rng: RngState = [...s.rng];
      return { ...finish(s, rng), rng };
    }
    default:
      return s;
  }
}

/** What a card takes: the resource on it, or [1] energy. */
export const cardPay = (card: Card): Pay =>
  card.kind === 'resource' ? { stolen: [card.id] } : { energy: RS.raccoonEnergy };

/** Who picked an empty bin (passed, no cost); a raccoon steals what's on its card. */
export function result(s: RaccoonShuffleState): MinigameResult {
  const pays: Record<string, Pay> = {};
  for (const id of s.turns.order) {
    const card = s.record[id]?.card;
    if (card) pays[id] = cardPay(card);
  }
  return quickResult(s.turns.order, (id) => s.turns.done[id] === true, pays);
}

/** The bins' middles (scene x): evenly spaced, centered, closer when there are many. */
export function binX(slot: number, bins: number): number {
  const gap = bins > 1 ? Math.min(RS.binGap, RS.binSpan / (bins - 1)) : 0;
  return 160 + (slot - (bins - 1) / 2) * gap;
}

/** How far through the current swap step (0 to 1). */
export const swapProgress = (s: RaccoonShuffleState): number =>
  s.phase === 'shuffle' ? Math.min(1, (s.time - s.phaseAt) / (s.steps[s.step]?.sec ?? 1)) : 0;
