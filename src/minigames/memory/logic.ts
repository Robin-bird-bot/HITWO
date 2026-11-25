/**
 * Memory Puzzle (docs/design/13-minigames-puzzles-2.md, section 2): flip
 * cards to find matching snacks. Pure and seeded.
 *
 * - **Sets:** each set of matching cards is a snack in one hiker's color.
 *   Sets are dealt to the hikers in turn, so the split is as even as it can
 *   be. A hiker never has the same snack twice, but two hikers can: Finn's
 *   orange and Mom's orange are different sets.
 * - **Play:** a preview with every card face up; from Tier II, a few visible
 *   swaps (and from Tier III one more after every miss); then cards are
 *   flipped one at a time. A try ends as soon as the face-up cards don't all
 *   match (a miss) or the set is complete (matched).
 * - **The clock** (Nov 25: no miss limit any more): it runs after the
 *   preview. A match adds time; from Tier II a miss takes some away, once
 *   per try.
 * - **The end:** every set matched, everyone passes. When the time runs
 *   out, each hiker who still has an unmatched set fails.
 *
 * Cards keep their ids when they swap places: `cards` maps each position to
 * a card (or to nothing, when the sets don't fill the grid).
 */
import { BALANCE } from '../../config/balance';
import { int, seedRng, shuffle } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { SNACKS, type Snack } from '../findObject/logic';
import { passFailResult } from '../lineup';
import type { MinigameResult, Tier } from '../types';

const M = BALANCE.minigames.memory;

export type { Tier };

export interface MemorySet {
  snack: Snack;
  hiker: string;
}

export interface MemoryState {
  tier: Tier;
  cols: number;
  rows: number;
  setSize: 2 | 3;
  sets: MemorySet[];
  /** Each card's set, by card id. */
  cardSet: number[];
  /** What's at each position (row by row): a card id, or nothing. */
  cards: (number | null)[];
  /** Card ids face up in the current try, in the order they were flipped. */
  up: number[];
  matched: boolean[];
  /** Preview; swaps showing; play; a miss showing; over. */
  phase: 'preview' | 'swaps' | 'play' | 'miss' | 'over';
  /** Swaps still to show, and how many come after each miss. */
  swapsLeft: number;
  swapsPerMiss: number;
  /** How long the preview shows. */
  previewSec: number;
  /** The clock: what it started at, what's left, and seconds played since the preview. */
  timeSec: number;
  timeLeft: number;
  elapsed: number;
  /** A match adds this much; a miss takes this much away. */
  matchSec: number;
  missSec: number;
  /** The last change to the clock ("+5 S", "−2 S"), and when (in `elapsed`). */
  clockNote?: { sec: number; at: number };
  order: string[];
  rng: RngState;
}

export interface MemoryOptions {
  tier: Tier;
  /** Match (Auto: the tier's), swaps (Auto, off, on), and the preview, time, match bonus and miss cost (Auto or seconds). */
  match?: 'auto' | 'pairs' | 'threes';
  swaps?: 'auto' | 'off' | 'on';
  preview?: 'auto' | number;
  time?: 'auto' | number;
  matchBonus?: 'auto' | number;
  missCost?: 'auto' | number;
}

const orAuto = (v: 'auto' | number | undefined, fallback: number) =>
  typeof v === 'number' ? v : fallback;

/** Deals the sets: to the hikers in turn, each hiker's snacks all different. */
export function dealSets(rng: RngState, count: number, order: readonly string[]): MemorySet[] {
  const bags = new Map(order.map((id) => [id, shuffle(rng, SNACKS)]));
  return Array.from({ length: count }, (_, i) => {
    const hiker = order[i % order.length]!;
    const bag = bags.get(hiker)!;
    return { hiker, snack: bag.shift() ?? SNACKS[i % SNACKS.length]! };
  });
}

export function newMemory(
  options: MemoryOptions,
  order: readonly string[],
  seed: number,
): MemoryState {
  const rng = seedRng(seed);
  const t = M.tiers[options.tier];
  const setSize: 2 | 3 = options.match === 'pairs' ? 2 : options.match === 'threes' ? 3 : t.setSize;
  const cells = t.cols * t.rows;
  const sets = dealSets(rng, Math.floor(cells / setSize), order);
  const cardSet = sets.flatMap((_, i) => Array.from({ length: setSize }, () => i));
  const ids = shuffle(
    rng,
    cardSet.map((_, id) => id),
  );
  const cards: (number | null)[] = [
    ...ids,
    ...Array.from({ length: cells - ids.length }, () => null),
  ];
  const swaps =
    options.swaps === 'off' ? 0 : options.swaps === 'on' ? t.swaps || M.swapsOnTier1 : t.swaps;
  const timeSec = orAuto(options.time, t.timeSec);
  return {
    tier: options.tier,
    cols: t.cols,
    rows: t.rows,
    setSize,
    sets,
    cardSet,
    cards,
    up: [],
    matched: cardSet.map(() => false),
    phase: order.length ? 'preview' : 'over',
    swapsLeft: swaps,
    swapsPerMiss: options.swaps === 'off' ? 0 : t.swapsPerMiss,
    previewSec: orAuto(options.preview, t.previewSec),
    timeSec,
    timeLeft: timeSec,
    elapsed: 0,
    matchSec: orAuto(options.matchBonus, t.matchSec),
    missSec: orAuto(options.missCost, t.missSec),
    order: [...order],
    rng,
  };
}

/** The preview is over: the swaps, if there are any, or play. */
export const previewDone = (s: MemoryState): MemoryState =>
  s.phase !== 'preview' ? s : { ...s, phase: s.swapsLeft > 0 ? 'swaps' : 'play' };

/** Positions of cards still face down and unmatched. */
const hidden = (s: MemoryState): number[] =>
  s.cards.flatMap((id, pos) => (id !== null && !s.matched[id] && !s.up.includes(id) ? [pos] : []));

/**
 * The next swap: two face-down cards trade places (they keep their ids, so
 * they can be seen sliding). After the last one, play goes on.
 */
export function nextSwap(s: MemoryState): { state: MemoryState; swapped?: [number, number] } {
  if (s.phase !== 'swaps') return { state: s };
  const spots = hidden(s);
  const swapsLeft = s.swapsLeft - 1;
  const phase = swapsLeft > 0 ? 'swaps' : 'play';
  if (spots.length < 2) return { state: { ...s, swapsLeft: 0, phase: 'play' } };
  const rng = [...s.rng] as RngState;
  const a = spots[int(rng, 0, spots.length - 1)]!;
  const others = spots.filter((p) => p !== a);
  const b = others[int(rng, 0, others.length - 1)]!;
  const cards = [...s.cards];
  [cards[a], cards[b]] = [cards[b]!, cards[a]!];
  return { state: { ...s, rng, cards, swapsLeft, phase }, swapped: [a, b] };
}

/** Whether the clock is running: after the preview, until it's over. */
export const clockRuns = (s: MemoryState): boolean =>
  s.phase === 'swaps' || s.phase === 'play' || s.phase === 'miss';

/** Time passes on the clock; when it runs out, it's over. */
export function tick(s: MemoryState, dt: number): MemoryState {
  if (!clockRuns(s)) return s;
  const timeLeft = Math.max(0, s.timeLeft - dt);
  const elapsed = s.elapsed + dt;
  return timeLeft <= 0
    ? { ...s, timeLeft, elapsed, up: [], phase: 'over' }
    : { ...s, timeLeft, elapsed };
}

/** The clock gains (or loses) time, with a note to show. */
const addTime = (s: MemoryState, sec: number): Partial<MemoryState> =>
  sec === 0 ? {} : { timeLeft: Math.max(0, s.timeLeft + sec), clockNote: { sec, at: s.elapsed } };

/**
 * Flips the card at a position. When the face-up cards don't all match,
 * it's a miss: the clock loses the miss cost (once for the try), and it's
 * shown, then `resolveMiss`. When they make a whole set, it's matched and
 * the clock gains the match bonus. Every set matched: it's over.
 */
export function flip(
  s: MemoryState,
  pos: number,
): { state: MemoryState; outcome?: 'match' | 'miss' } {
  const id = s.cards[pos];
  if (s.phase !== 'play' || id === null || id === undefined || s.matched[id] || s.up.includes(id))
    return { state: s };
  const up = [...s.up, id];
  const set = s.cardSet[up[0]!]!;
  if (up.some((c) => s.cardSet[c] !== set)) {
    const after = { ...s, up, phase: 'miss' as const, ...addTime(s, -s.missSec) };
    return {
      state: after.timeLeft <= 0 ? { ...after, up: [], phase: 'over' } : after,
      outcome: 'miss',
    };
  }
  if (up.length < s.setSize) return { state: { ...s, up } };
  const matched = s.matched.map((m, c) => m || up.includes(c));
  const done = matched.every(Boolean);
  return {
    state: { ...s, up: [], matched, phase: done ? 'over' : 'play', ...addTime(s, s.matchSec) },
    outcome: 'match',
  };
}

/** The miss has been seen: the cards flip back, and maybe more swaps come. */
export function resolveMiss(s: MemoryState): MemoryState {
  if (s.phase !== 'miss') return s;
  if (s.swapsPerMiss > 0) return { ...s, up: [], phase: 'swaps', swapsLeft: s.swapsPerMiss };
  return { ...s, up: [], phase: 'play' };
}

/** Time's up. */
export const timeUp = (s: MemoryState): MemoryState =>
  s.phase === 'over' ? s : { ...s, phase: 'over' };

/** How many sets a hiker still has to match. */
export const setsLeft = (s: MemoryState, hiker: string): number =>
  s.sets.filter(
    (set, i) => set.hiker === hiker && s.cardSet.some((c, id) => c === i && !s.matched[id]),
  ).length;

/** A hiker passes when all their sets are matched. */
export function result(s: MemoryState): MinigameResult {
  return passFailResult(s.order, (id) => setsLeft(s, id) === 0);
}
