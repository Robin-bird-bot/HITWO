/**
 * Wrong Turn (docs/design/30-quick-minigames.md, sections 2 and 6): a
 * bearing locks only after the hold time in the notch; leaving drains the
 * bar; each new bearing is at least [60°] from the last; the clock running
 * out fails the party; Prepare; and the demo bot.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { TIERS, type Tier } from '../types';
import { wrongTurnBot } from './bot';
import {
  bearingNow,
  inNotch,
  newWrongTurn,
  notchHidden,
  result,
  setTurn,
  tick,
  turnTo,
  wobbleAt,
  type WrongTurnState,
} from './logic';

const W = BALANCE.minigames.wrongTurn;
const DT = 1 / 120;
const THREE = ['finn', 'mom', 'ellie'];

const run = (s0: WrongTurnState, sec: number) => {
  let s = s0;
  for (let k = 0; k < Math.round(sec / DT) && !s.over; k++) s = tick(s, DT);
  return s;
};
/** The needle put straight onto an angle (as if it had settled there). */
const pointAt = (s: WrongTurnState, deg: number): WrongTurnState => ({
  ...s,
  aim: deg,
  aimSpeed: 0,
  needle: deg,
  needleSpeed: 0,
});

describe('the bearings', () => {
  it('one per hiker, at least [3]; each at least [60°] from the last, on a multiple of [5°]', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = newWrongTurn({ tier: 1 }, ['finn', 'mom', 'ellie', 'wyatt'], seed);
      expect(s.bearings).toHaveLength(4);
      let from = 0;
      for (const b of s.bearings) {
        expect(b % W.roundDeg).toBe(0);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(360);
        expect(Math.abs(turnTo(from, b))).toBeGreaterThanOrEqual(W.apartDeg);
        from = b;
      }
    }
    const two = newWrongTurn({ tier: 1 }, ['finn', 'mom'], 1);
    expect(two.bearings).toHaveLength(W.minBearings);
    expect(two.whose).toEqual(['finn', 'mom', 'finn']);
  });

  it('the clock is the tier’s per bearing, for every bearing', () => {
    expect(newWrongTurn({ tier: 1 }, THREE, 1).clockSec).toBe(3 * W.tiers[1].clockSec);
    expect(newWrongTurn({ tier: 5 }, THREE, 1).clockSec).toBe(3 * W.tiers[5].clockSec);
    expect(newWrongTurn({ tier: 1, clockSec: 12 }, THREE, 1).clockSec).toBe(36);
  });
});

describe('the needle', () => {
  it('turns while a key is held, keeps going a little when let go, and settles', () => {
    let s = setTurn(newWrongTurn({ tier: 1 }, THREE, 1), 1);
    s = run(s, 0.4);
    expect(s.needle).toBeGreaterThan(10);
    s = setTurn(s, 0);
    const letGo = s.needle;
    s = run(s, 0.3);
    expect(s.needle).toBeGreaterThan(letGo);
    const settled = run(s, 2).needle;
    expect(Math.abs(run(s, 3).needle - settled)).toBeLessThan(0.5);
  });

  it('A turns it the other way', () => {
    const s = run(setTurn(newWrongTurn({ tier: 1 }, THREE, 1), -1), 0.4);
    expect(s.needle).toBeLessThan(-10);
  });

  it('springier from Tier III: it overshoots more', () => {
    const swing = (tier: Tier) => {
      let s = setTurn({ ...newWrongTurn({ tier, map: 1 }, THREE, 1) }, 1);
      s = setTurn(run(s, 0.3), 0);
      let most = s.needle;
      for (let k = 0; k < 240; k++) {
        s = tick(s, DT);
        most = Math.max(most, s.needle);
      }
      return most - run(s, 3).needle;
    };
    expect(swing(5)).toBeGreaterThan(swing(1));
  });
});

describe('locking', () => {
  it('a bearing locks only after the hold time in the notch', () => {
    const s0 = newWrongTurn({ tier: 1 }, THREE, 1);
    let s = pointAt(s0, bearingNow(s0)!);
    expect(inNotch(s)).toBe(true);
    s = run(s, W.tiers[1].holdSec * 0.8);
    expect(s.at).toBe(0);
    s = run(s, W.tiers[1].holdSec * 0.3);
    expect(s.at).toBe(1);
    expect(s.lastLock?.index).toBe(0);
    expect(s.flash).toBeGreaterThan(0);
  });

  it('leaving the notch drains the bar [2×] as fast', () => {
    const s0 = newWrongTurn({ tier: 1 }, THREE, 1);
    let s = run(pointAt(s0, bearingNow(s0)!), 0.3);
    const filled = s.hold;
    s = run(pointAt(s, bearingNow(s0)! + 90), 0.1);
    expect(s.hold).toBeCloseTo(filled - W.drainTimes * 0.1, 1);
  });

  it('the clock stops while a lock flashes', () => {
    const s0 = newWrongTurn({ tier: 1 }, THREE, 1);
    const s = run(pointAt(s0, bearingNow(s0)!), W.tiers[1].holdSec + 0.05);
    const left = s.timeLeft;
    expect(run(s, W.lockPauseSec / 2).timeLeft).toBe(left);
  });

  it('every bearing locked passes the party; the clock running out fails it', () => {
    let s = newWrongTurn({ tier: 1 }, THREE, 2);
    while (!s.over) s = run(pointAt(s, bearingNow(s) ?? 0), 0.1);
    expect(s.passed).toBe(true);
    expect(result(s).passing).toEqual({ moveOn: THREE, goBack: [], stays: false });

    const lost = run(newWrongTurn({ tier: 1 }, THREE, 2), 60);
    expect(lost).toMatchObject({ over: true, passed: false, at: 0 });
    expect(result(lost).passing).toMatchObject({ moveOn: [], goBack: THREE, stays: true });
  });
});

describe('the higher tiers', () => {
  it('the needle wobbles from Tier III; the notch hides from Tier IV', () => {
    const one = newWrongTurn({ tier: 1 }, THREE, 1);
    expect(wobbleAt(one, 1.3)).toBe(0);
    const three = newWrongTurn({ tier: 3 }, THREE, 1);
    expect([0.5, 1.3, 2.9].some((t) => Math.abs(wobbleAt(three, t)) > 1)).toBe(true);
    expect(notchHidden(run(three, 3))).toBe(false);
    const four = newWrongTurn({ tier: 4 }, THREE, 1);
    expect(notchHidden(four)).toBe(false);
    expect(notchHidden(run(four, W.tiers[4].hideSec! + 0.1))).toBe(true);
  });
});

describe('Prepare', () => {
  it('FOOD adds seconds; a CAIRN widens the notch; a LUCKY CHARM halves the hold', () => {
    const base = newWrongTurn({ tier: 2 }, THREE, 1);
    const prepped = newWrongTurn({ tier: 2, extraSec: 6, cairns: 1, charm: 1 }, THREE, 1);
    expect(prepped.clockSec).toBe(base.clockSec + 6);
    expect(prepped.notchDeg).toBe(base.notchDeg + W.cairnDeg);
    expect(prepped.holdSec).toBeCloseTo(base.holdSec * W.charmHold);
  });

  it('a SUPPLY MAP: the notch never hides, and the needle doesn’t wobble', () => {
    const s = newWrongTurn({ tier: 5, map: 1 }, THREE, 1);
    expect(wobbleAt(s, 1.3)).toBe(0);
    expect(notchHidden(run(s, 5))).toBe(false);
  });
});

describe('the demo bot', () => {
  function passRate(tier: Tier, runs = 30): number {
    let passed = 0;
    for (let seed = 1; seed <= runs; seed++) {
      let s = newWrongTurn({ tier }, THREE, seed);
      const mem: Record<string, unknown> = {};
      const rng = seedRng(seed * 13 + 5);
      while (!s.over) {
        const t = wrongTurnBot(s, mem, rng, s.time);
        if (t !== null) s = setTurn(s, t);
        s = tick(s, DT);
      }
      if (s.passed) passed++;
    }
    return passed / runs;
  }

  // 30 aims for [70–85%] at Tier I; the bot does better (the PR has the numbers).
  it('passes Tier I most of the time, and fewer at Tier V', () => {
    const one = passRate(1);
    expect(one).toBeGreaterThanOrEqual(0.7);
    expect(passRate(5)).toBeLessThan(one);
  });

  it('plays every tier to the end', () => {
    for (const tier of TIERS) expect(passRate(tier, 2)).toBeGreaterThanOrEqual(0);
  });
});
