/**
 * Trail Blocks (docs/design/14-minigames-trail-blocks.md, section 6): the
 * energy chunks, the results, each version's zones, River Flood's spots and
 * the ring.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import {
  activeHiker,
  circleRadius,
  judge,
  markerAt,
  newTrailBlocks,
  powerAt,
  press,
  release,
  result,
  stage,
  tick,
  type TrailBlocksState,
  type Version,
} from './logic';

const B = BALANCE.minigames.trailBlocks;
const THREE = ['finn', 'mom', 'ellie'];

/** Puts the Chop or River marker at a spot (on its first pass). */
const at = (s: TrailBlocksState, pos: number): TrailBlocksState => ({
  ...s,
  sweep: pos * (s.version === 'river' ? B.river.passSec[s.tier] : B.chop.passSec[s.tier]),
});
/** Puts the Rockslide's power at a height (rising). */
const powered = (s: TrailBlocksState, v: number): TrailBlocksState => ({
  ...s,
  held: v * B.rockslide.fillSec[s.tier],
});
/** Puts the Animals circle at a radius. */
const radius = (s: TrailBlocksState, r: number): TrailBlocksState => ({
  ...s,
  circle: (1 - r / (B.animals.ring.r * B.animals.startScale)) * B.animals.shrinkSec[s.tier],
});
/** Waits out the swing. */
const settle = (s: TrailBlocksState) => tick(s, B.swingSec + 0.01, false);

const miss = (s: TrailBlocksState) => settle(press(at(s, 0.5)));
const perfectChop = (s: TrailBlocksState) => settle(press(at(s, 0.001)));

describe('energy', () => {
  it('chunks drain in line order; a hiker whose chunk empties is out, and the next takes over with the work kept', () => {
    let s = newTrailBlocks({ version: 'chop', tier: 1 }, THREE, 1);
    expect(s.chunks).toEqual([24, 24, 24]);
    s = settle(press(at(s, 0.08)));
    expect(s.chunks).toEqual([24 - B.swingCost, 24, 24]);
    const workSoFar = s.work;
    expect(workSoFar).toBeGreaterThan(0);
    // Misses until Finn runs out.
    while (activeHiker(s) === 'finn') s = miss(s);
    expect(s.ranOut).toEqual(['finn']);
    expect(s.chunks[0]).toBe(0);
    expect(activeHiker(s)).toBe('mom');
    expect(s.work).toBe(workSoFar);
  });

  it('a swing costs 2, a miss 4, and a perfect swing gives 1 back', () => {
    const s = newTrailBlocks({ version: 'chop', tier: 1 }, ['finn'], 1);
    expect(settle(press(at(s, 0.1))).chunks[0]).toBe(24 - B.swingCost);
    expect(miss(s).chunks[0]).toBe(24 - B.missCost);
    const p = perfectChop(s);
    expect(p.lastSwing?.quality).toBe('perfect');
    expect(p.chunks[0]).toBe(24 - B.swingCost + B.perfectRefund);
    expect(p.work).toBe(B.perfect);
  });

  it('input waits while a swing plays out', () => {
    const s = press(at(newTrailBlocks({ version: 'chop', tier: 1 }, ['finn'], 1), 0.05));
    expect(s.phase).toBe('swing');
    expect(press(s)).toBe(s);
  });
});

describe('results', () => {
  it('clearing the block moves everyone on; only hikers who ran out pay', () => {
    let s = newTrailBlocks({ version: 'chop', tier: 1 }, THREE, 2);
    while (activeHiker(s) === 'finn') s = miss(s);
    while (s.phase !== 'cleared') s = perfectChop(s);
    const r = result(s);
    expect(r.passing).toEqual({ moveOn: THREE, goBack: [], stays: false });
    expect(r.pays).toEqual({ finn: { energy: B.ranOutEnergy } });
  });

  it.each([1, 2, 3] as const)(
    'Tier %i: everyone running out sends them all back, losing the tier’s energy, and the block stays face up',
    (tier) => {
      let s = newTrailBlocks({ version: 'chop', tier }, THREE, 3);
      while (s.phase !== 'out') s = miss(s);
      expect(s.ranOut).toEqual(THREE);
      const r = result(s);
      expect(r.passing).toEqual({ moveOn: [], goBack: THREE, stays: true });
      const e = Math.max(B.ranOutEnergy, BALANCE.minigames.passing.nobodyEnergy[tier]);
      for (const id of THREE) expect(r.pays?.[id]).toEqual({ energy: e });
    },
  );

  it('the work to clear grows with the party, and the obstacle shows it in five stages', () => {
    expect(newTrailBlocks({ version: 'river', tier: 2 }, THREE, 1).total).toBe(
      B.work[2].base + 3 * B.work[2].perHiker,
    );
    const s = newTrailBlocks({ version: 'chop', tier: 1 }, ['finn'], 1);
    expect(stage(s)).toBe(0);
    expect(stage({ ...s, work: s.total * 0.79 })).toBe(3);
    expect(stage({ ...s, work: s.total * 0.81 })).toBe(4);
  });
});

describe('zones', () => {
  it('Chop Tree is strongest at the outer edges, and misses in the middle', () => {
    const s = newTrailBlocks({ version: 'chop', tier: 2 }, ['finn'], 1);
    const z = B.chop.zone[2];
    const edge = judge(at(s, 0.002));
    const inner = judge(at(s, z * 0.9));
    expect(edge.quality).toBe('perfect');
    expect(inner.quality).toBe('good');
    expect(edge.accuracy).toBeGreaterThan(inner.accuracy);
    expect(judge(at(s, 0.998)).quality).toBe('perfect');
    expect(judge(at(s, 0.5)).quality).toBe('miss');
  });

  it('Mine Rockslide is strongest in the middle of its zone, and the zone moves after each swing', () => {
    const s = newTrailBlocks({ version: 'rockslide', tier: 1 }, ['finn'], 4);
    const w = B.rockslide.zone[1];
    expect(judge(powered(s, s.zone)).quality).toBe('perfect');
    const off = judge(powered(s, s.zone + w * 0.4));
    expect(off.quality).toBe('good');
    expect(judge(powered(s, s.zone + w * 0.6)).quality).toBe('miss');
    // Holding fills it, then it drops back while still held.
    let h = s;
    for (let i = 0; i < 30; i++) h = tick(h, B.rockslide.fillSec[1] / 30, true);
    expect(powerAt(h)).toBeCloseTo(1, 1);
    for (let i = 0; i < 15; i++) h = tick(h, B.rockslide.fillSec[1] / 30, true);
    expect(powerAt(h)).toBeCloseTo(0.5, 1);
    const after = release(powered(s, s.zone));
    expect(after.lastSwing?.quality).toBe('perfect');
    expect(after.chunks[0]).toBe(24 - B.swingCost + B.perfectRefund);
    expect(after.zone).not.toBe(s.zone);
    expect(after.held).toBe(0);
  });

  it('River Flood: a spot that’s hit disappears, and a new set comes once they’re all gone', () => {
    let s = newTrailBlocks({ version: 'river', tier: 1 }, THREE, 5);
    expect(s.spots).toHaveLength(B.river.spots[1]);
    const first = s.spots.map((sp) => sp.at);
    const half = B.river.spot[1] / 2;
    expect(judge(at(s, first[0]!)).quality).toBe('perfect');
    expect(judge(at(s, first[0]! + half * 0.6)).quality).toBe('good');
    for (let k = 0; k < first.length - 1; k++) {
      s = settle(press(at(s, first[k]!)));
      expect(s.spots[k]!.hit).toBe(true);
      // That spot is gone: the same place now misses.
      expect(judge(at(s, first[k]!)).quality).toBe('miss');
    }
    s = settle(press(at(s, first.at(-1)!)));
    expect(s.spots.every((sp) => !sp.hit)).toBe(true);
    expect(s.spots.map((sp) => sp.at)).not.toEqual(first);
  });

  it('the ring: full hits inside, weak hits just outside, misses beyond, and a miss when the circle passes it', () => {
    const s = newTrailBlocks({ version: 'animals', tier: 1 }, ['finn'], 6);
    const R = B.animals.ring.r;
    const half = B.animals.thickness[1] / 2;
    expect(judge(radius(s, R)).quality).toBe('perfect');
    expect(judge(radius(s, R + half * 0.7)).quality).toBe('good');
    expect(judge(radius(s, R + half + 3)).quality).toBe('weak');
    expect(judge(radius(s, R - half - 3)).quality).toBe('weak');
    expect(judge(radius(s, R + half + B.animals.weakReach + 2)).quality).toBe('miss');
    const weak = settle(press(radius(s, R + half + 3)));
    expect(weak.work).toBe(B.animals.weakWork);
    // Waiting until it shrinks past the ring: a miss, and a new circle.
    let w = s;
    let guard = 0;
    while (w.swings === 0 && guard++ < 1000) w = tick(w, 1 / 60, false);
    expect(w.lastSwing?.quality).toBe('miss');
    expect(w.chunks[0]).toBe(24 - B.missCost);
    expect(circleRadius(w)).toBeCloseTo(R * B.animals.startScale);
  });

  it.each(['chop', 'rockslide', 'river', 'animals'] as Version[])(
    '%s: a perfect swing gives energy back',
    (version) => {
      let s = newTrailBlocks({ version, tier: 2 }, ['finn'], 7);
      if (version === 'chop') s = press(at(s, 0.001));
      if (version === 'river') s = press(at(s, s.spots[0]!.at));
      if (version === 'rockslide') s = release(powered(s, s.zone));
      if (version === 'animals') s = press(radius(s, B.animals.ring.r));
      expect(s.lastSwing?.quality).toBe('perfect');
      expect(s.chunks[0]).toBe(24 - B.swingCost + B.perfectRefund);
      expect(markerAt(s)).toBeGreaterThanOrEqual(0);
    },
  );
});
