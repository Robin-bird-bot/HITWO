import { describe, expect, it } from 'vitest';
import { int, nextFloat, nextUint32, pick, roll, seedRng, shuffle, weightedPick } from './rng';

describe('seeded RNG', () => {
  it('gives the same sequence for the same seed', () => {
    const a = seedRng(123);
    const b = seedRng(123);
    const seqA = Array.from({ length: 50 }, () => nextUint32(a));
    const seqB = Array.from({ length: 50 }, () => nextUint32(b));
    expect(seqA).toEqual(seqB);
  });

  it('gives different sequences for different seeds', () => {
    const a = seedRng(1);
    const b = seedRng(2);
    const seqA = Array.from({ length: 10 }, () => nextUint32(a));
    const seqB = Array.from({ length: 10 }, () => nextUint32(b));
    expect(seqA).not.toEqual(seqB);
  });

  it('keeps its state as plain JSON numbers', () => {
    const state = seedRng(99);
    nextUint32(state);
    const copy = JSON.parse(JSON.stringify(state)) as typeof state;
    expect(nextUint32(copy)).toBe(nextUint32(state));
  });

  it('produces floats in [0, 1)', () => {
    const state = seedRng(7);
    for (let i = 0; i < 10_000; i++) {
      const f = nextFloat(state);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it('int() covers both ends of the range', () => {
    const state = seedRng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i++) seen.add(int(state, 1, 6));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('roll() is never true at 0 and always true at 1', () => {
    const state = seedRng(11);
    for (let i = 0; i < 1_000; i++) {
      expect(roll(state, 0)).toBe(false);
      expect(roll(state, 1)).toBe(true);
    }
  });

  it('roll() matches its chance over many draws', () => {
    const state = seedRng(2026);
    let hits = 0;
    const n = 20_000;
    for (let i = 0; i < n; i++) if (roll(state, 0.25)) hits++;
    expect(hits / n).toBeGreaterThan(0.23);
    expect(hits / n).toBeLessThan(0.27);
  });

  it('weightedPick() matches the weights over many draws', () => {
    const state = seedRng(42);
    const entries = [
      { item: 'common', weight: 60 },
      { item: 'uncommon', weight: 25 },
      { item: 'rare', weight: 10 },
      { item: 'veryRare', weight: 5 },
      { item: 'never', weight: 0 },
    ];
    const counts: Record<string, number> = {};
    const n = 20_000;
    for (let i = 0; i < n; i++) {
      const item = weightedPick(state, entries);
      counts[item] = (counts[item] ?? 0) + 1;
    }
    for (const { item, weight } of entries) {
      expect(Math.abs((counts[item] ?? 0) / n - weight / 100)).toBeLessThan(0.02);
    }
    expect(counts.never).toBeUndefined();
  });

  it('weightedPick() refuses weights that add up to 0', () => {
    expect(() => weightedPick(seedRng(1), [{ item: 'a', weight: 0 }])).toThrow();
  });

  it('shuffle() returns a permutation and leaves the input alone', () => {
    const state = seedRng(8);
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(state, input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((x, y) => x - y)).toEqual(input);
    expect(out).not.toEqual(input);
  });

  it('pick() only returns items from the list', () => {
    const state = seedRng(3);
    for (let i = 0; i < 100; i++) expect(['a', 'b', 'c']).toContain(pick(state, ['a', 'b', 'c']));
  });
});
