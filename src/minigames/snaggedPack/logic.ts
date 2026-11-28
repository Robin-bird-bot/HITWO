/**
 * Snagged Pack (docs/design/30-quick-minigames.md, section 4): each hiker's
 * pack is snagged. Colored ropes run from socket to socket; drag each rope
 * to its matching socket without crossing another. Like the puzzle game Flow.
 *
 * - One hiker at a time, in line order, each with a new board (`boards.ts`)
 *   and their own clock. A hiker passes when every pair is joined in time.
 * - Dragging from a socket starts its rope there (clearing what was there);
 *   the rope follows cell by cell (up, down, left, right). It won't go into a
 *   cell another rope or another color's socket is in: it stops at the edge.
 * - Dragging back along the rope shortens it; grabbing a rope's cell picks it
 *   up from there. Reaching the matching socket joins it. Tapping a rope
 *   clears it. The cells don't all have to be filled.
 * - Prepare: FOOD adds seconds, SORTED starts a pair joined for every hiker,
 *   a LUCKY CHARM gives each hiker one hint (a rope's path, for a moment),
 *   and a SACK takes a pair away.
 *
 * Pure and seeded. Cells are numbered row by row (`boards.ts`).
 */
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
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
import type { MinigameResult, Tier } from '../types';
import { makeBoard, nextTo, xy, type Board, type Pair } from './boards';

const SP = BALANCE.minigames.snaggedPack;

export interface SnaggedOptions {
  tier: Tier;
  /** The Clock setting, seconds per hiker ("auto": the tier's). */
  clockSec?: number | 'auto';
  /** Prepare: seconds added, pairs started joined, hints, pairs taken away. */
  extraSec?: number;
  sorted?: number;
  hints?: number;
  fewer?: number;
}

export interface SnaggedState {
  tier: Tier;
  size: number;
  pairCount: number;
  clockSec: number;
  sorted: number;
  hints: number;
  turns: Turns;
  /** This hiker's board, and their ropes by color (from the socket they started at). */
  board: Board;
  ropes: Readonly<Record<number, readonly number[]>>;
  /** The rope being dragged now. */
  drag: number | null;
  timeLeft: number;
  hintsLeft: number;
  /** A rope's path showing (a hint), until then. */
  hint: { color: number; until: number } | null;
  lastJoin?: { at: number; color: number };
  /** Each hiker's pairs joined, once done. */
  record: Readonly<Record<string, number>>;
  time: number;
  over: boolean;
  rng: RngState;
}

export const pairOf = (s: SnaggedState, color: number): Pair | undefined =>
  s.board.pairs.find((p) => p.color === color);

/** The socket in a cell (its pair), if any. */
export const socketAt = (s: SnaggedState, cell: number): Pair | undefined =>
  s.board.pairs.find((p) => p.a === cell || p.b === cell);

/** The rope going through a cell (its color), if any. */
export function ropeAt(s: SnaggedState, cell: number): number | null {
  for (const [c, cells] of Object.entries(s.ropes)) if (cells.includes(cell)) return Number(c);
  return null;
}

/** Whether a color's rope runs from one of its sockets to the other. */
export function joined(s: SnaggedState, color: number): boolean {
  const p = pairOf(s, color);
  const r = s.ropes[color];
  if (!p || !r || r.length < 2) return false;
  const ends = [r[0], r[r.length - 1]];
  return ends.includes(p.a) && ends.includes(p.b);
}

export const joinedCount = (s: SnaggedState): number =>
  s.board.pairs.filter((p) => joined(s, p.color)).length;

function startTurn(s: SnaggedState): SnaggedState {
  const rng: RngState = [...s.rng];
  const board = makeBoard(s.size, s.pairCount, rng);
  // SORTED: the first pairs start joined (their answer drawn in).
  const ropes: Record<number, readonly number[]> = {};
  for (const p of board.pairs.slice(0, Math.min(s.sorted, board.pairs.length - 1)))
    ropes[p.color] = p.path;
  return {
    ...s,
    board,
    ropes,
    drag: null,
    timeLeft: s.clockSec,
    hintsLeft: s.hints,
    hint: null,
    lastJoin: undefined,
    rng,
  };
}

export function newSnaggedPack(
  options: SnaggedOptions,
  order: readonly string[],
  seed: number,
): SnaggedState {
  const t = SP.tiers[options.tier];
  const pairCount = Math.max(2, t.pairs - Math.max(0, options.fewer ?? 0));
  const clockSec =
    (typeof options.clockSec === 'number' ? options.clockSec : t.clockSec) +
    Math.max(0, options.extraSec ?? 0);
  const s: SnaggedState = {
    tier: options.tier,
    size: t.size,
    pairCount,
    clockSec,
    sorted: Math.max(0, options.sorted ?? 0),
    hints: Math.max(0, options.hints ?? 0),
    turns: newTurns(order),
    board: { size: t.size, pairs: [] },
    ropes: {},
    drag: null,
    timeLeft: clockSec,
    hintsLeft: 0,
    hint: null,
    record: {},
    time: 0,
    over: order.length === 0,
    rng: seedRng(seed),
  };
  return s.over ? s : startTurn(s);
}

function finish(s: SnaggedState, passed: boolean): SnaggedState {
  const id = current(s.turns);
  const record = id ? { ...s.record, [id]: joinedCount(s) } : s.record;
  const turns = endTurn(s.turns, passed);
  const next = { ...s, record, turns, drag: null };
  if (allDone(turns)) return { ...next, over: true };
  return startTurn(next);
}

const canPlay = (s: SnaggedState) => !s.over && playing(s.turns);

/**
 * Pointer down on a cell. On a socket: its rope starts there (or, with a hint
 * waiting, the hint shows that rope's path instead). On a rope: it's picked
 * up from that cell. Anywhere else: nothing.
 */
export function grab(s: SnaggedState, cell: number): SnaggedState {
  if (!canPlay(s)) return s;
  const socket = socketAt(s, cell);
  if (socket) return { ...s, ropes: { ...s.ropes, [socket.color]: [cell] }, drag: socket.color };
  const color = ropeAt(s, cell);
  if (color === null) return s;
  const r = s.ropes[color]!;
  return { ...s, ropes: { ...s.ropes, [color]: r.slice(0, r.indexOf(cell) + 1) }, drag: color };
}

/** One step of the rope being dragged, into a cell next to its end. */
function step(s: SnaggedState, cell: number): SnaggedState {
  const color = s.drag;
  if (color === null) return s;
  const r = s.ropes[color] ?? [];
  const head = r[r.length - 1];
  if (head === undefined || !nextTo(s.size, head, cell)) return s;
  // Back along the rope: it shortens.
  const back = r.indexOf(cell);
  if (back >= 0) return { ...s, ropes: { ...s.ropes, [color]: r.slice(0, back + 1) } };
  const socket = socketAt(s, cell);
  if (socket) {
    if (socket.color !== color) return s;
    // The matching socket: it joins, with a click.
    const out: SnaggedState = {
      ...s,
      ropes: { ...s.ropes, [color]: [...r, cell] },
      drag: null,
      lastJoin: { at: s.time, color },
    };
    return joinedCount(out) === out.board.pairs.length ? finish(out, true) : out;
  }
  if (ropeAt(s, cell) !== null) return s;
  return { ...s, ropes: { ...s.ropes, [color]: [...r, cell] } };
}

/**
 * The pointer moves over a cell while dragging: the rope steps toward it a
 * cell at a time (along the longer way first), stopping where it can't go.
 */
export function dragTo(s0: SnaggedState, cell: number): SnaggedState {
  let s = s0;
  for (let guard = 0; guard < s0.size * 2 && s.drag !== null; guard++) {
    const r = s.ropes[s.drag] ?? [];
    const head = r[r.length - 1];
    if (head === undefined || head === cell) break;
    const a = xy(s.size, head);
    const b = xy(s.size, cell);
    const across = b.x !== a.x ? head + Math.sign(b.x - a.x) : null;
    const down = b.y !== a.y ? head + Math.sign(b.y - a.y) * s.size : null;
    const ways = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? [across, down] : [down, across];
    let moved = false;
    for (const next of ways) {
      if (next === null) continue;
      const out = step(s, next);
      if (out !== s) {
        s = out;
        moved = true;
        break;
      }
    }
    if (!moved) break;
  }
  return s;
}

/** The pointer is let go: the rope stays where it got to (a lone socket is no rope). */
export function release(s: SnaggedState): SnaggedState {
  if (s.drag === null) return s;
  const r = s.ropes[s.drag];
  if (r && r.length > 1) return { ...s, drag: null };
  const ropes = { ...s.ropes };
  delete ropes[s.drag];
  return { ...s, ropes, drag: null };
}

/** A tap on a rope: it's cleared. */
export function clearRope(s: SnaggedState, color: number): SnaggedState {
  if (!canPlay(s) || !(color in s.ropes)) return s;
  const ropes = { ...s.ropes };
  delete ropes[color];
  return { ...s, ropes, drag: s.drag === color ? null : s.drag };
}

/** A LUCKY CHARM's hint: a rope's path shows for a moment (once each). */
export function showHint(s: SnaggedState, color: number): SnaggedState {
  if (!canPlay(s) || s.hintsLeft <= 0 || !pairOf(s, color)) return s;
  return { ...s, hintsLeft: s.hintsLeft - 1, hint: { color, until: s.time + SP.hintSec } };
}

export function tick(s0: SnaggedState, dt: number): SnaggedState {
  if (s0.over) return s0;
  const s: SnaggedState = { ...s0, time: s0.time + dt, turns: tickTurns(s0.turns, dt) };
  const hint = s.hint && s.time < s.hint.until ? s.hint : null;
  if (!playing(s.turns)) return { ...s, hint };
  const timeLeft = s.timeLeft - dt;
  if (timeLeft <= 0) return finish({ ...s, hint, timeLeft: 0 }, false);
  return { ...s, hint, timeLeft };
}

/** Who passed (every pair joined in time); those who failed lose [1] energy. */
export const result = (s: SnaggedState): MinigameResult =>
  quickResult(s.turns.order, (id) => s.turns.done[id] === true);
