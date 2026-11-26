/**
 * Fly Swatter (docs/design/18-minigames-quick.md, sections 5 and 9): each
 * fly arrives just as its circle disappears; a tap inside a circle swats it,
 * and overlapping circles swat the one closest to disappearing; landed
 * flies, stray taps (from Tier III) and bee taps are strikes, and letting a
 * bee circle go is not; the round stops at the strike limit.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { TIERS } from '../types';
import {
  endsAt,
  flyAt,
  newFlySwatter,
  radiusAt,
  result,
  tapAt,
  tick,
  type Circle,
  type FlySwatterState,
} from './logic';

const FS = BALANCE.minigames.flySwatter;
const Q = BALANCE.minigames.quick;
const DT = 1 / 120;

const run = (s0: FlySwatterState, sec: number) => {
  let s = s0;
  for (let t = 0; t < sec - 1e-9 && !s.over; t += DT) s = tick(s, DT);
  return s;
};

/** Ticks until a circle is up; returns the state. */
const untilCircle = (s0: FlySwatterState) => {
  let s = s0;
  for (let k = 0; k < 2000 && !s.circles.length && !s.over; k++) s = tick(s, DT);
  return s;
};

/** Swats every fly as soon as its circle appears (never taps a bee). */
function playWell(s0: FlySwatterState): FlySwatterState {
  let s = s0;
  const id = s.turns.order[s.turns.at];
  for (let k = 0; k < 120 * 60 && !s.over && s.turns.order[s.turns.at] === id; k++) {
    const fly = s.circles.find((c) => !c.bee);
    s = fly ? tapAt(s, fly.x, fly.y) : tick(s, DT);
  }
  return s;
}

describe('Fly Swatter', () => {
  it.each(TIERS)('Tier %i: each fly arrives just as its circle disappears', (tier) => {
    const s = untilCircle(newFlySwatter({ tier }, ['finn'], tier));
    const c = s.circles[0]!;
    const end = endsAt(s, c);
    expect(end - c.bornAt).toBeCloseTo(FS.tiers[tier].shrinkSec);
    expect(flyAt(s, c, end)).toEqual({ x: c.x, y: c.y });
    expect(radiusAt(s, c, end)).toBe(0);
    expect(radiusAt(s, c, c.bornAt)).toBeCloseTo(FS.tiers[tier].circle / 2);
    // It starts off screen.
    const from = flyAt(s, c, c.bornAt);
    expect(from.x < 0 || from.x > 320 || from.y < 0 || from.y > 240).toBe(true);
  });

  it('a tap inside a circle swats it; outside it, nothing happens below Tier III', () => {
    const s = untilCircle(newFlySwatter({ tier: 1 }, ['finn'], 2));
    const c = s.circles[0]!;
    const r = radiusAt(s, c);
    const swat = tapAt(s, c.x + r - 0.5, c.y);
    expect(swat.swats).toBe(1);
    expect(swat.circles).toHaveLength(0);
    expect(tapAt(s, c.x + r + 1, c.y)).toBe(s);
  });

  it('where circles overlap, the tap swats the one closest to disappearing', () => {
    const s0 = untilCircle(newFlySwatter({ tier: 3, bees: 'off' }, ['finn'], 4));
    const old: Circle = { ...s0.circles[0]!, id: 90, x: 150, y: 100, bornAt: s0.turnTime - 0.3 };
    const young: Circle = { ...old, id: 91, x: 156, bornAt: s0.turnTime };
    const s = { ...s0, circles: [young, old] };
    const out = tapAt(s, 153, 100);
    expect(out.circles.map((c) => c.id)).toEqual([91]);
    expect(out.swats).toBe(1);
  });

  it('a landed fly is a strike; from Tier III a stray tap is too', () => {
    let s = untilCircle(newFlySwatter({ tier: 1 }, ['finn'], 6));
    s = run(s, FS.tiers[1].shrinkSec + 0.02);
    expect(s.strikes).toBe(1);
    expect(s.events.some((e) => e.kind === 'land')).toBe(true);
    const low = newFlySwatter({ tier: 2 }, ['finn'], 6);
    expect(tapAt(low, 5, 5).strikes).toBe(0);
    const high = newFlySwatter({ tier: 3 }, ['finn'], 6);
    expect(tapAt(high, 5, 5).strikes).toBe(1);
  });

  it('bee circles: a tap is a sting (a strike); letting one go is fine; only from Tier III', () => {
    const lowBees = Array.from({ length: 5 }, (_, k) =>
      run(newFlySwatter({ tier: 2 }, ['finn'], k + 1), 6),
    );
    expect(lowBees.every((s) => s.events.every((e) => e.kind !== 'gone'))).toBe(true);
    let s = newFlySwatter({ tier: 5, bees: 'on' }, ['finn'], 3);
    let bee: Circle | undefined;
    for (let k = 0; k < 120 * 30 && !bee; k++) {
      s = tick(s, DT);
      bee = s.circles.find((c) => c.bee);
      // Keep the flies swatted so the round goes on.
      const fly = s.circles.find((c) => !c.bee && radiusAt(s, c) < 3);
      if (fly) s = tapAt(s, fly.x, fly.y);
    }
    expect(bee).toBeDefined();
    const stung = tapAt(s, bee!.x, bee!.y);
    expect(stung.strikes).toBe(s.strikes + 1);
    expect(stung.events.at(-1)?.kind).toBe('sting');
    // Left alone, it just goes: no strike.
    const before = s.strikes;
    const only = { ...s, circles: [bee!] };
    const after = run(only, FS.tiers[5].shrinkSec + 0.05);
    expect(after.strikes).toBe(before);
    expect(after.events.some((e) => e.kind === 'gone')).toBe(true);
  });

  it('the round stops at the strike limit, and the hiker fails with 1 energy', () => {
    let s = newFlySwatter({ tier: 3, strikes: 2 }, ['finn', 'mom'], 8);
    s = tapAt(s, 5, 5);
    expect(s.turns.at).toBe(0);
    s = tapAt(s, 5, 5);
    expect(s.turns.done.finn).toBe(false);
    expect(s.record.finn).toEqual({ swats: 0, strikes: 2 });
    expect(s.turns.at).toBe(1);
    // Mom swats every fly.
    s = run(s, Q.handoffSec + 0.01);
    s = playWell(s);
    expect(s.over).toBe(true);
    expect(s.record.mom!.swats).toBe(FS.tiers[3].flies);
    const r = result(s);
    expect(r.safe).toEqual(['mom']);
    expect(r.pays).toEqual({ finn: { energy: Q.failEnergy } });
  });

  it('never more circles up than the tier allows; the round has the tier’s flies', () => {
    for (const tier of TIERS) {
      let s = newFlySwatter({ tier, bees: 'off', strikes: 99 }, ['finn'], 10 + tier);
      for (let k = 0; k < 120 * 40 && !s.over; k++) {
        s = tick(s, DT);
        expect(s.circles.length).toBeLessThanOrEqual(FS.tiers[tier].maxUp);
      }
      expect(s.over).toBe(true);
      expect(s.record.finn!.strikes).toBe(FS.tiers[tier].flies);
    }
  });
});
