/**
 * Sketchy Bridge (docs/design/23-minigames-final.md, sections 1 and 13):
 * integrity only drops while the icon is outside the zone, and never
 * resets between hikers; a break fails the hiker on it and everyone behind.
 * And the zone's physics, crossing, Prepare, and the bot.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { TIERS } from '../types';
import { sketchyBridgeBot } from './bot';
import {
  fallenPlanks,
  inZone,
  newSketchyBridge,
  nextTarget,
  onBridge,
  result,
  setHolding,
  tick,
  type SketchyBridgeState,
} from './logic';

const B = BALANCE.minigames.sketchyBridge;
const DT = 1 / 120;
const THREE = ['finn', 'mom', 'ellie'];

/** Past the first hand-off. */
const ready = (s: SketchyBridgeState) => tick(s, BALANCE.minigames.quick.handoffSec + DT);

/** Keeps the zone right on the icon (a perfect player), for `sec`. */
function follow(s0: SketchyBridgeState, sec: number): SketchyBridgeState {
  let s = s0;
  for (let t = 0; t < sec && !s.over; t += DT) {
    s = tick({ ...s, zoneY: s.iconY - s.zoneH / 2, zoneV: 0 }, DT);
  }
  return s;
}

describe('the zone', () => {
  it('rises while held, falls when let go, and bounces softly off the bottom', () => {
    let s = ready(newSketchyBridge({ tier: 1 }, ['finn'], 1));
    const y0 = s.zoneY;
    s = setHolding(s, true);
    for (let k = 0; k < 20; k++) s = tick(s, DT);
    expect(s.zoneY).toBeGreaterThan(y0);
    s = setHolding(s, false);
    for (let k = 0; k < 240 && s.zoneV <= 0; k++) s = tick(s, DT);
    expect(s.zoneY).toBeGreaterThanOrEqual(0);
    expect(s.zoneV).toBeGreaterThanOrEqual(0);
  });
});

describe('integrity', () => {
  it.each(TIERS)('Tier %i: it only drops while the icon is outside the zone', (tier) => {
    let s = ready(newSketchyBridge({ tier }, THREE, tier));
    for (let k = 0; k < 2000 && !s.over; k++) {
      const before = s.integrity;
      const next = tick(s, DT);
      if (next.integrity < before) expect(inZone(next)).toBe(false);
      if (inZone(next) && next.turns === s.turns) expect(next.integrity).toBe(before);
      s = next;
    }
  });

  it('never resets between hikers: the next hiker starts with what’s left', () => {
    let s = ready(newSketchyBridge({ tier: 2 }, THREE, 3));
    // Lose some, then cross.
    s = { ...s, zoneY: 0, iconY: B.barH, target: B.barH, retargetAt: 99 };
    for (let k = 0; k < 120; k++) s = tick({ ...s, zoneY: 0, iconY: B.barH }, DT);
    const lost = s.integrity;
    expect(lost).toBeLessThan(s.full);
    s = follow(s, B.tiers[2].crossSec + 0.1);
    expect(s.turns.done.finn).toBe(true);
    expect(onBridge(s)).toBe('mom');
    expect(s.integrity).toBeCloseTo(lost, 5);
    expect(fallenPlanks(s)).toBe(Math.floor((s.full - s.integrity) / B.plankEvery));
  });

  it('a break fails the hiker on it (hurt) and everyone behind (the cost of trying)', () => {
    let s = ready(newSketchyBridge({ tier: 1 }, THREE, 5));
    s = follow(s, B.tiers[1].crossSec + 0.1);
    expect(s.turns.done.finn).toBe(true);
    s = ready(s);
    s = { ...s, integrity: 1 };
    for (let k = 0; k < 400 && !s.over; k++) s = tick({ ...s, zoneY: 0, iconY: B.barH }, DT);
    expect(s.over).toBe(true);
    expect(s.brokeOn).toBe('mom');
    const r = result(s);
    expect(r.passing?.moveOn).toEqual(['finn']);
    expect(r.passing?.goBack).toEqual(['mom', 'ellie']);
    expect(r.pays?.mom).toEqual({ conditions: [B.fallCondition] });
    expect(r.pays?.ellie).toEqual({ energy: BALANCE.minigames.quick.failEnergy });
    // The Harness: the one on it isn't hurt.
    const held = result({ ...s, harness: true });
    expect(held.pays?.mom).toEqual({ energy: BALANCE.minigames.quick.failEnergy });
  });

  it('everyone across: everyone passes', () => {
    let s = ready(newSketchyBridge({ tier: 1 }, THREE, 2));
    for (const id of THREE) {
      s = follow(ready(s), B.tiers[1].crossSec + 0.1);
      expect(s.turns.done[id]).toBe(true);
    }
    expect(s.over).toBe(true);
    expect(result(s).passing?.moveOn).toEqual(THREE);
  });
});

describe('Prepare and the settings', () => {
  it('PATCH THE PLANKS adds integrity; FOOD makes the zone bigger; the Hiking Stick cuts the sway', () => {
    const s = newSketchyBridge({ tier: 3, patch: 40, extraZone: 4, lessSway: 0.25 }, THREE, 1);
    expect(s.full).toBe(B.integrity + 40);
    expect(s.zoneH).toBe(B.tiers[3].zone + 4);
    expect(s.sway).toBeCloseTo(B.tiers[3].sway * 0.75);
    expect(newSketchyBridge({ tier: 1, integrity: 60 }, THREE, 1).full).toBe(60);
  });
});

describe('calmer (Nov 26 evening)', () => {
  it('the zone is bigger on lower tiers: [52, 46, 36, 28, 24]', () => {
    expect(TIERS.map((t) => newSketchyBridge({ tier: t }, THREE, 1).zoneH)).toEqual([
      52, 46, 36, 28, 24,
    ]);
  });

  it('the zone rises at [360] and falls at [260], and never moves faster than [140]', () => {
    let s = ready(newSketchyBridge({ tier: 3 }, THREE, 2));
    s = { ...s, zoneY: 0, zoneV: 0 };
    let fastest = 0;
    for (let k = 0; k < 240; k++) {
      s = tick(setHolding(s, k < 120), DT);
      fastest = Math.max(fastest, Math.abs(s.zoneV));
    }
    expect(fastest).toBeLessThanOrEqual(B.maxSpeed + 1e-9);
    expect(fastest).toBeGreaterThan(B.maxSpeed * 0.9);
    // One step held from rest gains [360] × dt.
    const one = tick(setHolding({ ...s, zoneY: 40, zoneV: 0 }, true), DT);
    expect(one.zoneV).toBeCloseTo(B.rise * DT, 6);
    const drop = tick(setHolding({ ...s, zoneY: 40, zoneV: 0 }, false), DT);
    expect(drop.zoneV).toBeCloseTo(-B.fall * DT, 6);
  });

  it('a new target is [24–40] from the icon, inside the bar', () => {
    const rng = seedRng(9);
    for (let k = 0; k < 500; k++) {
      const icon = B.iconMargin + ((k * 7.3) % (B.barH - 2 * B.iconMargin));
      const t = nextTarget(icon, rng);
      expect(t).toBeGreaterThanOrEqual(B.iconMargin);
      expect(t).toBeLessThanOrEqual(B.barH - B.iconMargin);
      // Near an end it may be clamped, but never more than [40] away.
      expect(Math.abs(t - icon)).toBeLessThanOrEqual(B.targetStep[1] + 1e-9);
      if (icon > 50 && icon < B.barH - 50) {
        expect(Math.abs(t - icon)).toBeGreaterThanOrEqual(B.targetStep[0] - 1e-9);
      }
    }
  });

  it('darts are [16–28] and gusts push at [50]', () => {
    expect(B.dart).toEqual([16, 28]);
    expect(B.gust.speed).toBe(50);
  });
});

describe('the demo bot', () => {
  it('gets someone across at Tier I most of the time', () => {
    let crossed = 0;
    for (let seed = 1; seed <= 10; seed++) {
      let s = ready(newSketchyBridge({ tier: 1 }, ['finn'], seed));
      const mem: Record<string, unknown> = {};
      const rng = seedRng(seed);
      for (let k = 0; k < 6000 && !s.over; k++) {
        const hold = sketchyBridgeBot(s, mem, rng, s.time);
        if (hold !== null) s = setHolding(s, hold);
        s = tick(s, DT);
      }
      if (s.turns.done.finn) crossed++;
    }
    expect(crossed).toBeGreaterThanOrEqual(6);
  });
});
