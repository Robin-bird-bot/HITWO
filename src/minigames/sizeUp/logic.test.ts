/**
 * Size Up (docs/design/18-minigames-quick.md, sections 3 and 9): the
 * starting size is never within the pass range; the % off matches the
 * formula, and passing matches the tier; holding repeats, and time running
 * out locks the size in.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { TIERS } from '../types';
import {
  FINDS,
  lockIn,
  newSizeUp,
  offPercent,
  passes,
  press,
  release,
  result,
  tick,
  type SizeUpState,
} from './logic';

const SU = BALANCE.minigames.sizeUp;
const Q = BALANCE.minigames.quick;

const run = (s0: SizeUpState, sec: number, dt = 1 / 120) => {
  let s = s0;
  for (let t = 0; t < sec - 1e-9 && !s.over; t += dt) s = tick(s, dt);
  return s;
};

describe('Size Up', () => {
  it.each(TIERS)(
    'Tier %i: the find never starts within the pass range, and starts 20 to 40% off',
    (tier) => {
      for (let seed = 1; seed <= 60; seed++) {
        const s = newSizeUp({ tier }, ['finn'], seed);
        const off = Math.abs(s.ratio - 1);
        expect(off).toBeGreaterThanOrEqual(SU.startOff[0] - 1e-9);
        expect(off).toBeLessThanOrEqual(SU.startOff[1] + 1e-9);
        expect(passes(s.ratio, SU.tiers[tier].pass)).toBe(false);
        expect(s.sketchScale).toBeGreaterThanOrEqual(SU.sketchScale[0]);
        expect(s.sketchScale).toBeLessThanOrEqual(SU.sketchScale[1]);
      }
    },
  );

  it('turned by tier: upright at I, any angle from II, sometimes mirrored from III; finds by tier', () => {
    const at = (tier: 1 | 2 | 3) =>
      Array.from({ length: 60 }, (_, k) => newSizeUp({ tier }, ['finn'], k + 1));
    expect(at(1).every((s) => s.angle === 0 && !s.mirrored)).toBe(true);
    expect(at(2).some((s) => s.angle !== 0)).toBe(true);
    expect(at(2).some((s) => s.mirrored)).toBe(false);
    expect(at(3).some((s) => s.mirrored)).toBe(true);
    const four = FINDS.slice(0, 4).map((f) => f.id as string);
    expect(at(1).every((s) => four.includes(s.find))).toBe(true);
    expect(new Set(at(3).map((s) => s.find)).size).toBe(6);
  });

  it('the % off is |size ÷ sketch − 1| × 100, rounded, and passing follows the tier', () => {
    expect(offPercent(1)).toBe(0);
    expect(offPercent(1.074)).toBe(7);
    expect(offPercent(0.926)).toBe(7);
    expect(offPercent(1.085)).toBe(9);
    for (const tier of TIERS) {
      const pass = SU.tiers[tier].pass;
      expect(passes(1 + pass / 100, pass)).toBe(true);
      expect(passes(1 - (pass + 1) / 100, pass)).toBe(false);
    }
    // Locking in at a size records that size's % and result.
    const s = newSizeUp({ tier: 1 }, ['finn'], 5);
    const near = lockIn({ ...s, ratio: 1.06 });
    expect(near.locked).toMatchObject({ off: 6, passed: true });
    const far = lockIn({ ...s, ratio: 0.9 });
    expect(far.locked).toMatchObject({ off: 10, passed: false });
  });

  it('a press steps once; holding repeats every 0.1 s after 0.35 s; letting go stops it', () => {
    const s0 = { ...newSizeUp({ tier: 1 }, ['finn'], 2), ratio: 0.7 };
    const step = SU.tiers[1].step;
    let s = press(s0, 'grow');
    expect(s.ratio).toBeCloseTo(0.7 + step);
    s = run(s, SU.holdSec - 0.02);
    expect(s.ratio).toBeCloseTo(0.7 + step);
    s = run(s, 0.04);
    expect(s.ratio).toBeCloseTo(0.7 + 2 * step);
    s = run(s, SU.repeatSec * 3);
    expect(s.ratio).toBeCloseTo(0.7 + 5 * step);
    s = release(s);
    s = run(s, 1);
    expect(s.ratio).toBeCloseTo(0.7 + 5 * step);
    s = press(s, 'shrink');
    expect(s.ratio).toBeCloseTo(0.7 + 4 * step);
  });

  it('time running out locks the size in, and the reveal ends the turn; a near size passes', () => {
    let s = newSizeUp({ tier: 2, timeSec: 4 }, ['finn', 'mom'], 9);
    s = run(s, 4.05);
    expect(s.locked).not.toBeNull();
    expect(s.locked!.passed).toBe(false);
    // Nothing changes during the reveal.
    expect(press(s, 'grow')).toBe(s);
    s = run(s, SU.revealSec + 0.05);
    expect(s.turns.done.finn).toBe(false);
    expect(s.turns.at).toBe(1);
    // Mom gets a new find and locks in close.
    s = run(s, Q.handoffSec + 0.05);
    s = lockIn({ ...s, ratio: 1.02 });
    s = run(s, SU.revealSec + 0.05);
    expect(s.over).toBe(true);
    expect(s.record.mom).toMatchObject({ off: 2, passed: true });
    expect(result(s)).toMatchObject({ safe: ['mom'], pays: { finn: { energy: Q.failEnergy } } });
  });

  it('each hiker gets a new find (Random), or the one picked (Find setting)', () => {
    let s = newSizeUp({ tier: 3 }, ['finn', 'mom', 'ellie'], 4);
    const seen: string[] = [];
    for (let k = 0; k < 3; k++) {
      seen.push(s.find);
      s = run(lockIn(s), SU.revealSec + Q.handoffSec + 0.1);
    }
    expect(seen[0]).not.toBe(seen[1]);
    expect(seen[1]).not.toBe(seen[2]);
    const fixed = newSizeUp({ tier: 1, find: 'feather' }, ['finn'], 4);
    expect(fixed.find).toBe('feather');
  });
});
