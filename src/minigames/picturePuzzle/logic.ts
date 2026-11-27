/**
 * Picture Puzzle (docs/design/13-minigames-puzzles-2.md, section 3): rebuild
 * a picture from pieces stacked in a tray. Pure and seeded.
 *
 * - **Pairs:** hikers play in pairs in line order (1 and 2, then 3 and 4;
 *   with 3 hikers, 1 and 2, then 3 alone). Each hiker has their own picture
 *   (never the same one twice in a game), and a pair shares one tray.
 * - **The tray:** piles with every piece of the round shuffled in. Only the
 *   top piece of a pile can be taken; taking it shows the next one.
 * - **Moving:** a pile's top piece goes onto any empty cell (onto a filled
 *   one, they swap and the cell's piece goes on top of that pile); a piece
 *   in a grid can move to another cell (swapping) or back onto any pile.
 *   Locked pieces stay put. On Tier I, a piece dropped in its own spot locks.
 * - **The clock:** seconds per piece × the round's pieces. The first time a
 *   piece lands in its own spot, the clock gains the right-spot bonus (Nov
 *   25); moving it out and back in doesn't add more.
 * - **Done:** when every piece of a picture is in its own spot, it locks and
 *   its hiker passes. When the clock runs out, unfinished pictures fail.
 */
import { BALANCE } from '../../config/balance';
import { seedRng, shuffle } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passFailResult } from '../lineup';
import type { MinigameResult, Tier } from '../types';

const P = BALANCE.minigames.picturePuzzle;

export type { Tier };
export type PictureName = (typeof P.pictures)[number];

/** A piece: which of the round's pictures it's from, and its own cell there. */
export interface Piece {
  picture: number;
  cell: number;
}

/** Where a piece can be: on a pile, or in a cell of one of the round's pictures. */
export type Spot = { kind: 'pile'; pile: number } | { kind: 'cell'; picture: number; cell: number };

export interface PicturePuzzleState {
  tier: Tier;
  grid: 4 | 5 | 6;
  secPerPiece: number;
  /** Prepare's +10 S: seconds more each round. */
  extraSec: number;
  /** Prepare's CORNERS: each picture's four corners start in place (24-challenges-reset.md, section 5). */
  corners: boolean;
  /** What a piece's first landing in its own spot adds to the clock. */
  rightSpotSec: number;
  order: string[];
  /** The pairs, in order, and which one is playing. */
  rounds: string[][];
  round: number;
  /** Each hiker's picture for the whole game. */
  pictureOf: Record<string, PictureName>;
  /** This round: its hikers' pictures (one or two), the pieces, the piles (top last) and the grids. */
  pieces: Piece[];
  piles: number[][];
  grids: (number | null)[][];
  locked: boolean[];
  done: boolean[];
  /** This round's clock: what it started at, what's left, and seconds played. */
  timeSec: number;
  timeLeft: number;
  elapsed: number;
  /** This round's pieces that have already earned the right-spot bonus. */
  bonused: boolean[];
  /** The last bonus, to show over its piece ("+2 S"), and when (in `elapsed`). */
  bonusNote?: { sec: number; picture: number; cell: number; at: number };
  results: Record<string, 'passed' | 'failed'>;
  /** Playing; this round is over (between rounds); the game is over. */
  phase: 'play' | 'between' | 'over';
  rng: RngState;
}

export interface PicturePuzzleOptions {
  tier: Tier;
  grid?: 'auto' | 4 | 5 | 6;
  secPerPiece?: 'auto' | number;
  rightSpotSec?: 'auto' | number;
  /** The testing tab's Picture: the first hiker's photo (the others are different ones). */
  picture?: 'random' | PictureName;
  /** Prepare's +10 S: seconds more each round. */
  extraSec?: number;
  /** Prepare's CORNERS: each picture's four corners start in place. */
  corners?: boolean;
}

export const isPictureName = (v: unknown): v is PictureName =>
  (P.pictures as readonly unknown[]).includes(v);

/** Hikers in pairs, in line order. */
export const pairsOf = (order: readonly string[]): string[][] =>
  Array.from({ length: Math.ceil(order.length / 2) }, (_, i) => order.slice(i * 2, i * 2 + 2));

/** The hikers playing this round. */
export const playing = (s: PicturePuzzleState): string[] => s.rounds[s.round] ?? [];

function startRound(s: PicturePuzzleState, round: number): PicturePuzzleState {
  const who = s.rounds[round];
  // No more pairs: it's over, still showing the last round.
  if (!who) return { ...s, phase: 'over' };
  const rng = [...s.rng] as RngState;
  const cells = s.grid * s.grid;
  const pieces: Piece[] = who.flatMap((_, picture) =>
    Array.from({ length: cells }, (_, cell) => ({ picture, cell })),
  );
  const pileCount = P.tiers[s.tier].piles;
  const piles: number[][] = Array.from({ length: pileCount }, () => []);
  // CORNERS: each picture's four corner pieces start in their spots, locked.
  const g = s.grid;
  const cornerCells = new Set([0, g - 1, g * (g - 1), g * g - 1]);
  const placed = (id: number) => s.corners && cornerCells.has(pieces[id]!.cell);
  shuffle(
    rng,
    pieces.map((_, id) => id).filter((id) => !placed(id)),
  ).forEach((id, k) => piles[k % pileCount]!.push(id));
  const grids: (number | null)[][] = who.map(() => Array.from({ length: cells }, () => null));
  pieces.forEach((p, id) => {
    if (placed(id)) grids[p.picture]![p.cell] = id;
  });
  return {
    ...s,
    rng,
    round,
    pieces,
    piles,
    grids,
    locked: pieces.map((_, id) => placed(id)),
    done: who.map(() => false),
    timeSec: s.secPerPiece * pieces.length + s.extraSec,
    timeLeft: s.secPerPiece * pieces.length + s.extraSec,
    elapsed: 0,
    bonused: pieces.map((_, id) => placed(id)),
    bonusNote: undefined,
    phase: 'play',
  };
}

export function newPicturePuzzle(
  options: PicturePuzzleOptions,
  order: readonly string[],
  seed: number,
): PicturePuzzleState {
  const rng = seedRng(seed);
  const t = P.tiers[options.tier];
  const shuffled = shuffle(rng, P.pictures);
  // A picked photo goes first; the rest stay shuffled.
  const first = options.picture && isPictureName(options.picture) ? options.picture : undefined;
  const names = first ? [first, ...shuffled.filter((n) => n !== first)] : shuffled;
  const base: PicturePuzzleState = {
    tier: options.tier,
    grid: options.grid === 4 || options.grid === 5 || options.grid === 6 ? options.grid : t.grid,
    secPerPiece: typeof options.secPerPiece === 'number' ? options.secPerPiece : t.secPerPiece,
    extraSec: options.extraSec ?? 0,
    corners: !!options.corners,
    rightSpotSec: typeof options.rightSpotSec === 'number' ? options.rightSpotSec : t.rightSpotSec,
    order: [...order],
    rounds: pairsOf(order),
    round: 0,
    pictureOf: Object.fromEntries(order.map((id, i) => [id, names[i % names.length]!])),
    pieces: [],
    piles: [],
    grids: [],
    locked: [],
    done: [],
    timeSec: 0,
    timeLeft: 0,
    elapsed: 0,
    bonused: [],
    results: {},
    phase: 'play',
    rng,
  };
  return startRound(base, 0);
}

/** The piece at a spot: a pile's top piece, or what's in a cell. */
export function pieceAt(s: PicturePuzzleState, spot: Spot): number | null {
  if (spot.kind === 'pile') return s.piles[spot.pile]?.at(-1) ?? null;
  return s.grids[spot.picture]?.[spot.cell] ?? null;
}

const inOwnSpot = (s: PicturePuzzleState, id: number, picture: number, cell: number) =>
  s.pieces[id]!.picture === picture && s.pieces[id]!.cell === cell;

/** Whether a picture's every cell holds its own piece. */
export const complete = (s: PicturePuzzleState, picture: number): boolean =>
  (s.grids[picture] ?? []).every((id, cell) => id !== null && inOwnSpot(s, id, picture, cell));

/**
 * Moves a piece from one spot to another (see the file's notes). Anything
 * that isn't allowed (a locked piece, an empty spot, a pile to a pile)
 * changes nothing.
 */
export function move(s: PicturePuzzleState, from: Spot, to: Spot): PicturePuzzleState {
  if (s.phase !== 'play') return s;
  const id = pieceAt(s, from);
  if (id === null || s.locked[id]) return s;
  if (from.kind === 'pile' && to.kind === 'pile') return s;
  if (
    from.kind === 'cell' &&
    to.kind === 'cell' &&
    from.picture === to.picture &&
    from.cell === to.cell
  )
    return s;
  const piles = s.piles.map((p) => [...p]);
  const grids = s.grids.map((g) => [...g]);
  if (to.kind === 'cell') {
    const there = grids[to.picture]?.[to.cell];
    if (there === undefined || (there !== null && s.locked[there])) return s;
    // Take it from where it was.
    if (from.kind === 'pile') piles[from.pile]!.pop();
    else grids[from.picture]![from.cell] = null;
    // Whatever was there goes where it came from (the top of the pile, or the other cell).
    if (there !== null) {
      if (from.kind === 'pile') piles[from.pile]!.push(there);
      else grids[from.picture]![from.cell] = there;
    }
    grids[to.picture]![to.cell] = id;
  } else {
    if (!piles[to.pile] || from.kind !== 'cell') return s;
    grids[from.picture]![from.cell] = null;
    piles[to.pile]!.push(id);
  }
  return settle({ ...s, piles, grids });
}

/**
 * Gives the right-spot bonus to every piece in its own spot for the first
 * time, locks what's right (Tier I: single pieces; any tier: finished
 * pictures) and ends the round when both are done.
 */
function settle(s0: PicturePuzzleState): PicturePuzzleState {
  let s = s0;
  const bonused = [...s.bonused];
  s.grids.forEach((g, picture) =>
    g.forEach((id, cell) => {
      if (id === null || bonused[id] || !inOwnSpot(s, id, picture, cell)) return;
      bonused[id] = true;
      if (s.rightSpotSec > 0) {
        s = {
          ...s,
          timeLeft: s.timeLeft + s.rightSpotSec,
          bonusNote: { sec: s.rightSpotSec, picture, cell, at: s.elapsed },
        };
      }
    }),
  );
  s = { ...s, bonused };
  const locked = [...s.locked];
  if (s.tier <= P.lockCorrectUpTo) {
    s.grids.forEach((g, picture) =>
      g.forEach((id, cell) => {
        if (id !== null && inOwnSpot(s, id, picture, cell)) locked[id] = true;
      }),
    );
  }
  const done = s.grids.map((_, p) => s.done[p] || complete(s, p));
  const results = { ...s.results };
  done.forEach((d, p) => {
    if (!d) return;
    for (const id of s.grids[p]!) if (id !== null) locked[id] = true;
    results[playing(s)[p]!] = 'passed';
  });
  const finished = done.every(Boolean);
  return { ...s, locked, done, results, phase: finished ? 'between' : s.phase };
}

/** Time passes on the round's clock; when it runs out, unfinished pictures fail. */
export function tick(s: PicturePuzzleState, dt: number): PicturePuzzleState {
  if (s.phase !== 'play') return s;
  const next = { ...s, timeLeft: Math.max(0, s.timeLeft - dt), elapsed: s.elapsed + dt };
  return next.timeLeft <= 0 ? timeUp(next) : next;
}

/** The round's clock ran out: unfinished pictures fail. */
export function timeUp(s: PicturePuzzleState): PicturePuzzleState {
  if (s.phase !== 'play') return s;
  const results = { ...s.results };
  playing(s).forEach((id, p) => {
    if (!s.done[p]) results[id] = 'failed';
  });
  return { ...s, results, phase: 'between' };
}

/** On to the next pair, or the end. */
export const nextRound = (s: PicturePuzzleState): PicturePuzzleState =>
  s.phase === 'between' ? startRound(s, s.round + 1) : s;

export function result(s: PicturePuzzleState): MinigameResult {
  return passFailResult(s.order, (id) => s.results[id] === 'passed');
}
