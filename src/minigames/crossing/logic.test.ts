/**
 * Crossing (docs/design/17-minigames-lanes.md, section 5): one hop per
 * press; every kind of hit costs a life and sends the hiker to the start and
 * the back of the line; running out of time costs a life; Mixed has a safe
 * bank; riding carries the hiker; diving turtles warn first; the result.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { TIERS } from '../types';
import {
  crossingHiker,
  hop,
  newCrossing,
  result,
  tick,
  turtleState,
  type CrossingState,
  type Lane,
} from './logic';

const C = BALANCE.minigames.crossing;
const THREE = ['finn', 'mom', 'ellie'];
const DT = 1 / 60;

const run = (s0: CrossingState, sec: number) => {
  let s = s0;
  for (let t = 0; t < sec - 1e-9 && !s.over; t += DT) s = tick(s, DT);
  return s;
};
/** One hop, played out. */
const hopped = (s: CrossingState, dir: Parameters<typeof hop>[1]) =>
  run(hop(s, dir), C.hopSec + DT);
/** A board with one lane replaced. */
const withLane = (s: CrossingState, k: number, lane: Lane): CrossingState => ({
  ...s,
  lanes: s.lanes.map((l, i) => (i === k ? lane : l)),
});
const empty = (kind: Lane['kind']): Lane => ({ kind, dir: 1, speed: 0, span: 400, things: [] });

describe('the board', () => {
  it.each(TIERS)('Tier %i: lanes, lives and time from the tier; every lane has room', (tier) => {
    const s = newCrossing({ version: 'road', tier }, THREE, tier);
    const t = C.tiers[tier];
    expect(s.lanes).toHaveLength(t.lanes);
    expect(s.rows).toBe(t.lanes + 2);
    expect(s.lives.finn).toBe(t.lives);
    expect(s.attemptLeft).toBe(t.attemptSec);
    for (const lane of s.lanes) {
      expect(lane.span).toBeGreaterThanOrEqual(320 + 80);
      // A gap at least as wide as a hiker somewhere in every lane.
      const xs = lane.things.map((th) => [th.x, th.x + th.w] as const).sort((a, b) => a[0] - b[0]);
      const gaps = xs.slice(1).map((b, i) => b[0] - xs[i]![1]);
      expect(Math.max(...gaps, lane.span - (xs.at(-1)![1] - xs[0]![0]))).toBeGreaterThan(16);
    }
    // Directions alternate.
    for (let k = 1; k < s.lanes.length; k++) expect(s.lanes[k]!.dir).toBe(-s.lanes[k - 1]!.dir);
  });

  it('Mixed (Tier III and up): road at the bottom, a safe bank, river at the top; below Tier III it plays Road', () => {
    const s = newCrossing({ version: 'mixed', tier: 3 }, THREE, 1);
    expect(s.lanes.map((l) => l.kind)).toEqual([
      'road',
      'road',
      'road',
      'bank',
      'river',
      'river',
      'river',
    ]);
    expect(newCrossing({ version: 'mixed', tier: 2 }, THREE, 1).version).toBe('road');
    // The bank is safe: standing on it for a while costs nothing.
    let b = { ...s, row: 4, x: 160 };
    b = run(b, 2);
    expect(b.lives.finn).toBe(s.lives.finn);
    expect(crossingHiker(b)).toBe('finn');
  });

  it('Critter Crossing: slower, bigger gaps and one more life', () => {
    const road = newCrossing({ version: 'road', tier: 2 }, THREE, 3);
    const critter = newCrossing({ version: 'critter', tier: 2 }, THREE, 3);
    expect(critter.lives.finn).toBe(road.lives.finn! + C.critter.extraLives);
    const [lo, hi] = C.tiers[2].speed;
    for (const lane of critter.lanes) {
      expect(lane.speed).toBeGreaterThanOrEqual(lo * C.critter.speed - 1e-9);
      expect(lane.speed).toBeLessThanOrEqual(hi * C.critter.speed + 1e-9);
    }
  });
});

describe('moving', () => {
  it('one hop per press: a tile at a time, and nothing more while it’s on its way', () => {
    let s = withLane(newCrossing({ version: 'road', tier: 1 }, THREE, 4), 0, empty('road'));
    s = hop(s, 'up');
    expect(hop(s, 'up')).toBe(s);
    s = run(s, C.hopSec + DT);
    expect(s.row).toBe(1);
    s = hopped(s, 'left');
    expect(s.x).toBe(160 - C.row);
    expect(s.row).toBe(1);
  });

  it('reaching the goal is across, and the next hiker steps up', () => {
    let s = newCrossing({ version: 'road', tier: 1 }, THREE, 5);
    s = { ...s, lanes: s.lanes.map((l) => ({ ...l, things: [] })) };
    for (let k = 0; k < s.rows - 1; k++) s = hopped(s, 'up');
    expect(s.status.finn).toBe('across');
    expect(crossingHiker(s)).toBe('mom');
    expect(s.row).toBe(0);
  });
});

describe('hits', () => {
  const lane1 = (s: CrossingState, lane: Lane) => withLane(s, 0, lane);

  it('a vehicle costs a life, back to the start and the back of the line', () => {
    let s = newCrossing({ version: 'road', tier: 1 }, THREE, 6);
    s = lane1(s, { ...empty('road'), things: [{ kind: 'car', x: 150, w: 30 }] });
    s = hopped(s, 'up');
    expect(s.lives.finn).toBe(C.tiers[1].lives - 1);
    expect(s.lastHit).toMatchObject({ id: 'finn', why: 'hit' });
    expect(s.line).toEqual(['mom', 'ellie', 'finn']);
    expect(crossingHiker(s)).toBe('mom');
    expect(s.row).toBe(0);
  });

  it('the water costs a life; a log carries the hiker; riding off the edge costs a life', () => {
    const base = newCrossing({ version: 'river', tier: 1 }, THREE, 7);
    const wet = hopped(lane1(base, empty('river')), 'up');
    expect(wet.lastHit).toMatchObject({ id: 'finn', why: 'water' });
    const log: Lane = {
      kind: 'river',
      dir: 1,
      speed: 30,
      span: 400,
      things: [{ kind: 'log', x: 130, w: 64, pieces: 4 }],
    };
    let ride = hopped(lane1(base, log), 'up');
    expect(ride.lastHit).toBeUndefined();
    const x0 = ride.x;
    ride = run(ride, 0.5);
    expect(ride.x).toBeCloseTo(x0 + 15, 0);
    // Carried to the edge: a life.
    const nearEdge: Lane = { ...log, things: [{ kind: 'log', x: 280, w: 64, pieces: 4 }] };
    const edge = run({ ...lane1(base, nearEdge), row: 1, x: 300 }, 1);
    expect(edge.lastHit).toMatchObject({ id: 'finn', why: 'edge' });
  });

  it('diving turtles warn first (half) before they go under, and under is the water', () => {
    const t = { kind: 'turtles' as const, x: 130, w: 48, pieces: 3, dive: 0 };
    expect(turtleState(t, 0.1)).toBe('up');
    expect(turtleState(t, C.dive.upSec + 0.1)).toBe('half');
    expect(turtleState(t, C.dive.upSec + C.dive.halfSec + 0.1)).toBe('under');
    expect(turtleState({ ...t, dive: undefined }, 99)).toBe('up');
    const base = newCrossing({ version: 'river', tier: 2 }, THREE, 8);
    let s = hopped(
      withLane(base, 0, { kind: 'river', dir: 1, speed: 0, span: 400, things: [t] }),
      'up',
    );
    expect(s.lastHit).toBeUndefined();
    s = run(s, C.dive.upSec + C.dive.halfSec);
    expect(s.lastHit).toMatchObject({ id: 'finn', why: 'water' });
    // Some turtle groups dive on Tier II.
    const divers = base.lanes.flatMap((l) => l.things).filter((th) => th.dive !== undefined);
    expect(divers.length).toBeLessThanOrEqual(C.tiers[2].divers);
  });

  it('running out of time costs a life', () => {
    const s = run(newCrossing({ version: 'road', tier: 1, attemptSec: 1 }, THREE, 9), 1.1);
    expect(s.lastHit).toMatchObject({ id: 'finn', why: 'time' });
    expect(s.lives.finn).toBe(C.tiers[1].lives - 1);
  });
});

describe('the result', () => {
  it('ends when everyone is across or out; across move on, out stay back and lose energy', () => {
    let s = newCrossing({ version: 'road', tier: 3, attemptSec: 0.5 }, ['finn', 'mom'], 10);
    s = run(s, 10);
    expect(s.over).toBe(true);
    expect(s.status).toEqual({ finn: 'out', mom: 'out' });
    const r = result(s);
    expect(r.passing).toMatchObject({ moveOn: [], stays: true });
    expect(r.pays?.finn?.energy).toBeGreaterThanOrEqual(C.failEnergy);
    const across: CrossingState = { ...s, status: { finn: 'across', mom: 'out' } };
    expect(result(across).passing).toEqual({ moveOn: ['finn'], goBack: ['mom'], stays: false });
    expect(result(across).pays).toEqual({ mom: { energy: C.failEnergy } });
  });
});
