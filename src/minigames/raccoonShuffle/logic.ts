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
 * - **The shuffle:** two bins swap places at a time; from Tier IV two pairs
 *   sometimes swap at once (each pair counts as a swap). A bin keeps its
 *   contents as it moves.
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
}

export type ShufflePhase = 'show' | 'shuffle' | 'pick' | 'open' | 'after';

export interface RaccoonShuffleOptions {
  tier: Tier;
  /** The Night setting ("auto": the tier's chance). */
  night?: 'auto' | 'on' | 'off';
  /** What each hiker carries (the raccoons steal from it). */
  packs: Readonly<Record<string, Pack>>;
}

export interface RaccoonShuffleState {
  tier: Tier;
  emptyCount: number;
  swapSec: number;
  night: boolean;
  packs: Readonly<Record<string, Pack>>;
  turns: Turns;
  /** This hiker's turn: the bins (by id), which bin stands in each slot, left to right. */
  bins: Bin[];
  slots: number[];
  /** The shuffle: each step's slot pairs (one, or two at once). */
  steps: [number, number][][];
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
export function fill(rng: RngState, tier: Tier, pack: Pack | undefined, emptyCount: number): Bin[] {
  const n = RS.tiers[tier].bins;
  const empties = new Set(
    shuffle(
      rng,
      Array.from({ length: n }, (_, i) => i),
    ).slice(0, emptyCount),
  );
  const units = shuffle(rng, packUnits(pack));
  return Array.from({ length: n }, (_, id) => {
    if (empties.has(id)) return { id, card: null };
    const unit = units.shift();
    return {
      id,
      card: unit ? { kind: 'resource' as const, id: unit } : { kind: 'energy' as const },
    };
  });
}

/**
 * The shuffle: the tier's swaps, a pair of slots at a time; from Tier IV two
 * pairs (never sharing a bin) sometimes swap at once.
 */
export function planSwaps(rng: RngState, tier: Tier, bins: number): [number, number][][] {
  const t = RS.tiers[tier];
  const steps: [number, number][][] = [];
  let left = t.swaps;
  const pair = (avoid: number[]): [number, number] => {
    const free = Array.from({ length: bins }, (_, i) => i).filter((i) => !avoid.includes(i));
    const [a, b] = shuffle(rng, free);
    return [Math.min(a!, b!), Math.max(a!, b!)];
  };
  while (left > 0) {
    const first = pair([]);
    if (left >= 2 && bins >= 4 && t.double > 0 && nextFloat(rng) < t.double) {
      steps.push([first, pair(first)]);
      left -= 2;
    } else {
      steps.push([first]);
      left -= 1;
    }
  }
  return steps;
}

/** A fresh turn for the hiker now up: a new fill and a new shuffle. */
function startTurn(s: RaccoonShuffleState, rng: RngState): RaccoonShuffleState {
  const id = current(s.turns);
  const bins = fill(rng, s.tier, id ? s.packs[id] : undefined, s.emptyCount);
  return {
    ...s,
    bins,
    slots: bins.map((b) => b.id),
    steps: planSwaps(rng, s.tier, bins.length),
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
    emptyCount: t.empty,
    swapSec: t.swapSec,
    night,
    packs: options.packs,
    turns: newTurns(order),
    bins: [],
    slots: [],
    steps: [],
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

/** Pick the bin in a slot (only while it's time to pick). */
export function pickBin(s: RaccoonShuffleState, slot: number): RaccoonShuffleState {
  if (s.over || s.phase !== 'pick' || !playing(s.turns)) return s;
  if (slot < 0 || slot >= s.slots.length) return s;
  return { ...s, picked: slot, selected: slot, phase: 'open', phaseAt: s.time };
}

/** Move the key selection left or right. */
export function select(s: RaccoonShuffleState, by: -1 | 1): RaccoonShuffleState {
  if (s.over || s.phase === 'open' || s.phase === 'after') return s;
  const selected = Math.min(s.slots.length - 1, Math.max(0, s.selected + by));
  return selected === s.selected ? s : { ...s, selected };
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
      if (since < RS.showSec) return s;
      return s.steps.length
        ? { ...s, phase: 'shuffle', phaseAt: s.time, step: 0 }
        : { ...s, phase: 'pick', phaseAt: s.time };
    case 'shuffle': {
      if (since < s.swapSec) return s;
      const pairs = s.steps[s.step] ?? [];
      const slots = swapped(s.slots, pairs);
      const step = s.step + 1;
      const swapsDone = s.swapsDone + pairs.length;
      if (step >= s.steps.length)
        return { ...s, slots, step, swapsDone, phase: 'pick', phaseAt: s.time };
      return { ...s, slots, step, swapsDone, phaseAt: s.time };
    }
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
  s.phase === 'shuffle' ? Math.min(1, (s.time - s.phaseAt) / s.swapSec) : 0;
