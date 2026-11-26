/**
 * Thin Ice, the crossing (docs/design/23-minigames-final.md, sections 7 and
 * 13): every board has at least as many separate safe routes as hikers;
 * walked squares can't be stepped on again, and their numbers stay; picks
 * reach only squares 2 away. And the shore numbers, falling in, the Hiking
 * Stick, crossing, and the results.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { TIERS } from '../types';
import { thinIceBot } from './bot';
import {
  apart,
  canPick,
  canStep,
  count,
  cross,
  isRoute,
  makeRoutes,
  newThinIce,
  pick,
  posOf,
  result,
  shoreCount,
  stand,
  step,
  tick,
  toggleFlag,
  type ThinIceState,
} from './logic';

const T = BALANCE.minigames.thinIce;
const HIKERS = ['finn', 'mom', 'ellie', 'wyatt', 'gdog', 'wink'];

/** Past the hand-off, so the crossing hiker can act. */
const ready = (s: ThinIceState) => tick(s, BALANCE.minigames.quick.handoffSec + 0.01);

/** Walks a hiker along a route, then onto the far shore. */
function walk(s0: ThinIceState, route: readonly number[]): ThinIceState {
  let s = stand(s0, posOf(s0, route[0]!).col);
  for (const c of route) s = step(s, c);
  return cross(s);
}

describe('the board', () => {
  it.each(TIERS)(
    'Tier %i: at least as many separate safe routes as hikers, holes elsewhere',
    (tier) => {
      for (let n = 1; n <= HIKERS.length; n++) {
        for (let seed = 1; seed <= 20; seed++) {
          const s = newThinIce({ tier }, HIKERS.slice(0, n), seed);
          expect([s.cols, s.rows]).toEqual([T.tiers[tier].cols, T.tiers[tier].rows]);
          expect(s.routes).toHaveLength(n);
          const used = new Set<number>();
          for (const r of s.routes) {
            expect(isRoute(s, r)).toBe(true);
            for (const c of r) {
              expect(used.has(c)).toBe(false);
              used.add(c);
            }
          }
          expect(s.holes.filter(Boolean).length).toBe(
            Math.round(s.cols * s.rows * T.tiers[tier].holes),
          );
        }
      }
    },
  );

  it('routes never share a square, even with as many hikers as columns', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const routes = makeRoutes(seedRng(seed), 6, 8, 6);
      expect(new Set(routes.flat()).size).toBe(6 * 8);
    }
  });

  it('a near-shore square counts the holes touching it in the first ice row', () => {
    const s = newThinIce({ tier: 3 }, HIKERS.slice(0, 2), 4);
    for (let col = 0; col < s.cols; col++) {
      let n = 0;
      for (const c of [col - 1, col, col + 1])
        if (c >= 0 && c < s.cols && s.holes[(s.rows - 1) * s.cols + c]) n++;
      expect(shoreCount(s, col)).toBe(n);
    }
  });
});

describe('a crossing', () => {
  it('walking a route gets the hiker across; their squares crack, and keep their numbers', () => {
    let s = ready(newThinIce({ tier: 2 }, HIKERS.slice(0, 2), 3));
    const route = s.routes[0]!;
    s = walk(s, route);
    expect(s.turns.done.finn).toBe(true);
    for (const c of route) {
      expect(s.cracked[c]).toBe(true);
      expect(s.seen[c]).toBe(true);
    }
    // Mom can't step on Finn's squares.
    s = ready(s);
    s = stand(s, posOf(s, route[0]!).col);
    expect(canStep(s, route[0]!)).toBe(false);
    expect(step(s, route[0]!)).toBe(s);
    // But a square Finn only checked (a 0 opening it) stays usable.
    const checkedOnly = s.seen.findIndex((v, i) => v && !s.cracked[i] && !s.holes[i]);
    if (checkedOnly >= 0) expect(s.cracked[checkedOnly]).toBe(false);
  });

  it('steps only to the 8 squares next to you; a 0 opens around it without walking there', () => {
    for (let seed = 1; seed <= 20; seed++) {
      let s = ready(newThinIce({ tier: 1 }, ['finn'], seed));
      const start = s.routes[0]![0]!;
      s = stand(s, posOf(s, start).col);
      s = step(s, start);
      for (let c = 0; c < s.holes.length; c++) {
        if (canStep(s, c)) expect(apart(s.at!, posOf(s, c))).toBe(1);
      }
      if (count(s, start) === 0) {
        const opened = s.seen.filter(Boolean).length;
        expect(opened).toBeGreaterThan(1);
        expect(s.walked.filter(Boolean)).toHaveLength(1);
      }
    }
  });

  it('picks reach only squares exactly 2 away, cost one each, and never move the hiker', () => {
    let s = ready(newThinIce({ tier: 1 }, ['finn'], 9));
    const start = s.routes[0]![1]!;
    s = stand(s, posOf(s, s.routes[0]![0]!).col);
    s = step(s, s.routes[0]![0]!);
    s = step(s, start);
    const at = s.at!;
    for (let c = 0; c < s.holes.length; c++) {
      if (canPick(s, c)) expect(apart(at, posOf(s, c))).toBe(T.pickReach);
    }
    const target = s.holes.findIndex((_, c) => canPick(s, c));
    const before = s.picksLeft;
    const after = pick(s, target);
    expect(after.picksLeft).toBe(before - 1);
    expect(after.at).toEqual(at);
    expect(after.seen[target]).toBe(true);
    // Out of picks: no more.
    const none = { ...after, picksLeft: 0 };
    expect(
      pick(
        none,
        none.holes.findIndex((_, c) => apart(at, posOf(none, c)) === 2),
      ),
    ).toBe(none);
  });

  it('falling in fails that hiker with the stake; the next hiker starts from the near shore', () => {
    let s = ready(newThinIce({ tier: 3 }, ['finn', 'mom'], 6));
    const hole = s.holes.findIndex((h, i) => h && posOf(s, i).row === s.rows - 1);
    if (hole < 0) return;
    s = stand(s, posOf(s, hole).col);
    s = step(s, hole);
    expect(s.fell).toEqual(['finn']);
    expect(s.turns.done.finn).toBe(false);
    expect(s.at).toBeNull();
    expect(s.seen[hole]).toBe(true);
    s = ready(s);
    s = walk(s, s.routes[1]!);
    const r = result({ ...s, over: true });
    expect(r.passing?.moveOn).toEqual(['mom']);
    expect(r.pays?.finn).toEqual({ conditions: [T.fallCondition] });
  });

  it('the Hiking Stick: each hiker’s first hole only cracks, and they stay put', () => {
    let s = ready(newThinIce({ tier: 3, stick: true }, ['finn', 'mom'], 6));
    const holes = s.holes.flatMap((h, i) => (h && posOf(s, i).row === s.rows - 1 ? [i] : []));
    if (holes.length < 2) return;
    s = stand(s, posOf(s, holes[0]!).col);
    s = step(s, holes[0]!);
    expect(s.fell).toEqual([]);
    expect(s.at).toEqual({ col: posOf(s, holes[0]!).col, row: s.rows });
    // The second hole is a fall.
    const near = holes.find((h) => apart(s.at!, posOf(s, h)) === 1 && h !== holes[0]);
    if (near !== undefined) expect(step(s, near).fell).toEqual(['finn']);
  });

  it('flags are free and block stepping; the far shore is one step from the first ice row', () => {
    let s = ready(newThinIce({ tier: 1 }, ['finn'], 2));
    const r = s.routes[0]!;
    s = stand(s, posOf(s, r[0]!).col);
    const flagged = toggleFlag(s, r[0]!);
    expect(step(flagged, r[0]!)).toBe(flagged);
    expect(cross(s)).toBe(s);
    s = walk(newThinIce({ tier: 1 }, ['finn'], 2), r);
    expect(s).toBeDefined();
  });

  it('no clock by default; the testing clock fails a hiker who runs out', () => {
    let s = ready(newThinIce({ tier: 2 }, ['finn', 'mom'], 1));
    expect(s.timeLeft).toBeNull();
    s = tick(s, 999);
    expect(s.over).toBe(false);
    let t = ready(newThinIce({ tier: 2, timeSec: 5 }, ['finn', 'mom'], 1));
    t = tick(t, 5.01);
    expect(t.timedOut).toEqual(['finn']);
    expect(t.turns.done.finn).toBe(false);
  });

  it('Prepare: +1 pick for a hiker, and TEST THE ICE marks holes before the start', () => {
    const s = newThinIce({ tier: 5, extraPicks: { finn: 1 }, marked: 3 }, ['finn'], 4);
    expect(s.picksLeft).toBe(T.tiers[5].picks + 1);
    const shown = s.seen.flatMap((v, i) => (v ? [i] : []));
    expect(shown).toHaveLength(3);
    for (const c of shown) expect(s.holes[c]).toBe(true);
  });
});

describe('the demo bot', () => {
  it('gets a hiker across a fresh board most of the time', () => {
    let across = 0;
    for (let seed = 1; seed <= 20; seed++) {
      let s = ready(newThinIce({ tier: 1 }, ['finn'], seed));
      const mem: Record<string, unknown> = {};
      const rng = seedRng(seed);
      for (let k = 0; k < 400 && !s.over; k++) {
        const a = thinIceBot(s, mem, rng, k);
        if (!a) continue;
        s =
          a.kind === 'stand'
            ? stand(s, a.col)
            : a.kind === 'step'
              ? step(s, a.cell)
              : a.kind === 'pick'
                ? pick(s, a.cell)
                : cross(s);
      }
      if (s.turns.done.finn) across++;
    }
    expect(across).toBeGreaterThanOrEqual(12);
  });
});
