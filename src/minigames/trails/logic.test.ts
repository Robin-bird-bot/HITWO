/**
 * Trails (docs/design/19-minigames-signs-trails.md, sections 2 and 7): off
 * the trail is judged by the icon's middle and only drains the bar while
 * off; a fail hands over from that spot, and comebacks use leftover bars in
 * line order; the trail never needs more than [75%] of top speed sideways;
 * the passing-challenge result is right.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { TIERS } from '../types';
import {
  makeCourse,
  maxSlope,
  middleAt,
  STEP,
  TRAIL_TYPES,
  widthFor,
  type TrailType,
} from './course';
import { aim, checkpoints, isOff, newTrails, result, tick, type TrailsState } from './logic';

const T = BALANCE.minigames.trails;
const Q = BALANCE.minigames.quick;
const DT = 1 / 120;
const TYPES = TRAIL_TYPES.map((t) => t.id);

/** A careful hiker: heads for the trail's middle a little ahead. */
const drive = (s: TrailsState) => aim(s, middleAt(s.course, s.d + 6));
/** A careless one: heads for the far edge of the screen. */
const wander = (s: TrailsState) => aim(s, middleAt(s.course, s.d) < 160 ? 300 : 20);

function run(
  s0: TrailsState,
  steerer: (s: TrailsState) => TrailsState,
  until: (s: TrailsState) => boolean,
  sec = 120,
) {
  let s = s0;
  for (let t = 0; t < sec && !s.over && !until(s); t += DT) s = tick(steerer(s), DT);
  return s;
}

describe('Trails: the course', () => {
  it.each(TIERS)(
    'Tier %i: never moves sideways faster than 75% of top speed; stays on screen',
    (tier) => {
      const scroll = T.tiers[tier].scroll;
      for (const type of TYPES) {
        for (let seed = 1; seed <= 8; seed++) {
          const c = makeCourse(seedRng(seed), tier, type, 2000);
          expect(c.width).toBeCloseTo(widthFor(tier, type));
          for (let i = 1; i < c.xs.length; i++) {
            const slope = Math.abs(c.xs[i]! - c.xs[i - 1]!) / STEP;
            expect(slope * scroll).toBeLessThanOrEqual(T.fairShare * T.topSpeed + 1e-6);
            expect(c.xs[i]! - c.width / 2).toBeGreaterThanOrEqual(0);
            expect(c.xs[i]! + c.width / 2).toBeLessThanOrEqual(320);
          }
        }
      }
      expect(maxSlope(scroll) * scroll).toBeCloseTo(T.fairShare * T.topSpeed);
    },
  );

  it('the types look different: switchbacks zigzag, the ridgeline jogs, forest and riverbank wind', () => {
    const swing = (type: TrailType) => {
      const c = makeCourse(seedRng(3), 3, type, 2000);
      return Math.max(...c.xs) - Math.min(...c.xs);
    };
    for (const type of TYPES) expect(swing(type)).toBeGreaterThan(20);
    expect(makeCourse(seedRng(3), 3, 'riverbank', 600).riverSide).not.toBeNull();
    expect(makeCourse(seedRng(3), 3, 'forest', 600).riverSide).toBeNull();
    expect(widthFor(2, 'forest')).toBeGreaterThan(widthFor(2, 'switchbacks'));
    expect(widthFor(2, 'ridgeline')).toBeLessThan(widthFor(2, 'switchbacks'));
  });
});

describe('Trails: play', () => {
  it('off the trail is judged by the icon’s middle, and only drains the bar while off', () => {
    const s = newTrails({ tier: 2, type: 'forest' }, ['finn', 'mom'], 1);
    const mid = middleAt(s.course, s.d);
    const half = s.course.width / 2;
    expect(isOff({ ...s, x: mid + half - 0.5 })).toBe(false);
    expect(isOff({ ...s, x: mid + half + 0.5 })).toBe(true);
    // On the trail: no drain.
    const on = run(s, drive, () => false, 1);
    expect(on.bars.finn).toBe(T.tiers[2].barSec);
    // Off: it drains, about one second a second.
    const off = run(
      { ...s, x: 300 },
      (x) => aim(x, 300),
      () => false,
      1,
    );
    expect(off.bars.finn).toBeLessThan(T.tiers[2].barSec - 0.8);
    expect(off.bars.mom).toBe(T.tiers[2].barSec);
  });

  it('a careful party passes every checkpoint in line order, and everyone passes', () => {
    for (const type of TYPES) {
      let s = newTrails({ tier: 3, type }, ['finn', 'mom', 'ellie'], 7);
      expect(s.runner).toBe('finn');
      expect(s.goal).toBe(checkpoints(s)[0]);
      s = run(s, drive, (x) => x.over, 200);
      expect(s.over).toBe(true);
      expect(s.order.every((id) => s.status[id] === 'passed')).toBe(true);
      expect(result(s)).toMatchObject({ safe: ['finn', 'mom', 'ellie'], pays: {} });
    }
  });

  it('a fail hands over from that spot; the next checkpoint ahead is theirs; comebacks use leftover bars in line order', () => {
    let s = newTrails({ tier: 1, type: 'switchbacks', section: 400 }, ['finn', 'mom', 'ellie'], 5);
    // Finn wanders off and runs out partway through section 1.
    s = run(s, wander, (x) => x.status.finn === 'failed');
    const spot = s.d;
    expect(spot).toBeLessThan(400);
    expect(s.phase).toBe('handover');
    s = run(s, drive, (x) => x.runner === 'mom' && x.phase === 'run');
    expect(s.d).toBeCloseTo(spot);
    expect(s.goal).toBe(400);
    expect(isOff(s)).toBe(false);
    // Mom and Ellie play carefully (Ellie's goal shifts to 800).
    s = run(s, drive, (x) => x.runner === 'ellie' && x.phase === 'run');
    expect(s.goal).toBe(800);
    const momLeft = s.bars.mom!;
    s = run(s, drive, (x) => x.comeback && x.phase === 'run');
    // The end (1200) wasn't reached: Mom, the first who passed, comes back with her leftover bar.
    expect(s.runner).toBe('mom');
    expect(s.goal).toBe(1200);
    expect(s.bars.mom).toBe(momLeft);
    s = run(s, drive, (x) => x.over, 200);
    expect(s.status).toEqual({ finn: 'failed', mom: 'passed', ellie: 'passed' });
    expect(result(s)).toMatchObject({
      safe: ['mom', 'ellie'],
      pays: { finn: { energy: Q.failEnergy } },
      passing: { stays: false },
    });
  });

  it('running out on a comeback turns a pass into a fail; nobody left ends it, and nobody passing applies the everyone-fails rule', () => {
    let s = newTrails({ tier: 1, type: 'forest', section: 300 }, ['finn', 'mom'], 2);
    s = run(s, drive, (x) => x.runner === 'mom' && x.phase === 'run');
    expect(s.status.finn).toBe('passed');
    // Mom fails at once; Finn comes back and wanders off too.
    s = run(s, wander, (x) => x.over, 200);
    expect(s.status).toEqual({ finn: 'failed', mom: 'failed' });
    const r = result(s);
    expect(r.safe).toEqual([]);
    expect(r.passing?.stays).toBe(true);
  });
});
