/**
 * Pack It Up (docs/design/23-minigames-final.md, section 8; Claude's idea,
 * Wyatt approved): fit the gear into a torn pack before time runs out. One
 * hiker at a time, each with their own pack. Pure and seeded.
 *
 * - **The pack:** a grid by tier with a few torn cells that can't hold
 *   anything, and (Tiers I and II) a spare cell or two; from Tier III the
 *   gear fills it exactly.
 * - **The gear:** the puzzle is made by cutting the free cells into pieces
 *   of 1 to [4] cells ([5] from Tier IV), so it can always be solved; then
 *   the pieces are shuffled and turned at random into the tray.
 * - **Moves:** place a piece (it snaps to the grid, and can't overlap
 *   anything or cover a torn cell), take it back out, or turn it.
 * - **Results:** everything packed in time passes; otherwise that hiker
 *   fails and loses [1] energy, and the pieces left out are what the
 *   challenge's stake uses (Torn Pack: lost resources).
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
import type { MinigameResult, Tier } from '../types';

const PU = BALANCE.minigames.packItUp;

export interface Cell {
  col: number;
  row: number;
}

export interface Piece {
  id: number;
  /** Its cells at no turn, from its top-left (0, 0). */
  cells: Cell[];
  /** Quarter turns clockwise (0 to 3). */
  rot: number;
  gear: string;
  /** Where it sits in the pack (its turned cells' top-left), if placed. */
  at: Cell | null;
  /** The cut it was made from: where it fits, and at what turn (for checking, and the bot). */
  home: Cell;
  homeRot: number;
}

export interface PackItUpOptions {
  tier: Tier;
  /** The pack's size ("auto": the tier's), and spare cells ("auto": the tier's). */
  size?: readonly [number, number] | 'auto';
  spare?: number | 'auto';
  /** Prepare: more seconds, one more spare cell (Backpack), the biggest piece in the sack. */
  extraSec?: number;
  extraSpare?: number;
  sack?: boolean;
}

export interface PackItUpState {
  tier: Tier;
  turns: Turns;
  cols: number;
  rows: number;
  torn: boolean[];
  pieces: Piece[];
  /** The biggest piece went in the sack (Prepare): its id. */
  sacked: number | null;
  timeSec: number;
  timeLeft: number;
  /** Each finished hiker's pieces left out. */
  leftOut: Record<string, number>;
  options: PackItUpOptions;
  /** The seed for each hiker's pack. */
  seed: number;
  time: number;
  over: boolean;
  rng: RngState;
}

/** A shape's cells turned `rot` quarter turns clockwise, moved back to (0, 0). */
export function turned(cells: readonly Cell[], rot: number): Cell[] {
  let out = cells.map((c) => ({ ...c }));
  for (let k = 0; k < ((rot % 4) + 4) % 4; k++) out = out.map((c) => ({ col: -c.row, row: c.col }));
  const minC = Math.min(...out.map((c) => c.col));
  const minR = Math.min(...out.map((c) => c.row));
  return out.map((c) => ({ col: c.col - minC, row: c.row - minR }));
}

/** A piece's cells where it sits (or would sit at `at`). */
export const cellsAt = (p: Piece, at: Cell, rot = p.rot): Cell[] =>
  turned(p.cells, rot).map((c) => ({ col: c.col + at.col, row: c.row + at.row }));

const key = (c: Cell) => `${c.col},${c.row}`;

/**
 * Cuts the free cells into pieces of 1 to `most` cells: grow each piece
 * from a free cell by random neighbors. The cut is the solution.
 */
export function cutPieces(
  rng: RngState,
  cols: number,
  rows: number,
  blocked: ReadonlySet<string>,
  most: number,
): { cells: Cell[] }[] {
  const free = new Set<string>();
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) if (!blocked.has(`${c},${r}`)) free.add(`${c},${r}`);
  const out: { cells: Cell[] }[] = [];
  const order = shuffle(rng, [...free]);
  for (const start of order) {
    if (!free.has(start)) continue;
    const [c0, r0] = start.split(',').map(Number) as [number, number];
    const target = PU.sizes[Math.floor(nextFloat(rng) * PU.sizes.length)]!;
    const piece: Cell[] = [{ col: c0, row: r0 }];
    free.delete(start);
    while (piece.length < Math.min(target, most)) {
      const edge = piece.flatMap((c) =>
        [
          { col: c.col + 1, row: c.row },
          { col: c.col - 1, row: c.row },
          { col: c.col, row: c.row + 1 },
          { col: c.col, row: c.row - 1 },
        ].filter((n) => free.has(key(n))),
      );
      if (!edge.length) break;
      const n = edge[Math.floor(nextFloat(rng) * edge.length)]!;
      free.delete(key(n));
      piece.push(n);
    }
    out.push({ cells: piece });
  }
  return out;
}

/** A new pack (and gear) for the hiker now up. */
function packFor(s: Pick<PackItUpState, 'tier' | 'options' | 'seed'>, k: number) {
  const t = PU.tiers[s.tier];
  const rng = seedRng(s.seed * 31 + k * 7 + 1);
  const [cols, rows] =
    s.options.size && s.options.size !== 'auto' ? s.options.size : [t.cols, t.rows];
  const cells = Array.from({ length: cols * rows }, (_, i) => ({
    col: i % cols,
    row: Math.floor(i / cols),
  }));
  const mixed = shuffle(rng, cells);
  const tornN = Math.min(t.torn, cols * rows - 2);
  const spare =
    (typeof s.options.spare === 'number' ? s.options.spare : t.spare) + (s.options.extraSpare ?? 0);
  const torn = new Set(mixed.slice(0, tornN).map(key));
  const spares = new Set(mixed.slice(tornN, tornN + Math.max(0, spare)).map(key));
  const most = s.tier >= PU.fiveFrom ? 5 : 4;
  const cut = cutPieces(rng, cols, rows, new Set([...torn, ...spares]), most);
  const pieces: Piece[] = shuffle(
    rng,
    cut.map((p, i) => {
      const minC = Math.min(...p.cells.map((c) => c.col));
      const minR = Math.min(...p.cells.map((c) => c.row));
      const shape = p.cells.map((c) => ({ col: c.col - minC, row: c.row - minR }));
      const rot = Math.floor(nextFloat(rng) * 4);
      // Stored at a random turn: undoing it gets back to the cut.
      return {
        id: i,
        cells: turned(shape, (4 - rot) % 4),
        rot: 0,
        gear: PU.gear[
          Math.min(PU.gear.length - 1, shape.length - 1 + Math.floor(nextFloat(rng) * 2))
        ]!,
        at: null,
        home: { col: minC, row: minR },
        homeRot: rot,
      };
    }),
  );
  // Draw each shape at a random turn in the tray.
  const tray = pieces.map((p) => ({ ...p, rot: Math.floor(nextFloat(rng) * 4) }));
  const biggest = s.options.sack
    ? ([...tray].sort((a, b) => b.cells.length - a.cells.length)[0]?.id ?? null)
    : null;
  return {
    cols,
    rows,
    torn: cells.map((c) => torn.has(key(c))),
    pieces: tray,
    sacked: biggest,
  };
}

export function newPackItUp(
  options: PackItUpOptions,
  order: readonly string[],
  seed: number,
): PackItUpState {
  const t = PU.tiers[options.tier];
  const timeSec = t.timeSec + (options.extraSec ?? 0);
  const base = { tier: options.tier, options, seed };
  return {
    ...base,
    turns: newTurns(order),
    ...packFor(base, 0),
    timeSec,
    timeLeft: timeSec,
    leftOut: {},
    time: 0,
    over: order.length === 0,
    rng: seedRng(seed),
  };
}

/** The hiker packing now. */
export const packer = (s: PackItUpState): string | undefined => current(s.turns);

/** Whether a piece fits at a spot: inside the pack, off the torn cells, overlapping nothing else. */
export function fits(s: PackItUpState, id: number, at: Cell, rot?: number): boolean {
  const p = s.pieces.find((x) => x.id === id);
  if (!p) return false;
  const taken = new Set(
    s.pieces.filter((x) => x.at && x.id !== id).flatMap((x) => cellsAt(x, x.at!).map(key)),
  );
  return cellsAt(p, at, rot ?? p.rot).every(
    (c) =>
      c.col >= 0 &&
      c.row >= 0 &&
      c.col < s.cols &&
      c.row < s.rows &&
      !s.torn[c.row * s.cols + c.col] &&
      !taken.has(key(c)),
  );
}

const live = (s: PackItUpState) => !s.over && playing(s.turns);

/** Everything packed (the sacked piece counts as packed). */
export const packed = (s: PackItUpState): boolean =>
  s.pieces.every((p) => p.at !== null || p.id === s.sacked);

/** The hiker's turn ends: passed if everything's packed. The next hiker gets a new pack. */
function finish(s: PackItUpState, passed: boolean): PackItUpState {
  const who = packer(s);
  const left = s.pieces.filter((p) => p.at === null && p.id !== s.sacked).length;
  const turns = endTurn(s.turns, passed);
  const next = { ...s, turns, leftOut: who ? { ...s.leftOut, [who]: left } : s.leftOut };
  if (allDone(turns)) return { ...next, over: true };
  return { ...next, ...packFor(s, turns.at), timeLeft: s.timeSec };
}

/** Place (or move) a piece in the pack; nothing happens if it doesn't fit. */
export function place(s: PackItUpState, id: number, at: Cell): PackItUpState {
  if (!live(s) || id === s.sacked || !fits(s, id, at)) return s;
  const next = { ...s, pieces: s.pieces.map((p) => (p.id === id ? { ...p, at } : p)) };
  return packed(next) ? finish(next, true) : next;
}

/** Take a piece back out to the tray. */
export function takeOut(s: PackItUpState, id: number): PackItUpState {
  if (!live(s)) return s;
  return { ...s, pieces: s.pieces.map((p) => (p.id === id ? { ...p, at: null } : p)) };
}

/** Turn a piece a quarter clockwise (in the pack, only if it still fits there). */
export function turn(s: PackItUpState, id: number): PackItUpState {
  const p = s.pieces.find((x) => x.id === id);
  if (!live(s) || !p) return s;
  const rot = (p.rot + 1) % 4;
  if (p.at && !fits(s, id, p.at, rot)) return s;
  return { ...s, pieces: s.pieces.map((x) => (x.id === id ? { ...x, rot } : x)) };
}

export function tick(s0: PackItUpState, dt: number): PackItUpState {
  if (s0.over) return s0;
  const s: PackItUpState = { ...s0, time: s0.time + dt, turns: tickTurns(s0.turns, dt) };
  if (!playing(s.turns)) return s;
  const timeLeft = s.timeLeft - dt;
  return timeLeft > 0 ? { ...s, timeLeft } : finish({ ...s, timeLeft: 0 }, false);
}

/** Everything packed in time passes; otherwise [1] energy (the challenge's stake uses the pieces left out). */
export const result = (s: PackItUpState): MinigameResult =>
  quickResult(s.turns.order, (id) => s.turns.done[id] === true);
