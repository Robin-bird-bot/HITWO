/**
 * Firefly Catch (docs/design/18-minigames-quick.md, sections 2 and 9): a
 * catch needs the firefly's center inside the ring; the firefly and the ring
 * never leave the box; a new firefly starts at least [60] units from the
 * ring; a dark firefly can still be caught.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { TIERS } from '../types';
import { inRing, isDark, newFireflyCatch, result, tap, tick, type FireflyState } from './logic';

const F = BALANCE.minigames.fireflyCatch;
const Q = BALANCE.minigames.quick;
const BOX = F.box;

/** The firefly placed `d` units from the ring's middle. */
const flyAt = (s: FireflyState, d: number): FireflyState => ({
  ...s,
  fly: { ...s.fly, x: s.ringAt.x + d, y: s.ringAt.y },
});

describe('Firefly Catch', () => {
  it.each(TIERS)('Tier %i: a catch needs the firefly’s center inside the ring', (tier) => {
    const s = newFireflyCatch({ tier }, ['finn'], 4);
    const r = F.tiers[tier].ring / 2;
    const inside = tap(flyAt(s, r - 0.5));
    expect(inside.caught).toBe(1);
    const outside = tap(flyAt(s, r + 0.5));
    expect(outside.caught).toBe(0);
    expect(outside.lastMiss).toBeDefined();
    // From Tier II a miss costs 1 s.
    expect(s.timeLeft - outside.timeLeft).toBeCloseTo(F.tiers[tier].missSec);
  });

  it('the firefly and the ring never leave the box', () => {
    for (const tier of TIERS) {
      let s = newFireflyCatch({ tier, timeSec: 30 }, ['finn'], tier * 13);
      for (let k = 0; k < 3000 && !s.over; k++) {
        s = tick(s, 1 / 120);
        expect(s.fly.x).toBeGreaterThanOrEqual(BOX.left);
        expect(s.fly.x).toBeLessThanOrEqual(BOX.right);
        expect(s.fly.y).toBeGreaterThanOrEqual(BOX.top);
        expect(s.fly.y).toBeLessThanOrEqual(BOX.bottom);
        const r = s.ring / 2;
        expect(s.ringAt.x - r).toBeGreaterThanOrEqual(BOX.left - 1e-9);
        expect(s.ringAt.x + r).toBeLessThanOrEqual(BOX.right + 1e-9);
        expect(s.ringAt.y - r).toBeGreaterThanOrEqual(BOX.top - 1e-9);
        expect(s.ringAt.y + r).toBeLessThanOrEqual(BOX.bottom + 1e-9);
      }
    }
  });

  it('a new firefly starts at least 60 units from the ring', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = newFireflyCatch({ tier: 3, catches: 6 }, ['finn'], seed);
      expect(Math.hypot(s.fly.x - s.ringAt.x, s.fly.y - s.ringAt.y)).toBeGreaterThanOrEqual(
        F.newAway,
      );
      const next = tap(flyAt(s, 0));
      expect(next.caught).toBe(1);
      expect(
        Math.hypot(next.fly.x - next.ringAt.x, next.fly.y - next.ringAt.y),
      ).toBeGreaterThanOrEqual(F.newAway);
    }
  });

  it('from Tier III the firefly goes dark now and then, and a dark firefly can still be caught', () => {
    expect(F.tiers[1].darkSec).toBe(0);
    let s = newFireflyCatch({ tier: 3, timeSec: 30 }, ['finn'], 8);
    let sawDark = false;
    for (let k = 0; k < 120 * 5 && !sawDark; k++) {
      s = tick(s, 1 / 120);
      sawDark = isDark(s);
    }
    expect(sawDark).toBe(true);
    const caught = tap(flyAt(s, 0));
    expect(isDark(flyAt(s, 0))).toBe(true);
    expect(caught.caught).toBe(1);
    // Never dark at Tier II.
    let low = newFireflyCatch({ tier: 2, timeSec: 30 }, ['finn'], 8);
    for (let k = 0; k < 120 * 5; k++) {
      low = tick(low, 1 / 120);
      expect(isDark(low)).toBe(false);
    }
  });

  it('the catches needed pass the hiker; running out of time fails them, with 1 energy', () => {
    let s = newFireflyCatch({ tier: 1 }, ['finn', 'mom'], 3);
    for (let k = 0; k < F.tiers[1].catches; k++) {
      expect(inRing(flyAt(s, 0))).toBe(true);
      s = tap(flyAt(s, 0));
    }
    expect(s.turns.done.finn).toBe(true);
    expect(s.record.finn).toBe(F.tiers[1].catches);
    // Mom never taps.
    for (let k = 0; k < 120 * 20 && !s.over; k++) s = tick(s, 1 / 120);
    expect(s.over).toBe(true);
    expect(s.turns.done.mom).toBe(false);
    const r = result(s);
    expect(r.safe).toEqual(['finn']);
    expect(r.pays).toEqual({ mom: { energy: Q.failEnergy } });
  });

  it('the Catches and Time settings override the tier', () => {
    const s = newFireflyCatch({ tier: 2, catches: 5, timeSec: 9 }, ['finn'], 1);
    expect(s.catchesNeeded).toBe(5);
    expect(s.timeLeft).toBe(9);
  });
});
