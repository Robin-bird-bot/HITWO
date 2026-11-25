/**
 * Picture Puzzle (docs/design/13-minigames-puzzles-2.md, section 6): shared
 * piles, top pieces only, back onto piles, finishing, and Tier I locks.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import {
  complete,
  move,
  newPicturePuzzle,
  nextRound,
  pairsOf,
  pieceAt,
  result,
  timeUp,
  type PicturePuzzleState,
  type Spot,
} from './logic';

const P = BALANCE.minigames.picturePuzzle;
const HIKERS = ['finn', 'mom', 'ellie', 'wyatt'];
const cell = (picture: number, c: number): Spot => ({ kind: 'cell', picture, cell: c });
const pile = (k: number): Spot => ({ kind: 'pile', pile: k });

/** Puts every piece of the round in its own spot, taking from the piles' tops. */
function solveAll(s0: PicturePuzzleState): PicturePuzzleState {
  let s = s0;
  for (let guard = 0; guard < 500 && s.phase === 'play'; guard++) {
    const k = s.piles.findIndex((p) => p.length > 0);
    if (k < 0) break;
    const id = s.piles[k]!.at(-1)!;
    const piece = s.pieces[id]!;
    s = move(s, pile(k), cell(piece.picture, piece.cell));
  }
  return s;
}

describe('setting up', () => {
  it('pairs hikers in line order (3 hikers: 1 and 2, then 3)', () => {
    expect(pairsOf(HIKERS)).toEqual([
      ['finn', 'mom'],
      ['ellie', 'wyatt'],
    ]);
    expect(pairsOf(HIKERS.slice(0, 3))).toEqual([['finn', 'mom'], ['ellie']]);
  });

  it('two pictures share the piles; every piece is in a pile; pictures never repeat', () => {
    const s = newPicturePuzzle({ tier: 2 }, HIKERS, 1);
    expect(s.piles).toHaveLength(P.tiers[2].piles);
    const all = s.piles.flat().sort((a, b) => a - b);
    expect(all).toEqual(s.pieces.map((_, i) => i));
    expect(s.piles.some((p) => p.some((id) => s.pieces[id]!.picture === 0))).toBe(true);
    expect(s.piles.some((p) => p.some((id) => s.pieces[id]!.picture === 1))).toBe(true);
    const mixed = s.piles.some((p) => new Set(p.map((id) => s.pieces[id]!.picture)).size === 2);
    expect(mixed).toBe(true);
    expect(new Set(Object.values(s.pictureOf)).size).toBe(4);
    expect(s.timeSec).toBe(P.tiers[2].secPerPiece * 32);
  });

  it('the grid and seconds-per-piece settings', () => {
    const s = newPicturePuzzle({ tier: 1, grid: 5, secPerPiece: 2 }, ['finn'], 1);
    expect(s.grid).toBe(5);
    expect(s.pieces).toHaveLength(25);
    expect(s.timeSec).toBe(50);
    expect(newPicturePuzzle({ tier: 3 }, ['finn'], 1).grid).toBe(5);
  });
});

describe('moving pieces', () => {
  it('only a pile’s top piece can be taken, and taking it shows the next one', () => {
    const s = newPicturePuzzle({ tier: 2 }, ['finn'], 2);
    const top = s.piles[0]!.at(-1)!;
    const under = s.piles[0]!.at(-2)!;
    expect(pieceAt(s, pile(0))).toBe(top);
    const t = move(s, pile(0), cell(0, 0));
    expect(t.grids[0]![0]).toBe(top);
    expect(pieceAt(t, pile(0))).toBe(under);
  });

  it('pieces move between cells (swapping) and go back onto any pile', () => {
    let s = newPicturePuzzle({ tier: 2 }, ['finn'], 3);
    const a = s.piles[0]!.at(-1)!;
    s = move(s, pile(0), cell(0, 5));
    const b = s.piles[1]!.at(-1)!;
    s = move(s, pile(1), cell(0, 6));
    s = move(s, cell(0, 5), cell(0, 6));
    expect(s.grids[0]![5]).toBe(b);
    expect(s.grids[0]![6]).toBe(a);
    const height = s.piles[2]!.length;
    s = move(s, cell(0, 6), pile(2));
    expect(s.grids[0]![6]).toBeNull();
    expect(s.piles[2]).toHaveLength(height + 1);
    expect(pieceAt(s, pile(2))).toBe(a);
  });

  it('a pile piece dropped on a filled cell swaps, and the cell’s piece goes on that pile', () => {
    let s = newPicturePuzzle({ tier: 2 }, ['finn'], 4);
    const a = s.piles[0]!.at(-1)!;
    s = move(s, pile(0), cell(0, 3));
    const b = s.piles[1]!.at(-1)!;
    s = move(s, pile(1), cell(0, 3));
    expect(s.grids[0]![3]).toBe(b);
    expect(pieceAt(s, pile(1))).toBe(a);
  });
});

describe('finishing', () => {
  it('a picture passes only when every piece is in its own spot', () => {
    let s = newPicturePuzzle({ tier: 2 }, ['finn', 'mom'], 5);
    s = solveAll(s);
    expect(s.done).toEqual([true, true]);
    expect(s.phase).toBe('between');
    s = nextRound(s);
    expect(s.phase).toBe('over');
    expect(result(s).safe).toEqual(['finn', 'mom']);
  });

  it('a full grid with two pieces swapped isn’t done', () => {
    let s = solveAll(newPicturePuzzle({ tier: 2 }, ['finn'], 6));
    expect(complete(s, 0)).toBe(true);
    // Build one with a swap: start fresh, place all but swap the first two.
    s = newPicturePuzzle({ tier: 2 }, ['finn'], 6);
    for (let guard = 0; guard < 100; guard++) {
      const k = s.piles.findIndex((p) => p.length > 0);
      if (k < 0) break;
      const id = s.piles[k]!.at(-1)!;
      const own = s.pieces[id]!.cell;
      const target = own === 0 ? 1 : own === 1 ? 0 : own;
      s = move(s, pile(k), cell(0, target));
    }
    expect(s.grids[0]!.every((x) => x !== null)).toBe(true);
    expect(complete(s, 0)).toBe(false);
    expect(s.phase).toBe('play');
    s = move(s, cell(0, 0), cell(0, 1));
    expect(complete(s, 0)).toBe(true);
    expect(s.results.finn).toBe('passed');
  });

  it('Tier I locks a piece dropped in its own spot; Tiers II and III don’t', () => {
    for (const tier of [1, 2, 3] as const) {
      let s = newPicturePuzzle({ tier }, ['finn'], 7);
      const id = s.piles[0]!.at(-1)!;
      const own = s.pieces[id]!.cell;
      s = move(s, pile(0), cell(0, own));
      expect(s.locked[id]).toBe(tier === 1);
      // A locked piece won't move.
      const moved = move(s, cell(0, own), pile(1));
      expect(moved.grids[0]![own] === id).toBe(tier === 1);
    }
  });

  it('when time runs out, unfinished pictures fail, then the next pair plays', () => {
    let s = newPicturePuzzle({ tier: 1 }, HIKERS.slice(0, 3), 8);
    s = timeUp(s);
    expect(s.results).toEqual({ finn: 'failed', mom: 'failed' });
    s = nextRound(s);
    expect(s.phase).toBe('play');
    expect(s.grids).toHaveLength(1);
    s = solveAll(s);
    s = nextRound(s);
    expect(s.phase).toBe('over');
    expect(result(s).safe).toEqual(['ellie']);
    // Over, it still shows the last pair (the screen draws it until the results).
    expect(s.rounds[s.round]).toEqual(['ellie']);
  });
});
