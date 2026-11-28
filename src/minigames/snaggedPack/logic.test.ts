/**
 * Snagged Pack (docs/design/30-quick-minigames.md, sections 4 and 6): every
 * board (over many seeds, every tier) has an answer; ropes never share a
 * cell; joining every pair passes; Prepare; and the demo bot.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { TIERS, type Tier } from '../types';
import { makeBoard, nextTo } from './boards';
import { snaggedPackBot, type SnaggedMove } from './bot';
import {
  clearRope,
  dragTo,
  grab,
  joined,
  joinedCount,
  newSnaggedPack,
  release,
  result,
  ropeAt,
  showHint,
  tick,
  type SnaggedState,
} from './logic';

const SP = BALANCE.minigames.snaggedPack;
const DT = 1 / 60;

/** Draws a pair's answer, cell by cell. */
function solve(s0: SnaggedState, color: number): SnaggedState {
  const p = s0.board.pairs.find((x) => x.color === color)!;
  let s = grab(s0, p.a);
  for (const c of p.path.slice(1)) s = dragTo(s, c);
  return release(s);
}

describe('the boards', () => {
  it.each(TIERS)(
    'Tier %i: every board has an answer that uses each cell once; no pair side by side; no rope under [3]',
    (tier) => {
      const { size, pairs } = SP.tiers[tier];
      for (let seed = 1; seed <= 40; seed++) {
        const board = makeBoard(size, pairs, seedRng(seed * 31 + tier));
        expect(board.pairs).toHaveLength(pairs);
        const cells = board.pairs.flatMap((p) => p.path);
        expect(new Set(cells).size).toBe(size * size);
        expect(cells).toHaveLength(size * size);
        for (const p of board.pairs) {
          expect(p.path[0]).toBe(p.a);
          expect(p.path.at(-1)).toBe(p.b);
          expect(p.path.length).toBeGreaterThanOrEqual(SP.shortest);
          expect(nextTo(size, p.a, p.b)).toBe(false);
          // The answer steps cell to cell.
          for (let k = 1; k < p.path.length; k++)
            expect(nextTo(size, p.path[k - 1]!, p.path[k]!)).toBe(true);
        }
        expect(board.pairs.map((p) => p.color).sort((a, b) => a - b)).toEqual([
          ...Array(pairs).keys(),
        ]);
      }
    },
  );

  it('the same seed makes the same board; each hiker gets a new one', () => {
    expect(makeBoard(6, 5, seedRng(9))).toEqual(makeBoard(6, 5, seedRng(9)));
    let s = newSnaggedPack({ tier: 1 }, ['finn', 'mom'], 3);
    const first = s.board;
    for (const p of first.pairs) s = solve(s, p.color);
    expect(s.turns.done).toEqual({ finn: true });
    expect(s.board).not.toEqual(first);
  });
});

describe('the ropes', () => {
  it('drawing each answer joins every pair, and the hiker passes', () => {
    let s = newSnaggedPack({ tier: 2 }, ['finn'], 1);
    for (const p of s.board.pairs) {
      s = solve(s, p.color);
      if (!s.over) expect(joined(s, p.color)).toBe(true);
    }
    expect(s.over).toBe(true);
    expect(s.turns.done).toEqual({ finn: true });
    expect(result(s).safe).toEqual(['finn']);
  });

  it('a rope stops at another rope or another color’s socket: ropes never share a cell', () => {
    const s0 = newSnaggedPack({ tier: 3 }, ['finn'], 2);
    const [p, q] = s0.board.pairs;
    let s = solve(s0, p!.color);
    // Drag q's rope at every cell of the board; it never enters p's cells.
    s = grab(s, q!.a);
    for (let c = 0; c < s.size * s.size; c++) {
      s = dragTo(s, c);
      const mine = s.ropes[q!.color] ?? [];
      for (const cell of mine) {
        expect(ropeAt({ ...s, ropes: { [p!.color]: s.ropes[p!.color]! } }, cell)).toBeNull();
      }
      if (s.drag === null) break;
    }
    const all = Object.values(s.ropes).flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('dragging back shortens a rope; grabbing its socket starts it again; a tap clears it', () => {
    const s0 = newSnaggedPack({ tier: 1 }, ['finn'], 4);
    const p = s0.board.pairs[0]!;
    let s = grab(s0, p.a);
    s = dragTo(s, p.path[1]!);
    s = dragTo(s, p.path[2]!);
    expect(s.ropes[p.color]).toEqual(p.path.slice(0, 3));
    s = dragTo(s, p.path[1]!);
    expect(s.ropes[p.color]).toEqual(p.path.slice(0, 2));
    s = release(s);
    s = solve(s, p.color);
    expect(joined(s, p.color)).toBe(true);
    // Grabbing a joined rope's socket clears it and starts again.
    s = grab(s, p.b);
    expect(s.ropes[p.color]).toEqual([p.b]);
    s = release(s);
    expect(s.ropes[p.color]).toBeUndefined();
    s = clearRope(solve(s, p.color), p.color);
    expect(s.ropes[p.color]).toBeUndefined();
  });

  it('the clock running out fails the hiker; the next one starts', () => {
    let s = newSnaggedPack({ tier: 1 }, ['finn', 'mom'], 5);
    for (let k = 0; k < (SP.tiers[1].clockSec + 0.5) / DT; k++) s = tick(s, DT);
    expect(s.turns.done).toEqual({ finn: false });
    expect(result({ ...s, over: true }).pays?.finn).toEqual({ energy: 1 });
  });
});

describe('Prepare', () => {
  it('FOOD adds seconds; SORTED starts a pair joined; a SACK takes one away', () => {
    const s = newSnaggedPack({ tier: 2, extraSec: 8, sorted: 1, fewer: 1 }, ['finn'], 1);
    expect(s.clockSec).toBe(SP.tiers[2].clockSec + 8);
    expect(s.board.pairs).toHaveLength(SP.tiers[2].pairs - 1);
    expect(joinedCount(s)).toBe(1);
  });

  it('a LUCKY CHARM shows a rope’s path for a moment, once each', () => {
    let s = newSnaggedPack({ tier: 1, hints: 1 }, ['finn'], 1);
    const color = s.board.pairs[0]!.color;
    s = showHint(s, color);
    expect(s.hint?.color).toBe(color);
    expect(showHint(s, color)).toBe(s);
    for (let k = 0; k < (SP.hintSec + 0.1) / DT; k++) s = tick(s, DT);
    expect(s.hint).toBeNull();
  });
});

describe('the demo bot', () => {
  const act = (s: SnaggedState, m: SnaggedMove): SnaggedState =>
    m.kind === 'grab'
      ? grab(s, m.cell)
      : m.kind === 'drag'
        ? dragTo(s, m.cell)
        : m.kind === 'release'
          ? release(s)
          : clearRope(s, m.color);

  function passRate(tier: Tier, runs = 20): number {
    let passed = 0;
    for (let seed = 1; seed <= runs; seed++) {
      let s = newSnaggedPack({ tier }, ['finn'], seed);
      const mem: Record<string, unknown> = {};
      const rng = seedRng(seed * 17 + 2);
      while (!s.over) {
        const m = snaggedPackBot(s, mem, rng, s.time);
        if (m) s = act(s, m);
        s = tick(s, DT);
      }
      if (s.turns.done.finn) passed++;
    }
    return passed / runs;
  }

  // 30 aims for [70–85%] at Tier I; the bot does better (the PR has the numbers).
  it('passes Tier I most of the time, and no more often at Tier V', () => {
    const one = passRate(1);
    expect(one).toBeGreaterThanOrEqual(0.7);
    expect(passRate(5)).toBeLessThanOrEqual(one);
  });
});
