/**
 * Spooky Ghost! (docs/design/24-challenges-reset.md, section 6).
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { TIERS } from '../types';
import { spookyGhostBot } from './bot';
import {
  ghostOpacity,
  lit,
  moveLight,
  nearGhost,
  newSpookyGhost,
  result,
  tap,
  tick,
  type SpookyGhostState,
} from './logic';

const G = BALANCE.minigames.spookyGhost;
const Q = BALANCE.minigames.quick;
const THREE = ['finn', 'mom', 'ellie'];
const DT = 1 / 60;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** No ghosts at all, for the finds. */
const quiet = (seed = 1, more = {}) => newSpookyGhost({ tier: 1, ghosts: 0, ...more }, THREE, seed);

/** Finds a hiker's mitten: the light goes to it and taps. */
function find(s: SpookyGhostState, owner: string): SpookyGhostState {
  const m = s.mittens.find((x) => x.owner === owner)!;
  return tap(moveLight(s, m), m);
}

describe('Spooky Ghost!', () => {
  it('each hiker has one mitten at a time, at least [80] from the light; finds by tier [3, 4, 4, 5, 5]', () => {
    for (const tier of TIERS) {
      const s = newSpookyGhost({ tier }, THREE, tier);
      expect(s.need).toBe(G.tiers[tier].finds);
      expect(s.mittens.map((m) => m.owner).sort()).toEqual([...THREE].sort());
      for (const m of s.mittens) expect(dist(m, s.light)).toBeGreaterThanOrEqual(G.newAway);
      expect(s.ghosts).toHaveLength(G.tiers[tier].ghosts);
    }
  });

  it('a mitten is found only when it’s lit and tapped; a new one lands at least [80] from the light', () => {
    let s = quiet();
    const m = s.mittens.find((x) => x.owner === 'mom')!;
    // Tapping where it is, with the light elsewhere first: the tap brings the light.
    s = tap(s, { x: m.x + G.tapReach + 4, y: m.y });
    expect(s.found.mom).toBe(0);
    s = find(s, 'mom');
    expect(s.found.mom).toBe(1);
    const next = s.mittens.find((x) => x.owner === 'mom')!;
    expect(next).not.toBe(m);
    expect(dist(next, s.light)).toBeGreaterThanOrEqual(G.newAway);
    // No decoys: a tap on nothing does nothing.
    const before = s;
    s = tap(s, { x: 20, y: 40 });
    expect(s.found).toEqual(before.found);
  });

  it('everyone with all their finds first: everyone passes, before sanity runs out', () => {
    let s = quiet();
    for (let k = 0; k < s.need; k++) for (const id of THREE) s = find(s, id);
    expect(s.over).toBe(true);
    expect(s.sanity).toBeGreaterThan(0);
    expect(result(s)).toMatchObject({ safe: THREE });
  });

  it('when sanity runs out, hikers short of their finds fail (like the snake game)', () => {
    let s = quiet();
    for (let k = 0; k < s.need; k++) s = find(s, 'finn');
    s = find(s, 'mom');
    for (let k = 0; k < 10000 && !s.over; k++) s = tick(s, 0.05);
    expect(s.over).toBe(true);
    expect(s.sanity).toBe(0);
    expect(s.time).toBeCloseTo(G.tiers[1].sanitySec, 0);
    expect(result(s)).toMatchObject({
      safe: ['finn'],
      pays: { mom: { energy: Q.failEnergy }, ellie: { energy: Q.failEnergy } },
    });
  });

  it('near a ghost (within [20] of the light) sanity drains [4×] as fast', () => {
    let s = newSpookyGhost({ tier: 1, ghosts: 1 }, THREE, 4);
    const g = s.ghosts[0]!;
    // Bring the ghost fully in, and put the light on it.
    s = { ...s, time: g.bornAt + G.fadeSec + 0.1, ghosts: [{ ...g, leaveAt: 999, goneAt: 1000 }] };
    s = moveLight(s, { x: g.x + 5, y: g.y });
    expect(nearGhost(s)).toBe(true);
    const near = tick(s, 1);
    expect(s.sanity - near.sanity).toBeCloseTo(G.ghostDrain, 6);
    const far = tick(moveLight(s, { x: g.x + 120, y: g.y }), 1);
    expect(s.sanity - far.sanity).toBeCloseTo(1, 6);
    expect(far.draining).toBe(false);
    expect(near.draining).toBe(true);
  });

  it('ghosts fade in over [0.8 s], stay [3–6 s], fade out, and come back elsewhere: never near the pointer or a mitten', () => {
    let s = newSpookyGhost({ tier: 2 }, THREE, 9);
    const seen = new Set<number>();
    for (let k = 0; k < 60 * 30; k++) {
      s = tick(moveLight(s, { x: 160 + Math.sin(k / 40) * 120, y: 110 }), DT);
      for (const g of s.ghosts) {
        const stay = g.leaveAt - g.bornAt - G.fadeSec;
        expect(stay).toBeGreaterThanOrEqual(G.staySec[0] - 1e-9);
        expect(stay).toBeLessThanOrEqual(G.staySec[1] + 1e-9);
        expect(g.goneAt - g.leaveAt).toBeCloseTo(G.fadeSec, 9);
        if (!seen.has(g.id) && g.bornAt > 0) {
          seen.add(g.id);
          // Where it came back: away from the light and every mitten.
          expect(dist(g, s.light)).toBeGreaterThanOrEqual(G.clearOfLight - 1e-6);
          for (const m of s.mittens)
            expect(dist(g, m)).toBeGreaterThanOrEqual(G.clearOfMitten - 1e-6);
        }
      }
    }
    expect(seen.size).toBeGreaterThan(5);
    const g = s.ghosts[0]!;
    expect(ghostOpacity(g, g.bornAt + G.fadeSec / 2)).toBeCloseTo(0.5, 6);
    expect(ghostOpacity(g, g.goneAt)).toBe(0);
  });

  it('ghosts drift from Tier III; from Tier IV some drift toward the light', () => {
    expect(newSpookyGhost({ tier: 2 }, THREE, 1).ghosts.every((g) => !g.vx && !g.vy)).toBe(true);
    const three = newSpookyGhost({ tier: 3 }, THREE, 1);
    expect(three.ghosts.some((g) => Math.hypot(g.vx, g.vy) > 0)).toBe(true);
    expect(three.ghosts.every((g) => !g.chaser)).toBe(true);
    const four = newSpookyGhost({ tier: 5 }, THREE, 3);
    expect(four.ghosts.some((g) => g.chaser)).toBe(true);
    const chaser = four.ghosts.find((g) => g.chaser)!;
    const after = tick(four, 0.5).ghosts.find((g) => g.id === chaser.id)!;
    expect(dist(after, four.light)).toBeLessThan(dist(chaser, four.light));
  });

  it('a ghost the light finds says BOO, once', () => {
    let s = newSpookyGhost({ tier: 1, ghosts: 1 }, THREE, 4);
    const g = s.ghosts[0]!;
    s = { ...s, time: g.bornAt + G.fadeSec, ghosts: [{ ...g, leaveAt: 999, goneAt: 1000 }] };
    s = tick(moveLight(s, g), DT);
    const boo = s.ghosts[0]!.booAt;
    expect(boo).not.toBeNull();
    s = tick(s, DT);
    expect(s.ghosts[0]!.booAt).toBe(boo);
  });

  it('Prepare: FOOD drains [15%] slower, LANTERN makes the light [+6] bigger, LUCKY CHARM halves the ghosts’ drain', () => {
    const plain = quiet();
    const food = quiet(1, { slower: G.foodSlower });
    expect(plain.sanity - tick(plain, 1).sanity).toBeCloseTo(1, 6);
    expect(food.sanity - tick(food, 1).sanity).toBeCloseTo(1 - G.foodSlower, 6);
    expect(quiet(1, { biggerLight: G.lanternBigger }).lightR).toBe(
      G.tiers[1].light + G.lanternBigger,
    );
    expect(quiet(1, { calmGhosts: true }).ghostDrain).toBe(G.ghostDrain * G.charmDrain);
    const lamp = quiet(1, { biggerLight: 6 });
    expect(lit(lamp, { x: lamp.light.x + G.tiers[1].light + 3, y: lamp.light.y })).toBe(true);
  });

  it('the demo bot finds mittens', () => {
    let s = newSpookyGhost({ tier: 1 }, THREE, 2);
    const mem: Record<string, unknown> = {};
    const rng = seedRng(5);
    for (let k = 0; k < 60 * 40 && !s.over; k++) {
      const a = spookyGhostBot(s, mem, rng, s.time);
      if (a?.kind === 'move') s = moveLight(s, a.to);
      if (a?.kind === 'tap') s = tap(s, a.at);
      s = tick(s, DT);
    }
    const total = THREE.reduce((n, id) => n + (s.found[id] ?? 0), 0);
    expect(total).toBeGreaterThanOrEqual(5);
  });
});
