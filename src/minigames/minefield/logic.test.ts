/**
 * Minefield, the Dog Waste Zone (docs/design/23-minigames-final.md, sections
 * 6 and 13; Thin Ice's tests, renamed): the safe first check, the numbers,
 * opening zeros, bags, stepping in one, the pile count, and winning. And
 * Prepare's pre-bagged piles: bagged at the start, and the first check
 * still safe.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import {
  around,
  check,
  count,
  front,
  holesLeft,
  newMinefield,
  result,
  timeUp,
  toggleFlag,
  type MinefieldState,
} from './logic';

const I = BALANCE.minigames.minefield;
const HIKERS = ['finn', 'mom', 'ellie', 'wyatt'];

const holeCells = (s: MinefieldState) => s.holes!.flatMap((h, i) => (h ? [i] : []));
const safeCells = (s: MinefieldState) => s.holes!.flatMap((h, i) => (h ? [] : [i]));

describe('the ice', () => {
  it('has the tier’s base holes plus 2 per hiker', () => {
    for (const tier of [1, 2, 3] as const) {
      for (let n = 1; n <= 4; n++) {
        const s = check(newMinefield({ tier }, HIKERS.slice(0, n), 1), 0).state;
        expect(holeCells(s)).toHaveLength(I.tiers[tier].holes + I.holesPerHiker * n);
        expect([s.cols, s.rows]).toEqual([I.tiers[tier].cols, I.tiers[tier].rows]);
      }
    }
    const custom = check(
      newMinefield({ tier: 1, holesPerHiker: 0, size: [6, 5] }, ['finn'], 1),
      0,
    ).state;
    expect(holeCells(custom)).toHaveLength(I.tiers[1].holes);
    expect(custom.open).toHaveLength(30);
  });

  it('the first check is never a hole and opens a patch', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s0 = newMinefield({ tier: 3 }, HIKERS, seed);
      const cell = (seed * 7) % s0.open.length;
      const { state: s, fell } = check(s0, cell);
      expect(fell).toBeUndefined();
      expect(s.holes![cell]).toBe(false);
      expect(count(s, cell)).toBe(0);
      expect(s.open.filter(Boolean).length).toBeGreaterThan(around(s, cell).length);
    }
  });

  it('numbers count the holes around, diagonals included; a 0 opens its neighbors', () => {
    const s = check(newMinefield({ tier: 2 }, ['finn', 'mom'], 3), 10).state;
    for (const cell of safeCells(s)) {
      const n = around(s, cell).filter((x) => s.holes![x]).length;
      expect(count(s, cell)).toBe(n);
      if (s.open[cell] && n === 0) {
        for (const x of around(s, cell)) expect(s.open[x]).toBe(true);
      }
    }
  });
});

describe('flags and falling in', () => {
  it('flags block checking until they come off', () => {
    let s = check(newMinefield({ tier: 1 }, ['finn'], 4), 0).state;
    const shut = s.open.findIndex((o) => !o);
    s = toggleFlag(s, shut);
    expect(holesLeft(s)).toBe(s.holeCount - 1);
    expect(check(s, shut).state).toBe(s);
    s = toggleFlag(s, shut);
    expect(s.flags[shut]).toBe(false);
    // Open ice can't be flagged.
    expect(toggleFlag(s, 0)).toBe(s);
  });

  it('a hole takes out only the hiker at the front, and play goes on', () => {
    let s = check(newMinefield({ tier: 1 }, HIKERS.slice(0, 3), 5), 0).state;
    const [h1, h2] = holeCells(s);
    let out = check(s, h1!);
    expect(out.fell).toBe('finn');
    s = out.state;
    expect(s.fell).toEqual(['finn']);
    expect(s.open[h1!]).toBe(true);
    expect(s.over).toBe(false);
    expect(front(s)).toBe('mom');
    expect(holesLeft(s)).toBe(s.holeCount - 1);
    out = check(s, h2!);
    expect(out.fell).toBe('mom');
    expect(out.state.fell).toEqual(['finn', 'mom']);
  });

  it('it ends when everyone has fallen in, and they all fail', () => {
    let s = check(newMinefield({ tier: 1 }, ['finn', 'mom'], 6), 0).state;
    for (const h of holeCells(s).slice(0, 2)) s = check(s, h).state;
    expect(s.over).toBe(true);
    expect(result(s).hit).toHaveLength(2);
  });
});

describe('winning', () => {
  it('checking every safe cell wins: those still in pass, the fallen fail', () => {
    let s = check(newMinefield({ tier: 2 }, HIKERS.slice(0, 3), 7), 0).state;
    s = check(s, holeCells(s)[0]!).state;
    for (const cell of safeCells(s)) s = check(s, cell).state;
    expect(s.won).toBe(true);
    expect(s.over).toBe(true);
    const r = result(s);
    expect(r.safe).toEqual(['mom', 'ellie']);
    expect(r.hit.map((h) => h.hikerId)).toEqual(['finn']);
  });

  it('time running out fails everyone still in', () => {
    const s = timeUp(check(newMinefield({ tier: 2 }, ['finn'], 8), 0).state);
    expect(s.over).toBe(true);
    expect(result(s).hit).toHaveLength(1);
  });

  it('the timer setting', () => {
    expect(newMinefield({ tier: 1 }, ['finn'], 1).timeSec).toBeNull();
    expect(newMinefield({ tier: 2 }, ['finn'], 1).timeSec).toBe(I.tiers[2].timerSec);
    expect(newMinefield({ tier: 2, timer: 'off' }, ['finn'], 1).timeSec).toBeNull();
    expect(newMinefield({ tier: 1, timer: 90 }, ['finn'], 1).timeSec).toBe(90);
  });
});

describe('pre-bagged piles (POO BAGS and SCANNER)', () => {
  it('bags that many piles before the start, and the first check is still safe and opens a patch', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s0 = newMinefield({ tier: 2, preBags: 3 }, HIKERS.slice(0, 2), seed);
      expect(s0.holes).not.toBeNull();
      expect(s0.flags.filter(Boolean)).toHaveLength(3);
      // Every bag is on a pile.
      s0.flags.forEach((f, i) => f && expect(s0.holes![i]).toBe(true));
      const first = s0.flags.findIndex((f, i) => !f && around(s0, i).every((n) => !s0.flags[n]));
      const s = check(s0, first).state;
      expect(s.fell).toEqual([]);
      expect(s.open[first]).toBe(true);
      expect(count(s, first)).toBe(0);
      // The piles moved, never vanished, and the bagged ones stayed put.
      expect(holeCells(s)).toHaveLength(s0.holeCount);
      s0.flags.forEach((f, i) => f && expect(s.holes![i]).toBe(true));
    }
  });
});
