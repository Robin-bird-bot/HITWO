/**
 * The packing screen's rules (docs/design/27-packing-screen.md, section 7):
 * the picks, the odds, respins, bonuses, Second Wind, the resource turns,
 * the hand-over to the hike and seeding. The card preview's test is in
 * src/ui/packing/preview.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { ITEMS } from '../content/items';
import { DEFAULT_PARTY } from '../content/roster';
import { bagSlots, createGame, resourceCount, resourceLimit } from '../engine';
import { seedRng } from '../engine/rng';
import {
  PACK_TYPES,
  autoPack,
  bestRow,
  bundlesDone,
  canSpin,
  canTake,
  finish,
  handover,
  itemPool,
  itemsDone,
  newPacking,
  overLimit,
  picksFor,
  rollBundle,
  rollItem,
  secondWindDue,
  spin,
  take,
  targets,
  toResources,
  type PackingState,
  type Reel,
  type ReelSymbol,
  type Seat,
} from './logic';
import { seatsFor } from './seats';

const P = BALANCE.packing;

const seat = (id: string, start: string[] = [], slots = 4, resourceRoom = 10): Seat => ({
  id,
  name: id,
  color: '#E2683C',
  start,
  bagSlots: slots,
  resourceRoom,
});
const party = (n: number): Seat[] => Array.from({ length: n }, (_, i) => seat(`h${i}`));
const fresh = (n = 3, seed = 7) => newPacking({ seed, seats: party(n) });

const item = (type: 'tool' | 'food' | 'clothes' | 'shelter', tier: 1 | 2 = 1): ReelSymbol => ({
  kind: 'item',
  itemId: itemPool(type, tier)[0] ?? 'x',
  type,
  tier,
});
const bundle = (size: number): ReelSymbol => ({
  kind: 'bundle',
  resources: Array.from({ length: size }, () => 'wood'),
});
const reels = (...values: (ReelSymbol | null)[]): Reel[] =>
  values.map((value) => ({ value, lit: value !== null, locked: false, takenBy: null }));

/** Takes the first reel that can be taken, to the first hiker who can take it. */
function takeAny(s: PackingState): PackingState {
  const reel = s.reels.findIndex((_, i) => canTake(s, i));
  const who = targets(s)[0];
  if (reel < 0 || who === undefined) throw new Error('nothing to take');
  return take(s, reel, who);
}

/** Packs every item: free spins when due, takes when it can, respins otherwise. */
function packAllItems(s0: PackingState): PackingState {
  let s = s0;
  for (let guard = 0; guard < 100 && !itemsDone(s); guard++) {
    if (s.freeSpin) s = spin(s);
    else if (s.reels.some((_, i) => canTake(s, i))) s = takeAny(s);
    else s = spin(s);
  }
  return s;
}

describe('the picks', () => {
  it('is 2 items plus 1 per hiker, for 1 to 6 hikers', () => {
    for (let n = 1; n <= 6; n++) {
      expect(picksFor(n)).toBe(2 + n);
      expect(fresh(n).picksLeft).toBe(2 + n);
    }
  });

  it('never owes more items than the bags have room for', () => {
    const full = ['trailMix', 'trailMix', 'trailMix'];
    const s = newPacking({ seed: 1, seats: [seat('a', full), seat('b', full, 4)] });
    expect(s.picksLeft).toBe(2);
  });

  it('starts with 5 lit reels, a free first spin and the item respins', () => {
    const s = fresh();
    expect(s.reels).toHaveLength(P.itemReels);
    expect(s.reels.every((r) => r.lit && r.value === null)).toBe(true);
    expect(s.freeSpin).toBe(true);
    expect(s.respins).toBe(P.itemRespins);
  });
});

describe('the odds', () => {
  it('lands types near 40/30/20/10 and Tier II near 2%, from the offered pools', () => {
    const rng = seedRng(42);
    const N = 40000;
    const types: Record<string, number> = {};
    let tier2 = 0;
    for (let i = 0; i < N; i++) {
      const v = rollItem(rng);
      types[v.type] = (types[v.type] ?? 0) + 1;
      if (v.tier === 2) tier2++;
      expect(itemPool(v.type, v.tier)).toContain(v.itemId);
    }
    const total = Object.values(P.itemTypeOdds).reduce((a, b) => a + b, 0);
    for (const t of PACK_TYPES) {
      expect(Math.abs((types[t] ?? 0) / N - P.itemTypeOdds[t] / total)).toBeLessThan(0.015);
    }
    expect(Math.abs(tier2 / N - P.tier2Chance)).toBeLessThan(0.005);
  });

  it('lands bundle sizes near 35/40/22/3, each resource any of the 16', () => {
    const rng = seedRng(9);
    const N = 40000;
    const sizes: Record<number, number> = {};
    const seen = new Set<string>();
    for (let i = 0; i < N; i++) {
      const b = rollBundle(rng);
      sizes[b.resources.length] = (sizes[b.resources.length] ?? 0) + 1;
      for (const r of b.resources) seen.add(r);
    }
    const total = Object.values(P.bundleOdds).reduce((a, b) => a + b, 0);
    for (const [size, weight] of Object.entries(P.bundleOdds)) {
      expect(Math.abs((sizes[Number(size)] ?? 0) / N - weight / total)).toBeLessThan(0.015);
    }
    expect(seen.size).toBe(16);
  });

  it('never offers trait-only items or trinkets', () => {
    const all = PACK_TYPES.flatMap((t) => [...itemPool(t, 1), ...itemPool(t, 2)]);
    expect(all).not.toContain('pukedNuggets');
    expect(all.every((id) => ITEMS[id]?.type !== 'trinket')).toBe(true);
    for (const t of PACK_TYPES) {
      expect(itemPool(t, 1).length).toBeGreaterThan(0);
      expect(itemPool(t, 2).length).toBeGreaterThan(0);
    }
  });
});

describe('respins', () => {
  it('the first spin is free; a respin costs 1 and spins only lit reels', () => {
    let s = spin(fresh());
    const bonus1 = s.last?.bonus ? P.bonuses.respins : 0;
    expect(s.respins).toBe(P.itemRespins + bonus1);
    expect(s.last?.paid).toBe(false);
    s = take(s, 0, 0);
    const kept = s.reels[0]?.value;
    const before = s.respins;
    s = spin(s);
    expect(s.last?.paid).toBe(true);
    expect(s.respins).toBe(before - 1 + (s.last?.bonus ? P.bonuses.respins : 0));
    expect(s.reels[0]?.lit).toBe(false);
    expect(s.reels[0]?.value).toEqual(kept);
    expect(s.last?.landed[0]).toBeNull();
  });

  it('does nothing with no respins left', () => {
    let s = spin(fresh());
    s = { ...s, respins: 0 };
    expect(canSpin(s)).toBe(false);
    expect(spin(s)).toBe(s);
  });

  it('Second Wind spins for free', () => {
    let s = spin(fresh(6));
    for (let k = 0; k < 5; k++) s = takeAny(s);
    expect(secondWindDue(s)).toBe(true);
    const before = s.respins;
    s = spin(s);
    expect(s.last?.paid).toBe(false);
    expect(s.respins).toBe(before + (s.last?.bonus ? P.bonuses.respins : 0));
  });
});

describe('bonuses', () => {
  it('count only side by side, and a dark reel breaks a row', () => {
    expect(
      bestRow(reels(item('tool'), item('food'), item('tool'), item('tool'), item('food'))),
    ).toBe(null);
    expect(
      bestRow(reels(item('food'), item('tool'), item('tool'), item('tool'), item('food'))),
    ).toEqual([1, 2, 3]);
    expect(bestRow(reels(item('tool'), item('tool'), null, item('tool'), item('tool')))).toBe(null);
    const dark = reels(item('tool'), item('tool'), item('tool'), item('tool'), item('food'));
    dark[1] = { ...dark[1]!, lit: false };
    expect(bestRow(dark)).toBe(null);
  });

  it('pays only the longest row, and Tier II counts as its type', () => {
    expect(
      bestRow(reels(item('tool'), item('tool', 2), item('tool'), item('tool'), item('food'))),
    ).toEqual([0, 1, 2, 3]);
  });

  it('3 in a row is a bonus spin', () => {
    const s = spin(fresh(), 'row3');
    expect(s.last?.bonus).toMatchObject({ kind: 'row3', reels: [0, 1, 2], changed: [] });
    expect(s.respins).toBe(P.itemRespins + P.bonuses.respins);
  });

  it('4 in a row turns exactly one Tier II, plus a free spin', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = spin(fresh(3, seed), 'row4');
      const bonus = s.last?.bonus;
      expect(bonus?.kind).toBe('row4');
      expect(bonus?.changed).toHaveLength(1);
      const tiers = bonus?.reels.map((i) => (s.reels[i]?.value as { tier: number }).tier);
      expect(tiers?.filter((t) => t === 2)).toHaveLength(1);
      const up = s.reels[bonus?.changed[0] ?? -1]?.value;
      const was = s.last?.landed[bonus?.changed[0] ?? -1];
      expect(up?.kind === 'item' && was?.kind === 'item' && up.type === was.type).toBe(true);
      expect(s.respins).toBe(P.itemRespins + P.bonuses.respins);
    }
  });

  it('the jackpot turns all five Tier II, locks the rest after one is taken, and the next spin unlocks them', () => {
    let s = spin(fresh(), 'jackpot');
    expect(s.last?.bonus?.kind).toBe('jackpot');
    expect(s.reels.every((r) => r.value?.kind === 'item' && r.value.tier === 2)).toBe(true);
    expect(s.respins).toBe(P.itemRespins + P.bonuses.respins);
    s = take(s, 2, 0);
    expect(s.reels.filter((r) => r.lit).every((r) => r.locked)).toBe(true);
    expect(canTake(s, 0)).toBe(false);
    expect(take(s, 0, 1)).toBe(s);
    expect(canSpin(s)).toBe(true);
    s = spin(s);
    expect(s.reels.some((r) => r.locked)).toBe(false);
    expect(s.reels[2]?.lit).toBe(false);
  });

  it('bundle rows need all 3 reels lit', () => {
    let s = toResources(packAllItems(spin(fresh())));
    s = spin(s, 'twos');
    expect(s.last?.bonus?.kind).toBe('twos');
    const grown = s.reels[s.last?.bonus?.changed[0] ?? -1]?.value;
    expect(grown?.kind === 'bundle' && grown.resources.length).toBe(3);
    expect(s.respins).toBe(P.bundleRespins + P.bonuses.respins);
    s = take(s, 0, 0);
    s = spin(s, 'twos');
    expect(s.last?.bonus).toBeNull();
    expect(bestRow(reels(null, bundle(2), bundle(2)))).toBe(null);
  });

  it('×1 ×1 ×1 is a bonus spin; ×3 ×3 ×3 grows one to ×5', () => {
    const s = toResources(packAllItems(spin(fresh())));
    const ones = spin(s, 'ones');
    expect(ones.last?.bonus).toMatchObject({ kind: 'ones', changed: [] });
    expect(ones.respins).toBe(P.bundleRespins + P.bonuses.respins);
    const threes = spin(s, 'threes');
    expect(threes.last?.bonus?.kind).toBe('threes');
    const big = threes.reels[threes.last?.bonus?.changed[0] ?? -1]?.value;
    expect(big?.kind === 'bundle' && big.resources.length).toBe(5);
  });
});

describe('Second Wind', () => {
  it('fires only when every reel is dark and items are still owed', () => {
    let s = spin(fresh(6));
    for (let k = 0; k < 4; k++) s = takeAny(s);
    expect(secondWindDue(s)).toBe(false);
    s = takeAny(s);
    expect(s.picksLeft).toBe(3);
    expect(s.reels.every((r) => r.lit && r.takenBy === null)).toBe(true);
    expect(s.freeSpin).toBe(true);

    // Party of 3: the 5th item is the last one owed, so the reels stay dark.
    let t = spin(fresh(3));
    for (let k = 0; k < 5; k++) t = takeAny(t);
    expect(itemsDone(t)).toBe(true);
    expect(t.reels.every((r) => !r.lit)).toBe(true);
    expect(canSpin(t)).toBe(false);
  });
});

describe('the resource turns', () => {
  it('runs in party order; each hiker takes exactly 2 bundles, never anyone else', () => {
    let s = toResources(packAllItems(spin(fresh(3))));
    expect(s.step).toBe('resources');
    for (let turn = 0; turn < 3; turn++) {
      expect(s.turn).toBe(turn);
      expect(s.reels).toHaveLength(P.bundleReels);
      expect(s.respins).toBe(P.bundleRespins);
      expect(s.freeSpin).toBe(true);
      s = spin(s);
      // A paid respin: leftovers don't carry over to the next turn.
      s = spin(s);
      const other = (turn + 1) % 3;
      expect(take(s, 0, other)).toBe(s);
      s = take(s, 0, turn);
      s = take(s, 1, turn);
    }
    expect(bundlesDone(s)).toBe(true);
    expect(s.packs.map((p) => p.bundles.length)).toEqual([2, 2, 2]);
    s = finish(s);
    expect(s.step).toBe('done');
    expect(s.reels.every((r) => !r.lit)).toBe(true);
    // Bundles open into exactly their resources.
    const out = handover(s);
    s.packs.forEach((p, i) => {
      expect(out[i]?.items).toEqual(p.items.map((x) => x.itemId));
      expect(out[i]?.resources).toEqual(p.bundles.flatMap((b) => b.resources));
    });
  });

  it('notes resources past a hiker’s room', () => {
    let s = newPacking({ seed: 3, seats: [seat('a', [], 4, 1)] });
    s = toResources(packAllItems(s));
    s = spin(s, 'twos');
    s = take(s, 0, 0);
    s = take(s, 1, 0);
    expect(overLimit(s, 0)).toBeGreaterThan(0);
  });
});

describe('Skip packing', () => {
  it('packs every party from 1 to 6, within every bag', () => {
    for (let n = 1; n <= 6; n++) {
      const packed = autoPack({ seed: n * 11, seats: party(n) });
      expect(packed).toHaveLength(n);
      expect(packed.reduce((sum, p) => sum + p.items.length, 0)).toBe(2 + n);
      for (const p of packed) expect(p.items.length).toBeLessThanOrEqual(4);
      for (const p of packed) expect(p.resources.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('handing over', () => {
  it('puts the items in the right bags and the bundles’ resources in, after kits and gifts', () => {
    const seed = 2026;
    const seats = seatsFor(seed, DEFAULT_PARTY);
    const dry = createGame({ seed, hikers: DEFAULT_PARTY, startingResources: false });
    // The starting kits show as START items.
    for (const [i, setup] of DEFAULT_PARTY.entries()) {
      for (const id of setup.startingBag?.items ?? []) expect(seats[i]?.start).toContain(id);
    }
    const packed = autoPack({ seed, seats });
    const game = createGame({ seed, hikers: DEFAULT_PARTY, packed });
    game.hikers.forEach((h, i) => {
      const p = packed[i]!;
      const before = dry.hikers[i]!;
      expect(h.inventory.bag.map((x) => x.itemId)).toEqual([
        ...before.inventory.bag.map((x) => x.itemId),
        ...p.items,
      ]);
      expect(h.inventory.bag.length).toBeLessThanOrEqual(bagSlots(game, h).total);
      expect(resourceCount(h)).toBeLessThanOrEqual(resourceLimit(game, h));
      // No random starting resources: exactly what was there plus the bundles.
      const want: Record<string, number> = { ...before.inventory.resources } as Record<
        string,
        number
      >;
      for (const r of p.resources) want[r] = (want[r] ?? 0) + 1;
      const room = resourceLimit(game, h);
      if (Object.values(want).reduce((a, b) => a + b, 0) <= room) {
        expect(h.inventory.resources).toEqual(want);
      }
    });
  });

  it('drops resources over the limit, with a note', () => {
    const hikers = DEFAULT_PARTY.slice(0, 1);
    const game = createGame({
      seed: 5,
      hikers,
      packed: [{ items: [], resources: Array.from({ length: 12 }, () => 'wood') }],
    });
    const h = game.hikers[0]!;
    expect(resourceCount(h)).toBe(resourceLimit(game, h));
    const note = game.log.find((e) => e.kind === 'lost');
    expect(note).toMatchObject({ kind: 'lost', hikerId: h.id });
    expect(note?.kind === 'lost' && note.resources.length).toBe(12 - (resourceLimit(game, h) - 0));
  });

  it('keeps the random starting resources without packing (tests, the test-hike picker)', () => {
    const game = createGame({ seed: 5, hikers: DEFAULT_PARTY.slice(0, 1) });
    expect(resourceCount(game.hikers[0]!)).toBeGreaterThanOrEqual(
      BALANCE.inventory.startingResources,
    );
  });
});

describe('seeding', () => {
  it('the same seed with the same choices gives the same spins', () => {
    const play = (seed: number) => {
      let s = spin(fresh(4, seed));
      s = take(s, 1, 2);
      s = spin(s);
      s = take(s, 3, 0);
      return s;
    };
    expect(play(77)).toEqual(play(77));
    expect(play(77).reels).not.toEqual(play(78).reels);
    const seats = party(4);
    expect(autoPack({ seed: 5, seats })).toEqual(autoPack({ seed: 5, seats }));
  });
});
