/**
 * Whackoon (docs/design/14-minigames-trail-blocks.md, section 6): turns in
 * order, the team total, skunks, and the target.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { newWhackoon, result, tick, turnHiker, whack, type WhackoonState } from './logic';

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

describe('Whackoon', () => {
  it('turns go in line order, each the same length, and it ends after the last', () => {
    let s = newWhackoon({ tier: 1 }, THREE, 1);
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
    const s = play(newWhackoon({ tier: 1 }, THREE, 2), 6);
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
  });

  it('a skunk costs 2 s and fogs the cans; it never counts', () => {
    const s0: WhackoonState = {
      ...newWhackoon({ tier: 2 }, THREE, 4),
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
    const hit = play({ ...newWhackoon({ tier: 1 }, THREE, 5), target: 3 }, 30);
    expect(hit.over).toBe(true);
    expect(hit.team).toBe(3);
    expect(result(hit).safe).toEqual(THREE);
    expect(result(hit).pays).toEqual({});
    const missed = play(newWhackoon({ tier: 1 }, THREE, 6), 40, false);
    expect(missed.over).toBe(true);
    const r = result(missed);
    expect(r.safe).toEqual([]);
    expect(r.pays).toEqual(Object.fromEntries(THREE.map((id) => [id, { energy: W.failEnergy }])));
    expect(r.passing).toBeUndefined();
    expect(missed.target).toBe(W.tiers[1].targetPerHiker * 3);
  });
});
