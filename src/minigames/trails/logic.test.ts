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
  widthAt,
} from './course';
import {
  aim,
  checkpoints,
  isOff,
  newTrails,
  onScree,
  result,
  steer,
  tick,
  type TrailsState,
} from './logic';

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
            const share = type === 'ridgeline' ? T.ridge.fairShare : T.fairShare;
            expect(slope * scroll).toBeLessThanOrEqual(share * T.topSpeed + 1e-6);
            expect(c.xs[i]! - c.width / 2).toBeGreaterThanOrEqual(0);
            expect(c.xs[i]! + c.width / 2).toBeLessThanOrEqual(320);
          }
        }
      }
      expect(maxSlope(scroll) * scroll).toBeCloseTo(T.fairShare * T.topSpeed);
      expect(maxSlope(scroll, 'ridgeline') * scroll).toBeCloseTo(T.ridge.fairShare * T.topSpeed);
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

describe('Trails: Ridgeline (revised Nov 26)', () => {
  it('narrower, with knife edges that pinch it and scree patches on it', () => {
    const c = makeCourse(seedRng(5), 3, 'ridgeline', 2100, { section: 700 });
    expect(c.width).toBeCloseTo(
      T.tiers[3].width * T.ridge.knifeShare === 0 ? 0 : T.tiers[3].width * T.ridgeNarrow,
    );
    expect(c.knives.length).toBeGreaterThan(0);
    const k = c.knives[0]!;
    expect(widthAt(c, (k.from + k.to) / 2)).toBeCloseTo(c.width * T.ridge.knifeShare);
    expect(widthAt(c, k.from - 20)).toBe(c.width);
    expect(c.scree.length).toBeGreaterThanOrEqual(T.ridge.tiers[3].scree[0] * 3);
    // Switched off, they're gone.
    const plain = makeCourse(seedRng(5), 3, 'ridgeline', 2100, {
      section: 700,
      knives: false,
      scree: false,
    });
    expect(plain.knives).toEqual([]);
    expect(plain.scree).toEqual([]);
    // Other trails have none.
    expect(makeCourse(seedRng(5), 3, 'forest', 2100).knives).toEqual([]);
  });

  it('off the ridge drains the bar twice as fast', () => {
    const drained = (type: TrailType) => {
      let s = newTrails({ tier: 2, type, gusts: false }, ['finn'], 3);
      s = { ...s, x: 300, target: 300 };
      for (let k = 0; k < 60; k++) s = tick(aim(s, 300), 1 / 120);
      return T.tiers[2].barSec - s.bars.finn!;
    };
    expect(drained('ridgeline') / drained('forest')).toBeCloseTo(T.ridge.drain, 1);
  });

  it('gusts warn first, then push the hiker sideways', () => {
    let s = newTrails({ tier: 5, type: 'ridgeline', scree: false, knives: false }, ['finn'], 9);
    for (let k = 0; k < 120 * 10 && !s.gust; k++) s = tick(s, 1 / 120);
    expect(s.gust).not.toBeNull();
    const g = s.gust!;
    expect(g.pushAt - g.warnAt).toBeCloseTo(T.ridge.gustWarnSec);
    // During the warning, nothing pushes: a hiker standing still stays put.
    const still = { ...s, vx: 0, steer: 0 as const, target: null };
    const warned = tick(still, 0.1);
    expect(warned.x).toBeCloseTo(still.x, 5);
    // Then it pushes.
    let pushed: TrailsState = { ...still, time: g.pushAt + 0.01 };
    const x0 = pushed.x;
    pushed = tick(pushed, 0.2);
    expect(Math.sign(pushed.x - x0)).toBe(g.dir);
    // Gusts can be switched off.
    let calm = newTrails({ tier: 5, type: 'ridgeline', gusts: false }, ['finn'], 9);
    for (let k = 0; k < 120 * 10; k++) calm = tick(calm, 1 / 120);
    expect(calm.gust).toBeNull();
  });

  it('on scree, steering is half as strong and the hiker keeps sliding', () => {
    const base = newTrails({ tier: 3, type: 'ridgeline', gusts: false }, ['finn'], 5);
    const patch = base.course.scree[0]!;
    const on: TrailsState = {
      ...base,
      d: (patch.from + patch.to) / 2,
      x: middleAt(base.course, (patch.from + patch.to) / 2),
    };
    const off: TrailsState = { ...on, d: patch.from - 30 };
    expect(onScree(on)).toBe(true);
    expect(onScree(off)).toBe(false);
    const dt = 0.02;
    const speedOn = tick(steer(on, 1), dt).vx;
    const speedOff = tick(steer(off, 1), dt).vx;
    expect(speedOn / speedOff).toBeCloseTo(T.ridge.screeSteer, 2);
    // Letting go: it slows three times slower.
    const slowOn = tick(steer({ ...on, vx: 100 }, 0), dt).vx;
    const slowOff = tick(steer({ ...off, vx: 100 }, 0), dt).vx;
    expect((100 - slowOff) / (100 - slowOn)).toBeCloseTo(T.ridge.screeSlide, 1);
  });
});
