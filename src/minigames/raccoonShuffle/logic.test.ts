/**
 * Raccoon Shuffle (docs/design/18-minigames-quick.md, sections 6 and 9):
 * every swap keeps each bin's contents with it, and the bin picked opens
 * with what was put in it; each card shows something from the active
 * hiker's pack, or energy when they have nothing; an empty bin passes with
 * no cost, and a raccoon takes exactly the item on its card; each hiker gets
 * a new fill and a new shuffle. The take-away (22-minigame-revisions.md,
 * sections 1.2 and 6): only empty bins are ever taken, exactly one empty
 * bin is left at every tier (two with LURE ONE OUT), and the gap can't be
 * picked.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { costText } from '../endScreen';
import { TIERS } from '../types';
import {
  binAt,
  binX,
  fill,
  newRaccoonShuffle,
  packUnits,
  pickBin,
  planSwaps,
  result,
  select,
  takenAt,
  takeCount,
  tick,
  type RaccoonShuffleState,
} from './logic';
import { playing } from '../quick/turns';
import { raccoonShuffleBot } from './bot';

const RS = BALANCE.minigames.raccoonShuffle;
const Q = BALANCE.minigames.quick;
const DT = 1 / 120;
const PACKS = { finn: { wood: 2, salt: 1 }, mom: { fish: 1 }, ellie: {} };

const runUntil = (
  s0: RaccoonShuffleState,
  until: (s: RaccoonShuffleState) => boolean,
  sec = 60,
) => {
  let s = s0;
  for (let t = 0; t < sec && !s.over && !until(s); t += DT) s = tick(s, DT);
  return s;
};
const toPick = (s: RaccoonShuffleState) => runUntil(s, (x) => x.phase === 'pick');
const slotOf = (s: RaccoonShuffleState, empty: boolean) =>
  s.slots.findIndex((id, k) => (s.bins[id]!.card === null) === empty && !takenAt(s, k));
/** The empty bins still there (not taken away). */
const emptiesLeft = (s: RaccoonShuffleState) =>
  s.slots.filter((id, k) => s.bins[id]!.card === null && !takenAt(s, k));

describe('Raccoon Shuffle', () => {
  it.each(TIERS)(
    'Tier %i: the tier’s bins and empty bins; every card comes from the pack, not put back',
    (tier) => {
      for (let seed = 1; seed <= 30; seed++) {
        const pack = { wood: 2, salt: 1, fish: 3 };
        const bins = fill(seedRng(seed), tier, pack, RS.tiers[tier].empty);
        expect(bins).toHaveLength(RS.tiers[tier].bins);
        expect(bins.filter((b) => b.card === null)).toHaveLength(RS.tiers[tier].empty);
        const shown = bins.flatMap((b) => (b.card?.kind === 'resource' ? [b.card.id] : []));
        // Never more of a resource than they carry.
        for (const [id, n] of Object.entries(pack)) {
          expect(shown.filter((x) => x === id).length).toBeLessThanOrEqual(n);
        }
        // Energy only once the pack has run out.
        const energy = bins.filter((b) => b.card?.kind === 'energy').length;
        if (energy > 0) expect(shown).toHaveLength(packUnits(pack).length);
      }
    },
  );

  it('a hiker with nothing to take gets energy cards', () => {
    const bins = fill(seedRng(3), 3, {}, RS.tiers[3].empty);
    const raccoons = bins.filter((b) => b.card);
    expect(raccoons.length).toBe(RS.tiers[3].bins - RS.tiers[3].empty);
    expect(raccoons.every((b) => b.card!.kind === 'energy')).toBe(true);
  });

  it.each(TIERS)(
    'Tier %i: the tier’s swaps; two at once never share a bin; fake-outs don’t count (revised Nov 26)',
    (tier) => {
      const t = RS.tiers[tier];
      let far = 0;
      let all = 0;
      let fakes = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const steps = planSwaps(seedRng(seed), tier, t.bins);
        expect(steps.flatMap((x) => x.pairs)).toHaveLength(t.swaps);
        for (const step of steps) {
          const slots = [...step.pairs.flat(), ...(step.fake ?? [])];
          expect(new Set(slots).size).toBe(slots.length);
          if (t.double === 0)
            expect(step.pairs.length + (step.fake ? 1 : 0)).toBeLessThanOrEqual(1);
          if (step.fake) fakes++;
          for (const [a, b] of step.pairs) {
            all++;
            if (b - a >= 2) far++;
          }
        }
        // Swap times speed up evenly from the first to the last.
        expect(steps[0]!.sec).toBeCloseTo(t.swapSec[0]);
        expect(steps.at(-1)!.sec).toBeCloseTo(t.swapSec[1]);
        for (let k = 1; k < steps.length; k++)
          expect(steps[k]!.sec).toBeLessThanOrEqual(steps[k - 1]!.sec + 1e-9);
      }
      // The far-swap share is close to the tier's.
      expect(Math.abs(far / all - t.far)).toBeLessThan(0.12);
      if (t.fake === 0) expect(fakes).toBe(0);
      else expect(fakes).toBeGreaterThan(0);
    },
  );

  it('a fake-out never moves a bin’s contents and doesn’t count toward the swaps', () => {
    let s = newRaccoonShuffle({ tier: 5, packs: PACKS }, ['finn'], 3);
    const fakeOnly = s.steps.findIndex((x) => x.fake && x.pairs.length === 0);
    expect(fakeOnly).toBeGreaterThanOrEqual(0);
    s = runUntil(s, (x) => x.phase === 'shuffle' && x.step === fakeOnly);
    const before = { slots: s.slots, done: s.swapsDone };
    s = runUntil(s, (x) => x.step === fakeOnly + 1 || x.phase !== 'shuffle');
    expect(s.slots).toEqual(before.slots);
    expect(s.swapsDone).toBe(before.done);
  });

  it('Prepare: Lure one out adds an empty bin; Slower shuffle adds time to every swap', () => {
    const plain = newRaccoonShuffle({ tier: 2, packs: PACKS }, ['finn'], 4);
    const lured = newRaccoonShuffle({ tier: 2, packs: PACKS, extraEmpty: 1 }, ['finn'], 4);
    expect(lured.bins.filter((b) => b.card === null)).toHaveLength(
      plain.bins.filter((b) => b.card === null).length + 1,
    );
    const slow = newRaccoonShuffle({ tier: 2, packs: PACKS, extraSwapSec: 0.12 }, ['finn'], 4);
    expect(slow.steps[0]!.sec).toBeCloseTo(plain.steps[0]!.sec + 0.12);
  });

  it('every swap keeps each bin’s contents with it; the bin picked opens with what was put in it', () => {
    for (const tier of TIERS) {
      const s0 = newRaccoonShuffle({ tier, packs: PACKS }, ['finn'], tier * 7);
      const contents = new Map(s0.bins.map((b) => [b.id, b.card]));
      const s = toPick(s0);
      expect(s.swapsDone).toBe(RS.tiers[tier].swaps);
      // The bins moved (the slots changed), but each bin's card didn't.
      expect(s.bins.map((b) => contents.get(b.id))).toEqual(s.bins.map((b) => b.card));
      // Following the swaps by hand gives the same order.
      let slots = s0.slots;
      for (const step of s0.steps) {
        const next = [...slots];
        for (const [a, b] of step.pairs) [next[a], next[b]] = [next[b]!, next[a]!];
        slots = next;
      }
      expect(s.slots).toEqual(slots);
      const slot = 1;
      const opened = pickBin(s, slot);
      expect(binAt(opened, slot)).toBe(binAt(s, slot));
    }
  });

  it('an empty bin passes with no cost; a raccoon steals exactly the item on its card', () => {
    let s = toPick(newRaccoonShuffle({ tier: 2, packs: PACKS }, ['finn', 'mom'], 5));
    s = pickBin(s, slotOf(s, true));
    s = runUntil(s, (x) => x.turns.at === 1);
    expect(s.turns.done.finn).toBe(true);
    s = toPick(s);
    const raccoon = slotOf(s, false);
    const card = binAt(s, raccoon).card!;
    s = pickBin(s, raccoon);
    expect(s.phase).toBe('open');
    s = runUntil(s, (x) => x.over);
    expect(s.turns.done.mom).toBe(false);
    const r = result(s);
    expect(r.safe).toEqual(['finn']);
    expect(r.pays!.finn).toBeUndefined();
    // Mom carries one fish: the card is fish or energy.
    expect(r.pays!.mom).toEqual(
      card.kind === 'resource' ? { stolen: [card.id] } : { energy: RS.raccoonEnergy },
    );
    expect(r.pays!.mom!.energy ?? 0).toBeLessThanOrEqual(RS.raccoonEnergy);
    if (card.kind === 'resource') expect(costText(r.pays!.mom)).toBe('−1 FISH');
  });

  it('picking only works when it’s time to pick; keys move the selection', () => {
    const s0 = newRaccoonShuffle({ tier: 1, packs: PACKS }, ['finn'], 2);
    expect(s0.phase).toBe('show');
    expect(pickBin(s0, 0)).toBe(s0);
    const s = toPick(s0);
    const left = select(select(select(s, -1), -1), -1);
    expect(left.selected).toBe(0);
    expect(select(left, 1).selected).toBe(1);
  });

  it('each hiker gets a new fill and a new shuffle; their pack decides their cards', () => {
    let s = newRaccoonShuffle({ tier: 3, packs: PACKS }, ['finn', 'ellie'], 9);
    const first = { bins: s.bins, steps: s.steps };
    s = toPick(s);
    s = pickBin(s, 0);
    s = runUntil(s, (x) => x.turns.at === 1);
    expect(s.turns.handoff).toBeCloseTo(Q.handoffSec);
    expect(s.phase).toBe('show');
    expect(s.swapsDone).toBe(0);
    expect(s.steps).not.toEqual(first.steps);
    // Ellie carries nothing: every raccoon holds an energy card.
    expect(s.bins.filter((b) => b.card).every((b) => b.card!.kind === 'energy')).toBe(true);
  });

  it('night: Auto uses the tier’s chance (never below Tier III); On and Off force it', () => {
    const nights = (tier: 1 | 4) =>
      Array.from(
        { length: 200 },
        (_, k) => newRaccoonShuffle({ tier, packs: {} }, ['finn'], k + 1).night,
      );
    expect(nights(1).some(Boolean)).toBe(false);
    const share = nights(4).filter(Boolean).length / 200;
    expect(share).toBeGreaterThan(0.12);
    expect(share).toBeLessThan(0.4);
    expect(newRaccoonShuffle({ tier: 1, night: 'on', packs: {} }, ['finn'], 1).night).toBe(true);
  });

  it('the bins fit across the screen at every tier', () => {
    for (const tier of TIERS) {
      const n = RS.tiers[tier].bins;
      expect(binX(0, n) - 18).toBeGreaterThanOrEqual(0);
      expect(binX(n - 1, n) + 18).toBeLessThanOrEqual(320);
      if (n > 1) expect(binX(1, n) - binX(0, n)).toBeGreaterThanOrEqual(36);
    }
  });

  it.each(TIERS)(
    'Tier %i: only empty bins are taken, and exactly one is left (two with LURE ONE OUT)',
    (tier) => {
      for (let seed = 1; seed <= 25; seed++) {
        for (const lure of [0, 1]) {
          const s = toPick(
            newRaccoonShuffle({ tier, packs: PACKS, extraEmpty: lure }, ['finn'], seed),
          );
          expect(s.phase).toBe('pick');
          expect(s.hauls).toHaveLength(RS.tiers[tier].takeAway);
          for (const h of s.hauls) {
            const bin = s.bins[h.bin]!;
            expect(bin.card).toBeNull();
            expect(bin.lure).toBeUndefined();
          }
          expect(emptiesLeft(s)).toHaveLength(1 + lure);
          expect(takeCount(s)).toBe(RS.tiers[tier].takeAway);
        }
      }
    },
  );

  it('the hauls come after a pause, one after the other, and the pick only after the last', () => {
    let s = newRaccoonShuffle({ tier: 5, packs: PACKS }, ['finn'], 3);
    s = runUntil(s, (x) => x.phase === 'takeAway');
    const T = RS.takeAway;
    const [a, b] = s.hauls;
    expect(a!.at - s.phaseAt).toBeCloseTo(T.pauseSec);
    expect(b!.at - a!.at).toBeCloseTo(T.haulSec + T.apartSec);
    const picked = toPick(s);
    expect(picked.time).toBeGreaterThanOrEqual(b!.at + T.haulSec - 1e-9);
  });

  it('a gap can’t be picked, and keys skip over it', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = toPick(newRaccoonShuffle({ tier: 3, packs: PACKS }, ['finn', 'mom'], seed));
      const gap = s.slots.findIndex((_, k) => takenAt(s, k));
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(pickBin(s, gap)).toBe(s);
      expect(takenAt(s, s.selected)).toBe(false);
      // Walk the selection from one end to the other: it never lands on the gap.
      let x: RaccoonShuffleState = { ...s, selected: 0 };
      if (takenAt(x, 0)) x = select(x, 1);
      for (let k = 0; k < s.slots.length; k++) {
        expect(takenAt(x, x.selected)).toBe(false);
        x = select(x, 1);
      }
    }
  });

  it('Tiers I and II take nothing away', () => {
    for (const tier of [1, 2] as const) {
      const s = toPick(newRaccoonShuffle({ tier, packs: PACKS }, ['finn'], 9));
      expect(s.hauls).toEqual([]);
    }
  });

  it('the demo bot follows one empty bin, and picks from what’s left when that one is taken', () => {
    for (let seed = 1; seed <= 20; seed++) {
      // It picks its bin once the hiker's turn starts (the show).
      let s = runUntil(newRaccoonShuffle({ tier: 4, packs: PACKS }, ['finn'], seed), (x) =>
        playing(x.turns),
      );
      const mem: Record<string, unknown> = {};
      const rng = seedRng(seed);
      raccoonShuffleBot(s, mem, rng, 0);
      const follow = mem.follow as number;
      expect(s.bins[follow]!.card).toBeNull();
      s = toPick(s);
      // It waits a moment before picking, like a player would.
      expect(raccoonShuffleBot(s, mem, rng, 100)).toBeNull();
      const slot = raccoonShuffleBot(s, mem, rng, 200);
      expect(slot).not.toBeNull();
      expect(takenAt(s, slot!)).toBe(false);
      const followed = s.slots.indexOf(follow);
      if (!takenAt(s, followed)) expect(slot).toBe(followed);
    }
  });
});
