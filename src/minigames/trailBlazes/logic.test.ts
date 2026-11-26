/**
 * Trail Blazes (docs/design/18-minigames-quick.md, sections 1 and 9):
 * "level" uses the blazes' centers and the tier's distance; a lit pair that
 * passes without a tap is a miss; a new pair always starts at least [80]
 * units apart; Tries and Clock modes both end the turn correctly.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { TIERS } from '../types';
import {
  blazeY,
  isLevel,
  litGap,
  newTrailBlazes,
  result,
  tap,
  tick,
  type TrailBlazesState,
} from './logic';

const TB = BALANCE.minigames.trailBlazes;
const Q = BALANCE.minigames.quick;
const DT = 1 / 120;

/** Ticks until `until` holds (or the time runs out). */
function runUntil(s0: TrailBlazesState, until: (s: TrailBlazesState) => boolean, sec = 30) {
  let s = s0;
  for (let t = 0; t < sec && !s.over && !until(s); t += DT) s = tick(s, DT);
  return s;
}

/** Plays the current pair perfectly: waits until they're as close as they'll get, then taps. */
function matchOne(s0: TrailBlazesState): TrailBlazesState {
  const s = runUntil(s0, (s) => s.lit !== null && Math.abs(litGap(s)!) <= s.level / 3);
  return tap(s);
}

describe('Trail Blazes', () => {
  it.each(TIERS)(
    'Tier %i: every new pair starts 80 to 140 apart, heading toward each other',
    (tier) => {
      for (let seed = 1; seed <= 15; seed++) {
        let s = newTrailBlazes({ tier }, ['finn', 'mom'], seed);
        let lit = s.lit;
        for (let k = 0; k < 400 && !s.over; k++) {
          if (s.lit && s.lit !== lit && s.lit.age === 0) {
            const gap = litGap(s)!;
            expect(gap).toBeGreaterThanOrEqual(TB.startApart[0]);
            expect(gap).toBeLessThanOrEqual(TB.startApart[1]);
            expect(blazeY(s, 'l', s.lit.l)).toBeLessThanOrEqual(TB.litY[1]);
            expect(blazeY(s, 'r', s.lit.r)).toBeGreaterThanOrEqual(TB.litY[0]);
          }
          lit = s.lit;
          s = k % 3 === 0 ? tap(s) : tick(s, 0.05);
        }
      }
    },
  );

  it('"level" uses the centers and the tier’s distance: a tap within it matches, outside it misses', () => {
    for (const tier of TIERS) {
      const s0 = newTrailBlazes({ tier }, ['finn'], 7);
      const level = TB.tiers[tier].level;
      // Just outside "level": a miss.
      const early = runUntil(s0, (s) => litGap(s)! <= level + 1.5);
      expect(isLevel(early)).toBe(false);
      const missed = tap(early);
      expect(missed.misses).toBe(1);
      expect(missed.matched).toBe(0);
      // Just inside: a match, and both blazes are gone.
      const inside = runUntil(missed, (s) => litGap(s)! <= level - 0.5);
      expect(isLevel(inside)).toBe(true);
      const { l, r } = inside.lit!;
      const hit = tap(inside);
      expect(hit.matched).toBe(1);
      expect(hit.goneL).toContain(l);
      expect(hit.goneR).toContain(r);
    }
  });

  it('a lit pair that passes without a tap is a miss, and a new pair lights up', () => {
    const s0 = newTrailBlazes({ tier: 1 }, ['finn'], 3);
    const s = runUntil(s0, (s) => s.misses > 0);
    expect(s.misses).toBe(1);
    expect(s.lastMiss?.why).toBe('passed');
    expect(s.lit?.age).toBe(0);
    expect(litGap(s)).toBeGreaterThanOrEqual(TB.startApart[0]);
  });

  it('Tries mode: the tier’s misses end the turn as failed; the next hiker starts fresh', () => {
    let s = newTrailBlazes({ tier: 2, tries: 2 }, ['finn', 'mom'], 5);
    s = tap(s);
    expect(s.turns.at).toBe(0);
    s = tap(s);
    expect(s.turns.done.finn).toBe(false);
    expect(s.turns.at).toBe(1);
    expect(s.turns.handoff).toBeCloseTo(Q.handoffSec);
    expect(s.misses).toBe(0);
    // Nothing moves during the hand-off, and taps do nothing.
    const off = s.offL;
    expect(tap(s)).toBe(s);
    s = tick(s, 0.5);
    expect(s.offL).toBe(off);
  });

  it('matching every pair passes the hiker', () => {
    let s = newTrailBlazes({ tier: 1 }, ['finn'], 11);
    for (let k = 0; k < TB.tiers[1].pairs; k++) s = matchOne(s);
    expect(s.over).toBe(true);
    expect(s.turns.done.finn).toBe(true);
    expect(s.record.finn).toEqual({ matched: TB.tiers[1].pairs, misses: 0 });
    expect(result(s)).toMatchObject({ safe: ['finn'], hit: [], pays: {} });
  });

  it('Clock mode: a miss costs 2 s, and running out of time fails the hiker with 1 energy', () => {
    let s = newTrailBlazes({ tier: 1, mode: 'clock' }, ['finn', 'mom'], 2);
    const before = s.clockLeft;
    s = tap(s);
    expect(s.clockLeft).toBeCloseTo(before - TB.missCostSec);
    expect(s.misses).toBe(1);
    // Let the clock run out (tapping never, so pairs pass by).
    s = runUntil(s, (s) => s.turns.at === 1, 60);
    expect(s.turns.done.finn).toBe(false);
    // Mom matches every pair in time.
    s = runUntil(s, (s) => s.turns.handoff <= 0);
    for (let k = 0; k < TB.tiers[1].pairs; k++) s = matchOne(s);
    expect(s.over).toBe(true);
    const r = result(s);
    expect(r.safe).toEqual(['mom']);
    expect(r.pays).toEqual({ finn: { energy: Q.failEnergy } });
  });

  it('from Tier III the two trunks get their own speeds each pair; below it they match the tier', () => {
    const low = newTrailBlazes({ tier: 2 }, ['finn'], 9);
    expect(low.vL).toBe(TB.tiers[2].speed);
    expect(low.vR).toBe(TB.tiers[2].speed);
    const speeds = new Set<number>();
    let s = newTrailBlazes({ tier: 3, mode: 'clock' }, ['finn'], 9);
    for (let k = 0; k < 6; k++) {
      speeds.add(s.vL);
      expect(Math.abs(s.vL / TB.tiers[3].speed - 1)).toBeLessThanOrEqual(TB.tiers[3].change + 1e-9);
      expect(Math.abs(s.vR / TB.tiers[3].speed - 1)).toBeLessThanOrEqual(TB.tiers[3].change + 1e-9);
      s = tap(s);
    }
    expect(speeds.size).toBeGreaterThan(3);
  });

  it('the same seed and taps give the same game', () => {
    const play = () => {
      let s = newTrailBlazes({ tier: 5 }, ['finn', 'mom'], 42);
      for (let k = 0; k < 600 && !s.over; k++) s = k % 50 === 0 ? tap(s) : tick(s, 1 / 60);
      return s;
    };
    expect(play()).toEqual(play());
  });
});
