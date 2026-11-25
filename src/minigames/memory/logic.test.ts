/**
 * Memory Puzzle (docs/design/13-minigames-puzzles-2.md, section 6): even
 * splits, two colors of one snack, misses, swaps, running out, and threes.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import {
  flip,
  newMemory,
  nextSwap,
  previewDone,
  resolveMiss,
  result,
  setsLeft,
  timeUp,
  type MemoryState,
} from './logic';

const M = BALANCE.minigames.memory;
const HIKERS = ['finn', 'mom', 'ellie', 'wyatt'];

/** Where each card of a set is now. */
const spotsOf = (s: MemoryState, set: number) =>
  s.cards.flatMap((id, pos) => (id !== null && s.cardSet[id] === set ? [pos] : []));

/** Into play: preview over, and any swaps shown. */
function toPlay(s0: MemoryState): MemoryState {
  let s = previewDone(s0);
  while (s.phase === 'swaps') s = nextSwap(s).state;
  return s;
}

/** Two positions holding cards of different sets. */
function mismatch(s: MemoryState): [number, number] {
  const a = spotsOf(s, 0)[0]!;
  const b = spotsOf(s, 1)[0]!;
  return [a, b];
}

describe('dealing', () => {
  it('splits the sets as evenly as it can (8 pairs for 3 hikers: 3, 3, 2)', () => {
    const s = newMemory({ tier: 1 }, HIKERS.slice(0, 3), 1);
    expect(s.sets).toHaveLength(8);
    const counts = HIKERS.slice(0, 3).map((h) => s.sets.filter((x) => x.hiker === h).length);
    expect(counts).toEqual([3, 3, 2]);
  });

  it('the same snack for two hikers is two sets; one hiker never repeats a snack', () => {
    let shared = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = newMemory({ tier: 3, match: 'pairs' }, HIKERS.slice(0, 2), seed);
      for (const h of ['finn', 'mom']) {
        const mine = s.sets.filter((x) => x.hiker === h).map((x) => x.snack);
        expect(new Set(mine).size).toBe(mine.length);
      }
      const snacks = s.sets.map((x) => x.snack);
      if (new Set(snacks).size < snacks.length) {
        shared++;
        // The two colors don't match each other.
        const twice = snacks.find((x, i) => snacks.indexOf(x) !== i)!;
        const [a, b] = s.sets.flatMap((x, i) => (x.snack === twice ? [i] : []));
        let p = toPlay(s);
        p = flip(p, spotsOf(p, a!)[0]!).state;
        const out = flip(p, spotsOf(p, b!)[0]!);
        expect(out.outcome).toBe('miss');
      }
    }
    expect(shared).toBeGreaterThan(0);
  });

  it('each tier’s grid and set size; threes leave the leftover spots empty', () => {
    expect(newMemory({ tier: 1 }, ['finn'], 1).cards).toHaveLength(16);
    expect(newMemory({ tier: 2 }, ['finn'], 1).cards).toHaveLength(20);
    const t3 = newMemory({ tier: 3 }, ['finn'], 1);
    expect(t3.cards).toHaveLength(24);
    expect(t3.setSize).toBe(3);
    const threes = newMemory({ tier: 1, match: 'threes' }, ['finn'], 1);
    expect(threes.sets).toHaveLength(5);
    expect(threes.cards.filter((c) => c === null)).toHaveLength(1);
  });
});

describe('play', () => {
  it('a failed try costs exactly one miss, then the cards flip back', () => {
    const s = toPlay(newMemory({ tier: 1 }, HIKERS.slice(0, 2), 2));
    const [a, b] = mismatch(s);
    const one = flip(s, a).state;
    expect(one.missesLeft).toBe(M.tiers[1].misses);
    const two = flip(one, b);
    expect(two.outcome).toBe('miss');
    expect(two.state.missesLeft).toBe(M.tiers[1].misses - 1);
    // Flipping more while the miss shows does nothing.
    expect(flip(two.state, spotsOf(s, 2)[0]!).state).toBe(two.state);
    const back = resolveMiss(two.state);
    expect(back.up).toEqual([]);
    expect(back.phase).toBe('play');
    expect(back.missesLeft).toBe(M.tiers[1].misses - 1);
  });

  it('sets of 3 need all three; a wrong second card is already a miss', () => {
    const s = toPlay(newMemory({ tier: 3, swaps: 'off' }, ['finn'], 3));
    const [a, b, c] = spotsOf(s, 0);
    let p = flip(s, a!).state;
    p = flip(p, b!).state;
    expect(p.matched.some(Boolean)).toBe(false);
    const done = flip(p, c!);
    expect(done.outcome).toBe('match');
    expect(spotsOf(s, 0).every((pos) => done.state.matched[s.cards[pos]!])).toBe(true);
    // A wrong second card ends the try.
    const other = spotsOf(s, 1)[0]!;
    expect(flip(flip(s, a!).state, other).outcome).toBe('miss');
  });

  it('swaps move cards around but never lose one, and Tier III swaps again after a miss', () => {
    let s = previewDone(newMemory({ tier: 3 }, HIKERS.slice(0, 2), 4));
    expect(s.phase).toBe('swaps');
    const before = [...s.cards].sort();
    let swaps = 0;
    while (s.phase === 'swaps') {
      const out = nextSwap(s);
      if (out.swapped) swaps++;
      s = out.state;
      expect([...s.cards].sort()).toEqual(before);
    }
    expect(swaps).toBe(M.tiers[3].swaps);
    const [a, b] = mismatch(s);
    s = resolveMiss(flip(flip(s, a).state, b).state);
    expect(s.phase).toBe('swaps');
    expect(s.swapsLeft).toBe(M.tiers[3].swapsPerMiss);
  });

  it('matching every set passes everyone', () => {
    let s = toPlay(newMemory({ tier: 2 }, HIKERS.slice(0, 3), 5));
    for (let set = 0; set < s.sets.length; set++) {
      for (const pos of spotsOf(s, set)) s = flip(s, pos).state;
    }
    expect(s.phase).toBe('over');
    expect(result(s).safe).toEqual(HIKERS.slice(0, 3));
  });

  it('when the misses run out, exactly the hikers with unmatched sets fail', () => {
    let s = toPlay(newMemory({ tier: 1, misses: 2 }, HIKERS.slice(0, 3), 6));
    // Match all of Finn's and Mom's sets, none of Ellie's.
    s.sets.forEach((set, i) => {
      if (set.hiker === 'ellie') return;
      for (const pos of spotsOf(s, i)) s = flip(s, pos).state;
    });
    expect(setsLeft(s, 'finn')).toBe(0);
    expect(setsLeft(s, 'ellie')).toBeGreaterThan(0);
    for (let k = 0; k < 2; k++) {
      const ellie = s.sets.flatMap((x, i) => (x.hiker === 'ellie' ? [i] : []));
      const a = spotsOf(s, ellie[0]!)[0]!;
      const b = spotsOf(s, ellie[1]!)[0]!;
      s = resolveMiss(flip(flip(s, a).state, b).state);
    }
    expect(s.phase).toBe('over');
    const r = result(s);
    expect(r.safe).toEqual(['finn', 'mom']);
    expect(r.hit.map((h) => h.hikerId)).toEqual(['ellie']);
  });

  it('time running out ends it the same way', () => {
    const s = timeUp(toPlay(newMemory({ tier: 2 }, ['finn', 'mom'], 7)));
    expect(s.phase).toBe('over');
    expect(result(s).hit).toHaveLength(2);
  });

  it('the settings: misses, swaps off and on, and the timer', () => {
    expect(newMemory({ tier: 1, misses: 3 }, ['finn'], 1).missesLeft).toBe(3);
    expect(newMemory({ tier: 2, swaps: 'off' }, ['finn'], 1).swapsLeft).toBe(0);
    expect(newMemory({ tier: 1, swaps: 'on' }, ['finn'], 1).swapsLeft).toBe(M.swapsOnTier1);
    expect(newMemory({ tier: 1 }, ['finn'], 1).timeSec).toBeNull();
    expect(newMemory({ tier: 2, timer: 'off' }, ['finn'], 1).timeSec).toBeNull();
    expect(newMemory({ tier: 1, timer: 45 }, ['finn'], 1).timeSec).toBe(45);
  });
});
