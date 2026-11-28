/**
 * Snagged Pack's boards (docs/design/30-quick-minigames.md, section 4,
 * "Making boards"; Claude's idea): a random path that visits every cell once
 * (a snake, randomly reshaped), cut into pieces, one per color. Each piece's
 * two ends are a pair of sockets, so every board has an answer. Boards where
 * a pair sits right next to each other, or a piece is shorter than [3]
 * cells, are thrown away.
 *
 * Pure and seeded. Cells are numbered row by row: y * size + x.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';

const SP = BALANCE.minigames.snaggedPack;

export interface Pair {
  /** Its color (0, 1, 2…: the screen picks the colors). */
  color: number;
  a: number;
  b: number;
  /** The answer: the piece of the snake from a to b. */
  path: readonly number[];
}

export interface Board {
  size: number;
  pairs: readonly Pair[];
}

export const xy = (size: number, cell: number) => ({ x: cell % size, y: Math.floor(cell / size) });

/** The cells next to one (up, down, left, right) on the board. */
export function neighbors(size: number, cell: number): number[] {
  const { x, y } = xy(size, cell);
  const out: number[] = [];
  if (y > 0) out.push(cell - size);
  if (y < size - 1) out.push(cell + size);
  if (x > 0) out.push(cell - 1);
  if (x < size - 1) out.push(cell + 1);
  return out;
}

export const nextTo = (size: number, a: number, b: number): boolean =>
  neighbors(size, a).includes(b);

const randInt = (rng: RngState, n: number) => Math.min(n - 1, Math.floor(nextFloat(rng) * n));

/**
 * A random path through every cell: a snake (row by row, back and forth),
 * reshaped many times by "backbites": an end joins a cell next to it, and the
 * stretch after that cell turns around.
 */
export function randomSnake(size: number, rng: RngState): number[] {
  let path: number[] = [];
  for (let y = 0; y < size; y++)
    for (let k = 0; k < size; k++) path.push(y * size + (y % 2 === 0 ? k : size - 1 - k));
  const moves = SP.reshapes * size * size;
  for (let m = 0; m < moves; m++) {
    if (nextFloat(rng) < 0.5) path.reverse();
    const end = path[path.length - 1]!;
    const near = neighbors(size, end).filter((c) => c !== path[path.length - 2]);
    const pick = near[randInt(rng, near.length)];
    if (pick === undefined) continue;
    const at = path.indexOf(pick);
    path = [...path.slice(0, at + 1), ...path.slice(at + 1).reverse()];
  }
  return path;
}

/** Cuts the snake into `pairs` pieces, each at least [3] long; null when the cuts don't work out. */
function cut(path: readonly number[], pairs: number, rng: RngState): number[][] | null {
  const n = path.length;
  const spare = n - pairs * SP.shortest;
  if (spare < 0) return null;
  // Each piece gets the shortest, and the spare cells go out at random.
  const lengths = Array.from({ length: pairs }, () => SP.shortest);
  for (let k = 0; k < spare; k++) lengths[randInt(rng, pairs)]! += 1;
  const pieces: number[][] = [];
  let at = 0;
  for (const len of lengths) {
    pieces.push(path.slice(at, at + len));
    at += len;
  }
  return pieces;
}

/** A board with a pair per color, an answer, no pair side by side, and no piece shorter than [3]. */
export function makeBoard(size: number, pairs: number, rng: RngState): Board {
  for (let tries = 0; tries < 200; tries++) {
    const snake = randomSnake(size, rng);
    for (let k = 0; k < 20; k++) {
      const pieces = cut(snake, pairs, rng);
      if (!pieces) break;
      if (pieces.some((p) => nextTo(size, p[0]!, p[p.length - 1]!))) continue;
      // Colors in a random order, so the answer isn't in color order.
      const colors = Array.from({ length: pairs }, (_, c) => c);
      for (let c = colors.length - 1; c > 0; c--) {
        const j = randInt(rng, c + 1);
        [colors[c], colors[j]] = [colors[j]!, colors[c]!];
      }
      return {
        size,
        pairs: pieces
          .map((p, k) => ({ color: colors[k]!, a: p[0]!, b: p[p.length - 1]!, path: p }))
          .sort((x, y) => x.color - y.color),
      };
    }
  }
  throw new Error(`No ${size} × ${size} board with ${pairs} pairs`);
}
