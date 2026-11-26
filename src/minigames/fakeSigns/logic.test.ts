/**
 * Fake Trail Signs (docs/design/19-minigames-signs-trails.md, sections 1 and
 * 7): every real sign follows every rule and every fake breaks exactly one;
 * at least half of each round's signs make the new rule's condition true; a
 * new rule never makes real or fake signs impossible; a pass adds a rule up
 * to the cap and a fail repeats the same rules for the next hiker; the
 * minimum is always reached when someone can still play, and passed hikers
 * replay in order; Tiers IV and V hide old rules but still check them.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { TIERS } from '../types';
import {
  answer,
  newFakeSigns,
  nextPlayer,
  planSigns,
  result,
  shownRules,
  tick,
  understand,
  whyText,
  type FakeSignsState,
} from './logic';
import { broken, follows, newRule, pools, signPool, type Rule } from './rules';

const F = BALANCE.minigames.fakeSigns;
const Q = BALANCE.minigames.quick;

/** A rule set built like a game builds it: one rule at a time, up to `n`. */
function ruleSet(seed: number, tier: (typeof TIERS)[number], n: number): Rule[] {
  const rng = seedRng(seed);
  const rules: Rule[] = [];
  for (let k = 0; k < n; k++) {
    const r = newRule(rng, tier, rules, signPool(rng, tier));
    expect(r).not.toBeNull();
    rules.push(r!);
  }
  return rules;
}

/** Answers the current sign right or wrong. */
const play = (s: FakeSignsState, right: boolean) => {
  const p = s.signs[s.index]!;
  const truth = p.fake ? 'fake' : 'real';
  return answer(s, right ? truth : truth === 'fake' ? 'real' : 'fake');
};
/** Plays a whole round: every sign right, or the first one wrong. */
function round(s0: FakeSignsState, pass: boolean): FakeSignsState {
  let s = understand(s0);
  if (!pass) {
    s = play(s, false);
    return tick(s, F.wrongSec + 0.01);
  }
  const who = s.current;
  while (s.current === who && s.phase === 'signs') s = play(s, true);
  return s;
}

describe('Fake Trail Signs: the rule generator', () => {
  it.each(TIERS)(
    'Tier %i: conditions and requirements are about different things, and new rules stay workable',
    (tier) => {
      for (let seed = 1; seed <= 15; seed++) {
        const rules = ruleSet(seed, tier, F.tiers[tier].cap);
        expect(new Set(rules.map((r) => r.text)).size).toBe(rules.length);
        for (const r of rules) {
          expect(r.req.topics.some((t) => r.cond.topics.includes(t))).toBe(false);
          expect(r.text).toMatch(/^IF .+, .+\.$/);
        }
        // With every rule in play, some real signs and some fakes of the newest rule exist where it matters.
        const pool = signPool(seedRng(seed + 99), tier, 3000);
        const newest = rules.length - 1;
        const on = pool.filter((s) => rules[newest]!.cond.test(s));
        expect(on.some((s) => broken(rules, s).length === 0)).toBe(true);
        expect(on.some((s) => broken(rules, s).join() === String(newest))).toBe(true);
      }
    },
  );

  it('the pools grow by tier: Tier III adds vowels, ends and digits; Tier IV adds AND / OR and more', () => {
    expect(pools(1).conds.length).toBeLessThan(pools(3).conds.length);
    expect(pools(3).conds.length).toBeLessThan(pools(4).conds.length);
    expect(pools(1).reqs.length).toBeLessThan(pools(3).reqs.length);
    expect(pools(3).reqs.length).toBeLessThan(pools(4).reqs.length);
    expect(pools(4)).toEqual(pools(5));
    // Tier I and II signs always have matching ends.
    for (const s of signPool(seedRng(3), 2, 200)) expect(s.left).toBe(s.right);
    expect(signPool(seedRng(3), 3, 200).some((s) => s.left !== s.right)).toBe(true);
  });
});

describe('Fake Trail Signs: a round’s signs', () => {
  it.each(TIERS)(
    'Tier %i: reals follow every rule, fakes break exactly one, half make the new rule matter',
    (tier) => {
      for (let seed = 1; seed <= 12; seed++) {
        for (let n = 1; n <= F.tiers[tier].cap; n++) {
          const rules = ruleSet(seed * 7 + n, tier, n);
          const newest = rules.length - 1;
          for (const per of [1, 2, 3, 4, 6]) {
            const signs = planSigns(seedRng(seed * 31 + per), tier, rules, per);
            expect(signs).toHaveLength(per);
            const fakes = signs.filter((p) => p.fake);
            for (const p of signs) {
              const b = broken(rules, p.sign);
              if (p.fake) {
                expect(b).toHaveLength(1);
                expect(p.breaks).toBe(b[0]);
              } else expect(rules.every((r) => follows(r, p.sign))).toBe(true);
            }
            // The newest rule at least half the time among fakes.
            const ofNewest = fakes.filter((p) => p.breaks === newest).length;
            expect(ofNewest).toBeGreaterThanOrEqual(Math.ceil(fakes.length / 2));
            // At least half the signs make the newest rule's condition true.
            const on = signs.filter((p) => rules[newest]!.cond.test(p.sign)).length;
            expect(on).toBeGreaterThanOrEqual(Math.ceil(per / 2));
            // 40–60% fake; at least one of each with 3 or more.
            if (per >= 3) {
              expect(fakes.length).toBeGreaterThanOrEqual(1);
              expect(fakes.length).toBeLessThanOrEqual(per - 1);
            }
            // No sign twice.
            expect(new Set(signs.map((p) => JSON.stringify(p.sign))).size).toBe(per);
          }
        }
      }
    },
  );

  it('a wrong answer says why: the rule a fake breaks, or that a real one follows them all', () => {
    const rules = ruleSet(5, 2, 2);
    const signs = planSigns(seedRng(8), 2, rules, 6);
    const fake = signs.find((p) => p.fake)!;
    expect(whyText(fake, rules)).toMatch(
      new RegExp(`^FAKE! IT BREAKS RULE ${fake.breaks! + 1}: .+\\.$`),
    );
    const real = signs.find((p) => !p.fake)!;
    expect(whyText(real, rules)).toBe('REAL! IT FOLLOWS EVERY RULE.');
  });
});

describe('Fake Trail Signs: turns', () => {
  it('a pass adds a rule (up to the cap); a fail keeps the same rules for the next hiker, with new signs', () => {
    let s = newFakeSigns({ tier: 2 }, ['finn', 'mom', 'ellie'], 4);
    expect(s.rules).toHaveLength(1);
    expect(s.current).toBe('finn');
    expect(s.phase).toBe('rules');
    s = round(s, true);
    expect(s.status.finn).toBe('passed');
    expect(s.rules).toHaveLength(2);
    expect(s.current).toBe('mom');
    const rulesBefore = s.rules.map((r) => r.text);
    const signsBefore = s.signs;
    s = round(s, false);
    expect(s.status.mom).toBe('failed');
    expect(s.current).toBe('ellie');
    expect(s.rules.map((r) => r.text)).toEqual(rulesBefore);
    expect(s.signs).not.toEqual(signsBefore);
    s = round(s, true);
    expect(s.rules).toHaveLength(3);
    expect(s.phase === 'done' || s.over).toBe(true);
  });

  it('the cap stops new rules; later rounds keep the same rules', () => {
    let s = newFakeSigns({ tier: 1, cap: 2 }, ['finn', 'mom', 'ellie'], 2);
    s = round(s, true);
    s = round(s, true);
    expect(s.rules).toHaveLength(2);
    s = round(s, true);
    expect(s.rules).toHaveLength(2);
  });

  it('the minimum is reached: hikers who passed replay in line order (a wrong answer then fails them too)', () => {
    // Tier V: the minimum is 4 rules. Two hikers: Finn passes, Mom fails; Finn plays again until it's reached.
    let s = newFakeSigns({ tier: 5 }, ['finn', 'mom'], 6);
    s = round(s, true);
    s = round(s, false);
    expect(s.rules).toHaveLength(2);
    expect(s.current).toBe('finn');
    s = round(s, true);
    expect(s.current).toBe('finn');
    s = round(s, true);
    expect(s.rules.length).toBeGreaterThanOrEqual(F.tiers[5].min);
    s = tick(s, 0.01);
    expect(s.over).toBe(true);
    expect(result(s)).toMatchObject({ safe: ['finn'], pays: { mom: { energy: Q.failEnergy } } });
    // A wrong answer in an extra round fails them, and with nobody left it ends.
    let t = newFakeSigns({ tier: 5 }, ['finn', 'mom'], 6);
    t = round(t, true);
    t = round(t, false);
    t = round(t, false);
    expect(t.status.finn).toBe('failed');
    expect(nextPlayer(t)).toBeNull();
    t = tick(t, 0.01);
    expect(t.over).toBe(true);
  });

  it('one hiker plays every round themselves', () => {
    let s = newFakeSigns({ tier: 3 }, ['finn'], 9);
    for (let k = 0; k < 2; k++) {
      expect(s.current).toBe('finn');
      s = round(s, true);
    }
    expect(s.rules.length).toBeGreaterThanOrEqual(F.tiers[3].min);
  });

  it('Tiers IV and V show only the newest rule; the old ones still count', () => {
    let s = newFakeSigns({ tier: 4 }, ['finn', 'mom', 'ellie'], 3);
    s = round(s, true);
    s = round(s, true);
    const shown = shownRules(s);
    expect(shown.rules).toHaveLength(1);
    expect(shown.rules[0]!.newest).toBe(true);
    expect(shown.hidden).toBe(s.rules.length - 1);
    for (const p of s.signs) {
      const b = broken(s.rules, p.sign);
      expect(p.fake ? b.length : b.length).toBe(p.fake ? 1 : 0);
    }
    expect(shownRules(newFakeSigns({ tier: 4, showOld: 'always' }, ['finn'], 3)).hidden).toBe(0);
    expect(shownRules(newFakeSigns({ tier: 2 }, ['finn'], 3)).hidden).toBe(0);
  });

  it('Time per sign: running out counts as a wrong answer', () => {
    let s = understand(newFakeSigns({ tier: 1, timePerSign: 5 }, ['finn'], 1));
    s = tick(s, 5.01);
    expect(s.phase).toBe('wrong');
    expect(s.status.finn).toBe('failed');
    expect(s.wrong?.text).toMatch(/^OUT OF TIME\./);
  });
});
