/**
 * Traildle (docs/design/11-minigames-puzzles.md, section 2): guess a hidden
 * code of digits on a row of trail signs. Pure and seeded.
 *
 * Hikers play in pairs, in line-up order (1 and 2, then 3 and 4; with 3
 * hikers 1 and 2, then 3 alone). Each hiker in a pair has their own code and
 * every guess goes into both boards (Quordle style). A solved board locks. A
 * hiker passes if their code is found before the pair runs out of guesses or
 * time.
 */
import { BALANCE } from '../../config/balance';
import { int, seedRng, shuffle } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passFailResult } from '../lineup';
import type { MinigameResult, Tier } from '../types';

const T = BALANCE.minigames.traildle;

export type { Tier };
/** Right digit in the right spot; right digit in the wrong spot; not in the code. */
export type Mark = 'right' | 'wrong' | 'none';
/** What's known about a digit on a board: nothing yet, not in the code, in it somewhere, in a right spot. */
export type Knowledge = 'unknown' | 'absent' | 'present' | 'right';

export interface TraildleOptions {
  tier: Tier;
  /** The testing tab's override: Auto (the tier's range) or an exact number of signs. */
  signs: 'auto' | number;
  /** The testing tab's override: Auto (the tier's), On or Off. */
  timer: 'auto' | 'on' | 'off';
  /** Prepare's +1 GUESS: guesses more for each pair. */
  extraGuesses?: number;
  /** Prepare's KNOCK ONE DOWN: a board passes with all but one sign right (24-challenges-reset.md, section 5). */
  knockOne?: boolean;
}

export interface Board {
  hikerId: string;
  code: number[];
  rows: { guess: number[]; marks: Mark[] }[];
  solved: boolean;
}

export interface TraildleState {
  options: TraildleOptions;
  order: string[];
  pairs: string[][];
  pairIndex: number;
  /** This pair: how many signs, whether codes repeat digits, how many guesses, the timer. */
  signs: number;
  repeats: boolean;
  guessesAllowed: number;
  guessCount: number;
  timerSec: number | null;
  timeLeft: number | null;
  boards: Board[];
  /** Playing, between pairs (the codes are shown), or over. */
  phase: 'playing' | 'pairDone' | 'over';
  results: Record<string, 'passed' | 'failed'>;
  rng: RngState;
}

/** Pairs in line-up order: 2 + 2, or 2 + 1. */
export function pairsOf(order: readonly string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < order.length; i += 2) out.push(order.slice(i, i + 2));
  return out;
}

/**
 * The marks for a guess (Wordle's rule): "right" first; then a digit in the
 * wrong spot gets "wrong" only as many times as the code has it left over.
 */
export function marks(code: readonly number[], guess: readonly number[]): Mark[] {
  const out: Mark[] = guess.map(() => 'none');
  const left = new Map<number, number>();
  guess.forEach((d, i) => {
    if (code[i] === d) out[i] = 'right';
    else left.set(code[i]!, (left.get(code[i]!) ?? 0) + 1);
  });
  guess.forEach((d, i) => {
    if (out[i] === 'right') return;
    const n = left.get(d) ?? 0;
    if (n > 0) {
      out[i] = 'wrong';
      left.set(d, n - 1);
    }
  });
  return out;
}

/** The numbers for a tier, with the testing tab's overrides. */
export function rulesFor(options: TraildleOptions): {
  signs: readonly [number, number];
  guesses: number;
  repeats: boolean;
  timerSec: number | null;
} {
  const tier = T.tiers[options.tier];
  const signs: readonly [number, number] =
    options.signs === 'auto' ? tier.signs : [options.signs, options.signs];
  const timerSec =
    options.timer === 'off'
      ? null
      : options.timer === 'on'
        ? (tier.timerSec ?? T.timerOnSec)
        : tier.timerSec;
  return {
    signs,
    guesses: tier.guesses + (options.extraGuesses ?? 0),
    repeats: tier.repeats,
    timerSec,
  };
}

function makeCode(rng: RngState, length: number, repeats: boolean): number[] {
  if (repeats) return Array.from({ length }, () => int(rng, 0, 9));
  return shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, Math.min(10, length));
}

function startPair(s: TraildleState, index: number): TraildleState {
  const rng = [...s.rng] as RngState;
  const rules = rulesFor(s.options);
  const signs = int(rng, rules.signs[0], rules.signs[1]);
  const pair = s.pairs[index] ?? [];
  return {
    ...s,
    rng,
    pairIndex: index,
    signs,
    repeats: rules.repeats,
    guessesAllowed: rules.guesses + (pair.length > 1 ? T.twoCodeExtraGuesses : 0),
    guessCount: 0,
    timerSec: rules.timerSec,
    timeLeft: rules.timerSec,
    boards: pair.map((hikerId) => ({
      hikerId,
      code: makeCode(rng, signs, rules.repeats),
      rows: [],
      solved: false,
    })),
    phase: 'playing',
  };
}

export function newTraildle(
  options: TraildleOptions,
  order: readonly string[],
  seed: number,
): TraildleState {
  const base: TraildleState = {
    options,
    order: [...order],
    pairs: pairsOf(order),
    pairIndex: 0,
    signs: 0,
    repeats: false,
    guessesAllowed: 0,
    guessCount: 0,
    timerSec: null,
    timeLeft: null,
    boards: [],
    phase: 'playing',
    results: {},
    rng: seedRng(seed),
  };
  return base.pairs.length ? startPair(base, 0) : { ...base, phase: 'over' };
}

/** The pair is over: every board passes if it was solved, or fails. */
function endPair(s: TraildleState): TraildleState {
  const results = { ...s.results };
  for (const b of s.boards) results[b.hikerId] = b.solved ? 'passed' : 'failed';
  return { ...s, results, phase: 'pairDone' };
}

/** A guess fills every sign; digits may repeat even when the code can't. */
export const canSubmit = (s: TraildleState, guess: readonly (number | null)[]): boolean =>
  s.phase === 'playing' &&
  guess.length === s.signs &&
  guess.every((d) => d !== null && Number.isInteger(d) && d >= 0 && d <= 9);

/** Check a guess: it goes into every board not solved yet. */
export function submit(s: TraildleState, guess: readonly (number | null)[]): TraildleState {
  if (!canSubmit(s, guess)) return s;
  const digits = guess as number[];
  const boards = s.boards.map((b) => {
    if (b.solved) return b;
    const m = marks(b.code, digits);
    return {
      ...b,
      rows: [...b.rows, { guess: [...digits], marks: m }],
      solved: m.filter((x) => x !== 'right').length <= (s.options.knockOne ? 1 : 0),
    };
  });
  const next = { ...s, boards, guessCount: s.guessCount + 1 };
  const done = boards.every((b) => b.solved) || next.guessCount >= s.guessesAllowed;
  return done ? endPair(next) : next;
}

/** Time passes. When the pair's timer runs out, every board not solved fails. */
export function tick(s: TraildleState, seconds: number): TraildleState {
  if (s.phase !== 'playing' || s.timeLeft === null) return s;
  const timeLeft = Math.max(0, s.timeLeft - seconds);
  const next = { ...s, timeLeft };
  return timeLeft <= 0 ? endPair(next) : next;
}

/** After a pair: the next pair, with new codes, or the end. */
export function nextPair(s: TraildleState): TraildleState {
  if (s.phase !== 'pairDone') return s;
  const i = s.pairIndex + 1;
  return i < s.pairs.length ? startPair(s, i) : { ...s, phase: 'over' };
}

/**
 * What a board's marks say about each digit 0 to 9 (the digit strip): right
 * somewhere beats in the code somewhere, which beats not in the code.
 */
export function digitKnowledge(board: Board): Knowledge[] {
  const out: Knowledge[] = Array.from({ length: 10 }, () => 'unknown');
  const rank: Record<Knowledge, number> = { unknown: 0, absent: 1, present: 2, right: 3 };
  for (const row of board.rows) {
    row.guess.forEach((d, i) => {
      const m = row.marks[i];
      const k: Knowledge = m === 'right' ? 'right' : m === 'wrong' ? 'present' : 'absent';
      // "Not in the code" only counts if nothing else ever said it was.
      if (k === 'absent' && out[d] !== 'unknown') return;
      if (rank[k] > rank[out[d]!] || (out[d] === 'absent' && k !== 'absent')) out[d] = k;
    });
  }
  return out;
}

export function result(s: TraildleState): MinigameResult {
  return passFailResult(s.order, (id) => s.results[id] === 'passed');
}
