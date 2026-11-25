/**
 * Memory Puzzle (docs/design/13-minigames-puzzles-2.md, section 6): even
 * splits, two colors of one snack, the clock (a match adds time, a miss
 * takes some away once per try), swaps, running out, and threes.
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
  tick,
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
  it('a failed try takes the miss cost off the clock once (nothing on Tier I), then the cards flip back', () => {
    for (const tier of [1, 2, 3, 4, 5] as const) {
      const s = toPlay(newMemory({ tier, swaps: 'off' }, HIKERS.slice(0, 2), 2));
      expect(s.timeLeft).toBe(M.tiers[tier].timeSec);
      const [a, b] = mismatch(s);
      const one = flip(s, a).state;
      expect(one.timeLeft).toBe(s.timeLeft);
      const two = flip(one, b);
      expect(two.outcome).toBe('miss');
      expect(two.state.timeLeft).toBe(s.timeLeft - M.tiers[tier].missSec);
      if (tier === 1) expect(two.state.clockNote).toBeUndefined();
      else expect(two.state.clockNote).toEqual({ sec: -M.tiers[tier].missSec, at: 0 });
      // Flipping more while the miss shows does nothing.
      expect(flip(two.state, spotsOf(s, 2)[0]!).state).toBe(two.state);
      const back = resolveMiss(two.state);
      expect(back.up).toEqual([]);
      expect(back.phase).toBe('play');
      expect(back.timeLeft).toBe(s.timeLeft - M.tiers[tier].missSec);
    }
  });

  it('a match adds the match bonus to the clock', () => {
    const s = toPlay(newMemory({ tier: 2 }, ['finn'], 9));
    const [a, b] = spotsOf(s, 0);
    const out = flip(flip(s, a!).state, b!);
    expect(out.outcome).toBe('match');
    expect(out.state.timeLeft).toBe(s.timeLeft + M.tiers[2].matchSec);
    expect(out.state.clockNote).toEqual({ sec: M.tiers[2].matchSec, at: 0 });
  });

  it('the clock runs after the preview, and running out ends it', () => {
    let s = newMemory({ tier: 1 }, ['finn'], 10);
    s = tick(s, 5);
    expect(s.timeLeft).toBe(M.tiers[1].timeSec);
    s = toPlay(s);
    s = tick(s, 10);
    expect(s.timeLeft).toBeCloseTo(M.tiers[1].timeSec - 10);
    s = tick(s, M.tiers[1].timeSec);
    expect(s.phase).toBe('over');
    expect(s.timeLeft).toBe(0);
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

  it('when time runs out, exactly the hikers with unmatched sets fail', () => {
    let s = toPlay(newMemory({ tier: 1, time: 30 }, HIKERS.slice(0, 3), 6));
    // Match all of Finn's and Mom's sets, none of Ellie's.
    s.sets.forEach((set, i) => {
      if (set.hiker === 'ellie') return;
      for (const pos of spotsOf(s, i)) s = flip(s, pos).state;
    });
    expect(setsLeft(s, 'finn')).toBe(0);
    expect(setsLeft(s, 'ellie')).toBeGreaterThan(0);
    const ellie = s.sets.flatMap((x, i) => (x.hiker === 'ellie' ? [i] : []));
    s = resolveMiss(
      flip(flip(s, spotsOf(s, ellie[0]!)[0]!).state, spotsOf(s, ellie[1]!)[0]!).state,
    );
    expect(s.phase).toBe('play');
    s = tick(s, s.timeLeft);
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

  it('the settings: swaps off and on, the preview, the time, the match bonus and the miss cost', () => {
    expect(newMemory({ tier: 2, swaps: 'off' }, ['finn'], 1).swapsLeft).toBe(0);
    expect(newMemory({ tier: 1, swaps: 'on' }, ['finn'], 1).swapsLeft).toBe(M.swapsOnTier1);
    expect(newMemory({ tier: 1 }, ['finn'], 1).timeSec).toBe(M.tiers[1].timeSec);
    const custom = newMemory(
      { tier: 1, preview: 2, time: 45, matchBonus: 7, missCost: 3 },
      ['finn'],
      1,
    );
    expect(custom).toMatchObject({ previewSec: 2, timeSec: 45, matchSec: 7, missSec: 3 });
    expect(newMemory({ tier: 5 }, ['finn'], 1)).toMatchObject({
      previewSec: M.tiers[5].previewSec,
      swapsLeft: M.tiers[5].swaps,
      timeSec: M.tiers[5].timeSec,
    });
  });
});
