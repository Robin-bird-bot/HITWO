/**
 * Whackoon (docs/design/14-minigames-trail-blocks.md, section 6): everyone
 * at once in colors. Each hiker only counts their own color; a done hiker's
 * raccoons do nothing and rest the mallet; the number up never drops below
 * the tier's fewest (nor goes over the most); a skunk costs time and fogs;
 * time out passes exactly the hikers at their number.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { TIERS } from '../types';
import {
  isDone,
  newWhackoon,
  result,
  tick,
  upNow,
  whack,
  type Mole,
  type WhackoonState,
} from './logic';

const W = BALANCE.minigames.whackoon;
const THREE = ['finn', 'mom', 'ellie'];
const DT = 1 / 60;

const raccoon = (color: string, at = 0): Mole => ({
  kind: 'raccoon',
  color,
  upAt: at,
  until: at + 5,
});
const withCans = (s: WhackoonState, cans: (Mole | null)[]): WhackoonState => ({
  ...s,
  cans: [...cans, ...Array.from({ length: s.cans.length - cans.length }, () => null)],
});

describe('Whackoon', () => {
  it('one shared clock of 8 s per hiker, and the tier’s numbers', () => {
    for (const tier of TIERS) {
      const s = newWhackoon({ tier }, THREE, 1);
      expect(s.timeLeft).toBe(W.secPerHiker * 3);
      expect(s.target).toBe(W.tiers[tier].target);
      expect(s.cans).toHaveLength(W.tiers[tier].cols * 3);
    }
  });

  it('the design table and the balance agree', () => {
    const t = W.tiers;
    expect([1, 2, 3, 4, 5].map((k) => t[k as 1].upSec)).toEqual([1.2, 1.0, 0.8, 0.7, 0.6]);
    expect([1, 2, 3, 4, 5].map((k) => t[k as 1].minUp)).toEqual([2, 2, 3, 3, 3]);
    expect([1, 2, 3, 4, 5].map((k) => t[k as 1].maxUp)).toEqual([3, 4, 4, 5, 5]);
    expect([1, 2, 3, 4, 5].map((k) => t[k as 1].skunks)).toEqual([0, 0.15, 0.25, 0.3, 0.35]);
    expect([1, 2, 3, 4, 5].map((k) => t[k as 1].target)).toEqual([5, 6, 7, 8, 9]);
    expect([1, 2, 3, 4, 5].map((k) => t[k as 1].cols)).toEqual([3, 3, 4, 4, 4]);
  });

  it.each(TIERS)(
    'Tier %i: the number up never drops below the fewest for long, and never goes over the most',
    (tier) => {
      const t = W.tiers[tier];
      let s = newWhackoon({ tier, skunks: 'off' }, THREE, tier);
      let shortFor = 0;
      for (let i = 0; i < 60 * 20 && !s.over; i++) {
        s = tick(s, DT);
        const up = upNow(s);
        expect(up).toBeLessThanOrEqual(t.maxUp);
        shortFor = up < t.minUp ? shortFor + DT : 0;
        expect(shortFor).toBeLessThanOrEqual(W.refillSec + DT + 1e-9);
        // Whack whatever is up now and then, so they keep going down.
        if (i % 20 === 0) {
          const k = s.cans.findIndex((m) => m && m.bonkedAt === undefined && s.time < m.until);
          if (k >= 0) s = whack(s, k).state;
        }
      }
    },
  );

  it('raccoons wear the hikers’ colors, dealt out evenly', () => {
    let s = newWhackoon({ tier: 1 }, THREE, 2);
    const seen = new Map<number, string>();
    for (let i = 0; i < 60 * 20 && !s.over; i++) {
      s = tick(s, DT);
      s.cans.forEach((m, k) => {
        if (m && m.kind === 'raccoon') seen.set(m.upAt * 100 + k, m.color ?? '');
      });
    }
    const colors = [...seen.values()];
    expect(colors.length).toBeGreaterThan(9);
    expect(colors.every((c) => THREE.includes(c))).toBe(true);
    const counts = THREE.map((id) => colors.filter((c) => c === id).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
  });

  it('each hiker only counts their own color', () => {
    const s0 = withCans(newWhackoon({ tier: 1 }, THREE, 3), [raccoon('mom'), raccoon('ellie')]);
    const a = whack(s0, 0);
    expect(a.outcome).toBe('bonk');
    expect(a.state.whacks).toEqual({ finn: 0, mom: 1, ellie: 0 });
    expect(whack(a.state, 1).state.whacks).toEqual({ finn: 0, mom: 1, ellie: 1 });
  });

  it('a done hiker’s raccoon does nothing when whacked, and the mallet rests 0.5 s', () => {
    const base = newWhackoon({ tier: 1 }, THREE, 4);
    const s0 = withCans({ ...base, whacks: { finn: base.target, mom: 0, ellie: 0 } }, [
      raccoon('finn'),
      raccoon('mom'),
    ]);
    expect(isDone(s0, 'finn')).toBe(true);
    const wasted = whack(s0, 0);
    expect(wasted.outcome).toBe('wasted');
    expect(wasted.state.whacks.finn).toBe(base.target);
    expect(wasted.state.cans[0]?.bonkedAt).toBeUndefined();
    expect(wasted.state.malletUntil).toBeCloseTo(s0.time + W.donePauseSec);
    // While the mallet rests, nothing can be whacked, not even another color.
    expect(whack(wasted.state, 1).outcome).toBe('empty');
    const later = withCans({ ...wasted.state, time: wasted.state.malletUntil }, [
      null,
      raccoon('mom', wasted.state.malletUntil),
    ]);
    expect(whack(later, 1).outcome).toBe('bonk');
  });

  it('a skunk costs 2 s off the clock and fogs the cans; it never counts', () => {
    const s0 = withCans(newWhackoon({ tier: 2 }, THREE, 5), [{ kind: 'skunk', upAt: 0, until: 5 }]);
    const out = whack(s0, 0);
    expect(out.outcome).toBe('spray');
    expect(out.state.timeLeft).toBeCloseTo(s0.timeLeft - W.sprayCostSec);
    expect(out.state.fogUntil).toBeCloseTo(s0.time + W.sprayFogSec);
    expect(Object.values(out.state.whacks).every((n) => n === 0)).toBe(true);
  });

  it('skunks follow the setting', () => {
    expect(newWhackoon({ tier: 1 }, THREE, 1).skunkChance).toBe(0);
    expect(newWhackoon({ tier: 1, skunks: 'on' }, THREE, 1).skunkChance).toBe(W.skunksOn);
    expect(newWhackoon({ tier: 3, skunks: 'off' }, THREE, 1).skunkChance).toBe(0);
  });

  it('when the clock runs out, exactly the hikers at their number pass; the rest lose energy', () => {
    const base = newWhackoon({ tier: 1 }, THREE, 6);
    let s: WhackoonState = { ...base, whacks: { finn: base.target, mom: 2, ellie: 0 } };
    while (!s.over) s = tick(s, DT);
    expect(s.time).toBeCloseTo(W.secPerHiker * 3, 1);
    const r = result(s);
    expect(r.safe).toEqual(['finn']);
    expect(r.pays).toEqual({ mom: { energy: W.failEnergy }, ellie: { energy: W.failEnergy } });
    expect(r.passing).toBeUndefined();
  });

  it('it ends early once everyone is done, and everyone passes', () => {
    const base = newWhackoon({ tier: 1 }, ['finn'], 7);
    const s0 = withCans({ ...base, whacks: { finn: base.target - 1 } }, [raccoon('finn')]);
    const out = whack(s0, 0);
    expect(out.state.over).toBe(true);
    expect(result(out.state).safe).toEqual(['finn']);
    expect(result(out.state).pays).toEqual({});
  });
});
