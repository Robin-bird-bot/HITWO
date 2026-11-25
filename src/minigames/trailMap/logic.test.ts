/**
 * Trail Map (docs/design/13-minigames-puzzles-2.md, section 6): every board
 * can be solved and none start solved; locked tiles; lighting; the two modes.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import {
  BASE,
  E,
  gateCell,
  lighting,
  N,
  newTrailMap,
  openings,
  pieceFor,
  S,
  solved,
  timeUp,
  turn,
  turnMask,
  W,
  result,
  type Tier,
  type TrailMapState,
} from './logic';

const T = BALANCE.minigames.trailMap;
const HIKERS = ['finn', 'mom', 'ellie', 'wyatt'];

/** Every solution tile turned the way its trail needs. */
const solve = (s: TrailMapState): TrailMapState => ({
  ...s,
  tiles: s.tiles.map((t) => (t.needs === undefined ? t : { ...t, turn: pieceFor(t.needs).turn })),
});

/** Turns a tile until it's solved, one quarter turn at a time, through `turn`. */
function fix(s: TrailMapState, cell: number): TrailMapState {
  let out = s;
  for (let i = 0; i < 4 && !solved(out.tiles[cell]!); i++) out = turn(out, cell, 1);
  return out;
}

describe('pieces', () => {
  it('turn clockwise: north → east → south → west', () => {
    expect(turnMask(N, 1)).toBe(E);
    expect(turnMask(N, 2)).toBe(S);
    expect(turnMask(N, 3)).toBe(W);
    expect(turnMask(BASE.corner, 1)).toBe(E | S);
    expect(turnMask(BASE.tee, 2)).toBe(S | W | N);
  });

  it('every set of openings has a piece and a turn that make it', () => {
    for (let mask = 1; mask < 16; mask++) {
      const { piece, turn: t } = pieceFor(mask);
      expect(turnMask(BASE[piece], t)).toBe(mask);
    }
  });
});

describe('making a board', () => {
  const cases = ([1, 2, 3] as Tier[]).flatMap((tier) =>
    [1, 2, 3, 4].flatMap((hikers) => [1, 2, 3, 4, 5, 6].map((seed) => [tier, hikers, seed])),
  ) as [Tier, number, number][];

  it.each(cases)(
    'Tier %i, %i hikers, seed %i: solvable, and nobody starts connected',
    (tier, n, seed) => {
      const s = newTrailMap({ tier }, HIKERS.slice(0, n), seed);
      expect(s.size).toBe(T.tiers[tier].size);
      expect(lighting(s).connected.size).toBe(0);
      expect(lighting(solve(s)).connected.size).toBe(n);
      // Trailheads are on different tiles from each other and from the exit.
      const cells = [s.exit, ...Object.values(s.heads)].map((g) => {
        const c = gateCell(g, s.size);
        return c.r * s.size + c.c;
      });
      expect(new Set(cells).size).toBe(cells.length);
    },
  );

  it.each([1, 2, 3] as Tier[])(
    'Tier %i: locked tiles are solution tiles, turned right, and never turn',
    (tier) => {
      for (let seed = 1; seed <= 10; seed++) {
        const s = newTrailMap({ tier }, HIKERS.slice(0, 2), seed);
        const locked = s.tiles.flatMap((t, i) => (t.locked ? [i] : []));
        expect(locked).toHaveLength(T.tiers[tier].locked);
        for (const i of locked) {
          expect(s.tiles[i]!.needs).toBeDefined();
          expect(solved(s.tiles[i]!)).toBe(true);
          expect(turn(s, i, 1).tiles[i]!.turn).toBe(s.tiles[i]!.turn);
        }
      }
    },
  );

  it('the Grid and Time settings change the size and the clock', () => {
    expect(newTrailMap({ tier: 1, size: 7 }, ['finn'], 1).size).toBe(7);
    expect(newTrailMap({ tier: 2 }, HIKERS.slice(0, 3), 1).timeSec).toBe(
      T.tiers[2].timeSec + 2 * T.extraSecPerHiker,
    );
    expect(newTrailMap({ tier: 2, time: 'off' }, ['finn'], 1).timeSec).toBeNull();
    expect(newTrailMap({ tier: 2, time: 45 }, ['finn'], 1).timeSec).toBe(45);
  });
});

describe('lighting', () => {
  it('only follows openings that line up on both tiles', () => {
    // A 2-wide row: a straight east-west, then a corner. Trailhead on the left, exit on the right.
    const base = newTrailMap({ tier: 1 }, ['finn'], 1);
    const s: TrailMapState = {
      ...base,
      size: 4,
      exit: { side: 'right', index: 0 },
      heads: { finn: { side: 'left', index: 0 } },
      tiles: Array.from({ length: 16 }, () => ({ piece: 'end' as const, turn: 2 })),
    };
    const row = (a: number, b: number, c: number, d: number) => {
      const tiles = [...s.tiles];
      tiles[0] = { piece: 'straight', turn: a };
      tiles[1] = { piece: 'straight', turn: b };
      tiles[2] = { piece: 'straight', turn: c };
      tiles[3] = { piece: 'straight', turn: d };
      return { ...s, tiles };
    };
    // All turned east-west: connected.
    expect(lighting(row(1, 1, 1, 1)).connected.has('finn')).toBe(true);
    // The third one north-south: the light stops after two tiles.
    const broken = lighting(row(1, 1, 0, 1));
    expect(broken.connected.has('finn')).toBe(false);
    expect([...broken.lit].sort()).toEqual([0, 1]);
    // The first one facing away from the trailhead: nothing lights.
    expect(lighting(row(0, 1, 1, 1)).lit.size).toBe(0);
    expect(openings({ piece: 'straight', turn: 1 })).toBe(E | W);
  });
});

describe('the modes', () => {
  it('One at a time: a hiker passes the moment they connect, and later turns don’t undo it', () => {
    for (let seed = 1; seed <= 8; seed++) {
      let s = newTrailMap({ tier: 2, mode: 'one' }, HIKERS.slice(0, 3), seed);
      const order = s.tiles.flatMap((t, i) => (t.needs !== undefined && !t.locked ? [i] : []));
      let passedAt = -1;
      for (const cell of order) {
        s = fix(s, cell);
        const { connected } = lighting(s);
        for (const id of connected) expect(s.through[id]).toBe(true);
        if (passedAt < 0 && Object.keys(s.through).length) passedAt = cell;
      }
      expect(s.over).toBe(true);
      expect(Object.keys(s.through).sort()).toEqual(['ellie', 'finn', 'mom']);
      // Breaking a trail afterward keeps the passes.
      const after = s.over ? { ...s, over: false } : s;
      const cell = order.find((c) => s.tiles[c]!.piece !== 'cross')!;
      const broken = turn(after, cell, 1);
      expect(Object.keys(broken.through)).toHaveLength(3);
      expect(result(broken).safe).toHaveLength(3);
    }
  });

  it('Together: nobody passes until every trail is connected at once', () => {
    for (let seed = 1; seed <= 8; seed++) {
      let s = newTrailMap({ tier: 1, mode: 'together' }, HIKERS.slice(0, 2), seed);
      const order = s.tiles.flatMap((t, i) => (t.needs !== undefined && !t.locked ? [i] : []));
      for (const cell of order) {
        s = fix(s, cell);
        const all = lighting(s).connected.size === 2;
        expect(Object.keys(s.through).length).toBe(all ? 2 : 0);
      }
      expect(s.over).toBe(true);
    }
  });

  it('when time runs out, whoever isn’t through fails', () => {
    let s = newTrailMap({ tier: 1, mode: 'one' }, HIKERS.slice(0, 2), 3);
    const finnTrail = s.tiles.flatMap((t, i) => (t.needs !== undefined && !t.locked ? [i] : []));
    // Solve until exactly one is through.
    for (const cell of finnTrail) {
      if (Object.keys(s.through).length) break;
      s = fix(s, cell);
    }
    const done = timeUp(s);
    expect(done.over).toBe(true);
    const r = result(done);
    expect(r.safe.length + r.hit.length).toBe(2);
    expect(r.safe).toEqual(Object.keys(s.through));
  });
});
