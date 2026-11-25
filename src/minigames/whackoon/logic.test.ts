/**
 * Whackoon (docs/design/14-minigames-trail-blocks.md, section 6): Colors
 * (each hiker only counts their own color; a done hiker's raccoons do
 * nothing and rest the pan; time out passes exactly the hikers at their
 * target), Turns (in order, the team total, the target), and skunks.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import {
  isDone,
  newWhackoon,
  result,
  tick,
  turnHiker,
  whack,
  type Mole,
  type WhackoonState,
} from './logic';

const W = BALANCE.minigames.whackoon;
const THREE = ['finn', 'mom', 'ellie'];
const DT = 1 / 60;

/** Plays on, whacking every raccoon that's up (and never a skunk). */
function play(s0: WhackoonState, sec: number, whacking = true): WhackoonState {
  let s = s0;
  for (let t = 0; t < sec - 1e-9 && !s.over; t += DT) {
    s = tick(s, DT);
    if (!whacking) continue;
    s.cans.forEach((m, i) => {
      if (m && m.kind === 'raccoon' && m.bonkedAt === undefined) s = whack(s, i).state;
    });
  }
  return s;
}

describe('Whackoon, Colors (the default)', () => {
  const raccoon = (color: string): Mole => ({ kind: 'raccoon', color, upAt: 0, until: 5 });
  const withCans = (s: WhackoonState, cans: (Mole | null)[]): WhackoonState => ({
    ...s,
    cans: [...cans, ...Array.from({ length: s.cans.length - cans.length }, () => null)],
  });

  it('is the default: one shared clock of 8 s per hiker, and a target each by tier', () => {
    const s = newWhackoon({ tier: 2 }, THREE, 1);
    expect(s.mode).toBe('colors');
    expect(s.turnLeft).toBe(W.colorSecPerHiker * 3);
    expect(s.colorTarget).toBe(W.tiers[2].colorTarget);
    expect(turnHiker(s)).toBeUndefined();
  });

  it('raccoons wear the hikers’ colors, dealt out evenly', () => {
    let s = newWhackoon({ tier: 1 }, THREE, 2);
    const seen = new Map<number, string>();
    for (let i = 0; i < 60 * 20 && !s.over; i++) {
      s = tick(s, DT);
      s.cans.forEach((m) => {
        if (m && m.kind === 'raccoon' && !seen.has(m.upAt)) seen.set(m.upAt, m.color ?? '');
      });
    }
    const colors = [...seen.values()];
    expect(colors.length).toBeGreaterThan(9);
    expect(colors.every((c) => THREE.includes(c))).toBe(true);
    const counts = THREE.map((id) => colors.filter((c) => c === id).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it('each hiker only counts their own color', () => {
    const s0 = withCans(newWhackoon({ tier: 1 }, THREE, 3), [raccoon('mom'), raccoon('ellie')]);
    const a = whack(s0, 0);
    expect(a.outcome).toBe('bonk');
    expect(a.state.whacks).toEqual({ finn: 0, mom: 1, ellie: 0 });
    const b = whack(a.state, 1);
    expect(b.state.whacks).toEqual({ finn: 0, mom: 1, ellie: 1 });
  });

  it('a done hiker’s raccoon does nothing when whacked, and the pan rests 0.5 s', () => {
    const base = newWhackoon({ tier: 1 }, THREE, 4);
    const s0 = withCans({ ...base, whacks: { finn: base.colorTarget, mom: 0, ellie: 0 } }, [
      raccoon('finn'),
      raccoon('mom'),
    ]);
    expect(isDone(s0, 'finn')).toBe(true);
    const wasted = whack(s0, 0);
    expect(wasted.outcome).toBe('wasted');
    expect(wasted.state.whacks.finn).toBe(base.colorTarget);
    expect(wasted.state.cans[0]?.bonkedAt).toBeUndefined();
    expect(wasted.state.panUntil).toBeCloseTo(s0.time + W.donePauseSec);
    // While the pan rests, nothing can be whacked, not even another color.
    expect(whack(wasted.state, 1).outcome).toBe('empty');
    let later = wasted.state;
    while (later.time < wasted.state.panUntil) later = tick(later, DT);
    later = withCans(later, [null, { ...raccoon('mom'), upAt: later.time, until: later.time + 1 }]);
    expect(whack(later, 1).outcome).toBe('bonk');
  });

  it('a skunk costs 2 s off the shared clock and fogs the cans', () => {
    const s0 = withCans(newWhackoon({ tier: 2 }, THREE, 5), [{ kind: 'skunk', upAt: 0, until: 5 }]);
    const out = whack(s0, 0);
    expect(out.outcome).toBe('spray');
    expect(out.state.turnLeft).toBeCloseTo(s0.turnLeft - W.sprayCostSec);
    expect(out.state.fogUntil).toBeCloseTo(s0.time + W.sprayFogSec);
  });

  it('when the clock runs out, exactly the hikers at their target pass; the rest lose energy', () => {
    const base = newWhackoon({ tier: 1 }, THREE, 6);
    let s: WhackoonState = { ...base, whacks: { finn: base.colorTarget, mom: 2, ellie: 0 } };
    while (!s.over) s = tick(s, DT);
    expect(s.time).toBeCloseTo(W.colorSecPerHiker * 3, 1);
    const r = result(s);
    expect(r.safe).toEqual(['finn']);
    expect(r.pays).toEqual({ mom: { energy: W.failEnergy }, ellie: { energy: W.failEnergy } });
    expect(r.passing).toBeUndefined();
  });

  it('it ends early once everyone is done, and everyone passes', () => {
    const base = newWhackoon({ tier: 1 }, ['finn'], 7);
    const s0 = withCans({ ...base, whacks: { finn: base.colorTarget - 1 } }, [raccoon('finn')]);
    const out = whack(s0, 0);
    expect(out.state.over).toBe(true);
    expect(result(out.state).safe).toEqual(['finn']);
    expect(result(out.state).pays).toEqual({});
  });
});

describe('Whackoon, Turns', () => {
  it('turns go in line order, each the same length, and it ends after the last', () => {
    let s = newWhackoon({ tier: 1, mode: 'turns' }, THREE, 1);
    const turns: string[] = [turnHiker(s)!];
    while (!s.over) {
      const prev = turnHiker(s);
      s = tick(s, DT);
      if (!s.over && turnHiker(s) !== prev) turns.push(turnHiker(s)!);
    }
    expect(turns).toEqual(THREE);
    expect(s.time).toBeCloseTo(W.turnSec * 3, 1);
  });

  it('the team total adds up every hiker’s whacks', () => {
    const s = play(newWhackoon({ tier: 1, mode: 'turns' }, THREE, 2), 6);
    expect(s.team).toBeGreaterThan(0);
    expect(Object.values(s.whacks).reduce((a, b) => a + b, 0)).toBe(s.team);
    expect(s.whacks.finn).toBe(s.team);
  });

  it('popping up never goes over the most at once, and Tier III has 4 columns', () => {
    let s = newWhackoon({ tier: 2 }, THREE, 3);
    for (let i = 0; i < 60 * 20 && !s.over; i++) {
      s = tick(s, DT);
      const up = s.cans.filter((m) => m && m.bonkedAt === undefined && s.time < m.until).length;
      expect(up).toBeLessThanOrEqual(W.tiers[2].maxUp);
    }
    expect(newWhackoon({ tier: 3 }, THREE, 1).cans).toHaveLength(12);
    expect(newWhackoon({ tier: 5 }, THREE, 1).cans).toHaveLength(12);
  });

  it('a skunk costs 2 s and fogs the cans; it never counts', () => {
    const s0: WhackoonState = {
      ...newWhackoon({ tier: 2, mode: 'turns' }, THREE, 4),
      cans: [{ kind: 'skunk', upAt: 0, until: 5 }, ...Array.from({ length: 8 }, () => null)],
    };
    const out = whack(s0, 0);
    expect(out.outcome).toBe('spray');
    expect(out.state.turnLeft).toBeCloseTo(s0.turnLeft - W.sprayCostSec);
    expect(out.state.fogUntil).toBeCloseTo(s0.time + W.sprayFogSec);
    expect(out.state.team).toBe(0);
    expect(whack(s0, 3).outcome).toBe('empty');
  });

  it('skunks follow the setting', () => {
    expect(newWhackoon({ tier: 1 }, THREE, 1).skunkChance).toBe(0);
    expect(newWhackoon({ tier: 1, skunks: 'on' }, THREE, 1).skunkChance).toBe(W.skunksOn);
    expect(newWhackoon({ tier: 3, skunks: 'off' }, THREE, 1).skunkChance).toBe(0);
  });

  it('reaching the target ends it and passes everyone; missing it fails everyone, losing energy', () => {
    const hit = play({ ...newWhackoon({ tier: 1, mode: 'turns' }, THREE, 5), target: 3 }, 30);
    expect(hit.over).toBe(true);
    expect(hit.team).toBe(3);
    expect(result(hit).safe).toEqual(THREE);
    expect(result(hit).pays).toEqual({});
    const missed = play(newWhackoon({ tier: 1, mode: 'turns' }, THREE, 6), 40, false);
    expect(missed.over).toBe(true);
    const r = result(missed);
    expect(r.safe).toEqual([]);
    expect(r.pays).toEqual(Object.fromEntries(THREE.map((id) => [id, { energy: W.failEnergy }])));
    expect(r.passing).toBeUndefined();
    expect(missed.target).toBe(W.tiers[1].targetPerHiker * 3);
  });
});
