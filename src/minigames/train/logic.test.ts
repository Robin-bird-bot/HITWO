/**
 * Train! (docs/design/17-minigames-lanes.md, section 5): one track is always
 * clear; every train is warned for the tier's time (fog too); switching and
 * lives work as in Dodge; the result.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { TIERS } from '../types';
import { hop, newTrain, result, stillIn, tick, trainSpan, type TrainState } from './logic';

const T = BALANCE.minigames.train;
const THREE = ['finn', 'mom', 'ellie'];
const DT = 1 / 60;

const run = (s0: TrainState, sec: number, each?: (s: TrainState) => void) => {
  let s = s0;
  for (let t = 0; t < sec - 1e-9 && !s.over; t += DT) {
    s = tick(s, DT);
    each?.(s);
  }
  return s;
};

describe('Train!', () => {
  it.each(TIERS)('Tier %i: one track is always clear, and every train is warned first', (tier) => {
    const t = T.tiers[tier];
    for (const fog of ['auto', 'on'] as const) {
      const s0 = newTrain({ tier, lives: 99, surviveSec: 60, fog }, THREE, tier * 3);
      expect(s0.tracks).toBe(t.tracks);
      const seen = new Map<number, number>();
      run(s0, 60, (s) => {
        for (const tr of s.trains) {
          seen.set(tr.id, tr.enterAt - tr.warnAt);
          if (tier < T.bothSidesFrom) expect(tr.dir).toBe(-1);
        }
        const busy = new Set(
          s.trains
            .filter((tr) => tr.warnAt <= s.time && s.time <= tr.leaveAt)
            .map((tr) => tr.track),
        );
        expect(busy.size).toBeLessThan(s.tracks);
      });
      expect(seen.size).toBeGreaterThan(10);
      for (const warn of seen.values()) expect(warn).toBeCloseTo(t.warnSec);
    }
  });

  it('hops one track at a time, up and down, within the tracks', () => {
    let s = newTrain({ tier: 3 }, THREE, 1);
    const start = s.track;
    s = run(hop(s, -1), T.hopSec + DT);
    expect(s.track).toBe(start - 1);
    let top = s;
    for (let k = 0; k < 10; k++) top = run(hop(top, -1), T.hopSec + DT);
    expect(top.track).toBe(0);
  });

  it('a hit costs the active hiker a life, then a moment of safety; out, the next takes over at once', () => {
    let s = newTrain({ tier: 1, lives: 1, surviveSec: 60 }, THREE, 2);
    const train = {
      id: 99,
      track: s.track,
      dir: -1 as const,
      cars: ['boxcar' as const],
      length: 120,
      speed: 200,
      warnAt: 0,
      enterAt: 0,
      leaveAt: 5,
    };
    s = { ...s, trains: [train], nextTrain: 99 };
    s = run(s, (322 - 165) / 200 + 0.05);
    expect(s.lastHit?.hikerId).toBe('finn');
    expect(s.lives.finn).toBe(0);
    expect(s.active).toBe('mom');
    expect(s.safeFor).toBeGreaterThan(0);
  });

  it('switches the active hiker every few seconds, as in Dodge', () => {
    const s = run(newTrain({ tier: 1, lives: 99, surviveSec: 60 }, THREE, 4), T.switchSec + 0.1);
    expect(s.active).toBe('mom');
    expect(trainSpan({ ...s.trains[0]!, enterAt: 0 }, -1)).toBeNull();
  });

  it('hikers with lives left when the clock ends move on; hikers out lose energy', () => {
    const s0 = newTrain({ tier: 2, surviveSec: 10 }, THREE, 5);
    const end = run({ ...s0, nextTrain: 99, lives: { finn: 1, mom: 0, ellie: 2 } }, 11);
    expect(end.over).toBe(true);
    expect(stillIn(end)).toEqual(['finn', 'ellie']);
    const r = result(end);
    expect(r.passing).toEqual({ moveOn: ['finn', 'ellie'], goBack: ['mom'], stays: false });
    expect(r.pays).toEqual({ mom: { energy: T.failEnergy } });
  });

  it('fog: on at Tiers IV and V, and the setting can switch it', () => {
    expect(newTrain({ tier: 3 }, THREE, 1).fog).toBe(false);
    expect(newTrain({ tier: 4 }, THREE, 1).fog).toBe(true);
    expect(newTrain({ tier: 5, fog: 'off' }, THREE, 1).fog).toBe(false);
    expect(newTrain({ tier: 1, fog: 'on' }, THREE, 1).fog).toBe(true);
  });
});
