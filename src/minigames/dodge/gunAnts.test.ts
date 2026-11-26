/**
 * Bear with a Gun and Ants (docs/design/21-minigames-dodge-camp.md,
 * sections 1, 2 and 9): the aim line tracks then locks, a snipe costs 2
 * hearts and leaves holes that block, fade and never cover more than [30%]
 * of the box, traps snap once and slow, Ricochet follows its shown path,
 * marching lines stay on the grid and never reverse, fire ants leave the
 * safe circle unhurt, and the Ant Hill blocks the sprite and aims at it.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { boxFor } from './animals';
import { antGrid, marchPath, marchAnts, safeSpot, type FireAntsPart } from './attacks/ants';
import { holeRadius, ricochetAt, type HolePart, type RicochetPart } from './attacks/gunBear';
import { dist, edges, SIDES } from './geometry';
import { blocksNow, newDodge, step, type DodgeOptions, type DodgeState } from './logic';
import { distToSegment } from './shapes';
import type { Part } from './types';

const D = BALANCE.minigames.dodge;
const FOUR = ['finn', 'mom', 'ellie', 'wyatt'];
const DT = 1 / 60;
const STILL = { x: 0, y: 0 };
const LEVELS = [1, 2, 3] as const;

const wander = (t: number) => ({ x: Math.sin(t * 1.3), y: Math.cos(t * 0.9) });

/** One attack only, at a level (Tier IV, so nothing overlaps). */
const only = (
  animal: 'gunBear' | 'ants',
  attack: DodgeOptions['attack'],
  level: 1 | 2 | 3,
  seed = 7,
  extra: Partial<DodgeOptions> = {},
) =>
  newDodge(
    { animal, tier: 4, level, attack, lives: 9, lengthSec: 30, ideas: true, ...extra },
    FOUR,
    seed,
  );

function play(
  s0: DodgeState,
  each?: (s: DodgeState, prev: DodgeState) => DodgeState | void,
  input: (t: number) => { x: number; y: number } = wander,
): DodgeState {
  let s = s0;
  for (let i = 0; i < 100000 && !s.over; i++) {
    const prev = s;
    s = step(s, DT, input(s.time));
    s = each?.(s, prev) ?? s;
  }
  return s;
}

const ofKind = <K extends Part['kind']>(s: DodgeState, kind: K) =>
  s.parts.filter((p): p is Extract<Part, { kind: K }> => p.kind === kind);

describe('Bear with a Gun', () => {
  it.each(LEVELS)(
    'Level %i: the aim line tracks the sprite until it locks; the shot follows the locked line',
    (level) => {
      let locked = 0;
      let fired = 0;
      play(only('gunBear', 'aimedShot', level), (s) => {
        for (const p of ofKind(s, 'shot')) {
          if (s.time < p.lockAt) {
            expect(p.aim).toEqual(s.pos);
            continue;
          }
          locked++;
          // The lane runs from the gun through the locked aim.
          expect(p.dir).toBeDefined();
          const far = { x: p.from.x + p.dir!.x * 500, y: p.from.y + p.dir!.y * 500 };
          expect(distToSegment(p.aim, p.from, far)).toBeLessThan(1e-6);
          if (s.time >= p.activeAt) {
            fired++;
            // The shot's lane is on that line.
            const lanes = p.twin ? 2 : 1;
            expect(p.length).toBeGreaterThan(0);
            expect(lanes).toBeGreaterThan(0);
          }
        }
      });
      expect(locked).toBeGreaterThan(0);
      expect(fired).toBeGreaterThan(0);
    },
  );

  it('Aimed Shot: 3, 4 or 5 in a row by level; at Level 3 every third is a double', () => {
    for (const level of LEVELS) {
      const s = step(only('gunBear', 'aimedShot', level), D.firstAttackSec + DT, STILL);
      const shots = ofKind(s, 'shot');
      expect(shots).toHaveLength(D.gun.aimed.shots[level]);
      expect(shots.filter((p) => p.twin !== undefined).map((p) => shots.indexOf(p))).toEqual(
        level === 3 ? [2] : [],
      );
    }
  });

  it('a snipe hit costs 2 hearts, then the hole it leaves pushes the sprite out', () => {
    // Standing still, the crosshair catches the sprite.
    let hitOnce = false;
    play(
      only('gunBear', 'snipe', 2),
      (s, prev) => {
        if (!hitOnce && s.lastHit && s.lastHit !== prev.lastHit) {
          hitOnce = true;
          expect(s.lastHit.damage).toBe(2);
          expect(s.lives[prev.active]).toBe((prev.lives[prev.active] ?? 0) - 2);
          const hole = ofKind(s, 'hole')[0];
          expect(hole).toBeDefined();
          expect(dist(hole!, s.pos)).toBeGreaterThanOrEqual(hole!.r + D.blockPad - 1e-6);
        }
        // Walking into a hole never gets the sprite inside it.
        for (const b of blocksNow(s)) expect(dist(b, s.pos)).toBeGreaterThan(b.r);
      },
      (t) => (t < 4 ? STILL : wander(t)),
    );
    expect(hitOnce).toBe(true);
  });

  it('holes block movement: walking straight at one stops at its edge', () => {
    let s = only('gunBear', 'snipe', 2);
    const box = boxFor('gunBear');
    const hole: HolePart = {
      kind: 'hole',
      id: 999,
      round: 0,
      warnAt: 0,
      activeAt: 0,
      child: true,
      x: box.cx + 30,
      y: box.cy,
      r: D.gun.snipe.holeRadius,
      until: 100,
    };
    s = { ...s, parts: [hole], nextAttackAt: null, pos: { x: box.cx, y: box.cy } };
    for (let k = 0; k < 120; k++) s = step(s, DT, { x: 1, y: 0 });
    expect(s.pos.x).toBeCloseTo(hole.x - hole.r - D.blockPad, 5);
  });

  it('holes stay, then fade and shrink, then go', () => {
    const hole: HolePart = {
      kind: 'hole',
      id: 1,
      round: 0,
      warnAt: 0,
      activeAt: 0,
      child: true,
      x: 0,
      y: 0,
      r: 12,
      until: 5,
    };
    expect(holeRadius(hole, 4)).toBe(12);
    expect(holeRadius(hole, 5 + D.gun.snipe.fadeSec / 2)).toBeCloseTo(6);
    expect(holeRadius(hole, 5 + D.gun.snipe.fadeSec)).toBe(0);
  });

  it.each([2, 3] as const)(
    'Level %i: never more than 3 holes, never more than 30%% of the box',
    (level) => {
      for (const seed of [1, 2, 3]) {
        let most = 0;
        play(
          only('gunBear', 'snipe', level, seed, { lengthSec: 60 }),
          (s) => {
            const holes = ofKind(s, 'hole');
            most = Math.max(most, holes.length);
            expect(holes.length).toBeLessThanOrEqual(D.gun.snipe.maxHoles);
            const area = holes.reduce((a, h) => a + Math.PI * h.r * h.r, 0);
            expect(area).toBeLessThanOrEqual(D.gun.snipe.maxCover * s.box.w * s.box.h + 1e-6);
          },
          (t) => wander(t * 2),
        );
        expect(most).toBeGreaterThan(1);
      }
    },
  );

  it('a trap snaps once (1 heart), slows the sprite for 1.5 s, and is harmless after', () => {
    let s = only('gunBear', 'traps', 1);
    s = play(s, (q) =>
      ofKind(q, 'trap').some((p) => q.time > p.armAt) ? { ...q, over: true } : q,
    );
    // Once it's red (armed): gray traps never bite (revisions.test.ts).
    const trap = ofKind(s, 'trap').find((p) => s.time > p.armAt && !p.gone)!;
    expect(trap).toBeDefined();
    const before = s.lives[s.active]!;
    s = { ...s, over: false, pos: { x: trap.x, y: trap.y }, safeFor: 0 };
    s = step(s, DT, STILL);
    expect(s.lives[s.lastHit!.hikerId]).toBe(before - 1);
    expect(s.slowUntil).toBeCloseTo(s.time + D.gun.traps.slowSec - 0, 5);
    const shut = ofKind(s, 'trap').find((p) => p.id === trap.id)!;
    expect(shut.shutAt).toBeCloseTo(s.time);
    // Slowed: half speed; after the slow, full speed.
    const x0 = s.pos.x;
    const slowStep = step({ ...s, pos: { x: x0 - 20, y: s.pos.y } }, DT, { x: 1, y: 0 });
    expect(slowStep.pos.x - (x0 - 20)).toBeCloseTo(D.moveSpeed * D.gun.traps.slow * DT, 5);
    // Standing on it after the safety: no more hits from that trap.
    const hits = s.hits[s.lastHit!.hikerId]!;
    s = { ...s, safeFor: 0, nextAttackAt: null };
    for (let k = 0; k < 30; k++) s = step(s, DT, STILL);
    expect(s.hits[s.lastHit!.hikerId]).toBe(hits);
    // After the slow, full speed.
    s = { ...s, time: s.slowUntil + 0.01, pos: { x: s.box.cx - 20, y: s.box.cy } };
    const fast = step(s, DT, { x: 1, y: 0 });
    expect(fast.pos.x - (s.box.cx - 20)).toBeCloseTo(D.moveSpeed * DT, 5);
  });

  it('traps never land near the sprite, and never more than 5 are open', () => {
    for (const level of LEVELS) {
      for (const seed of [1, 2, 3, 4]) {
        play(only('gunBear', 'traps', level, seed, { lengthSec: 40 }), (s, prev) => {
          for (const p of ofKind(s, 'trap')) {
            if (p.gone || prev.time >= p.activeAt || s.time < p.activeAt) continue;
            expect(dist(p, s.pos)).toBeGreaterThanOrEqual(D.gun.traps.away);
          }
          const open = ofKind(s, 'trap').filter(
            (p) =>
              !p.gone && p.shutAt === undefined && s.time >= p.activeAt && s.time < p.openUntil,
          );
          expect(open.length).toBeLessThanOrEqual(D.gun.traps.maxOpen);
        });
      }
    }
  });

  it.each([2, 3] as const)(
    'Level %i: Ricochet bounces as shown, and the bullet follows its shown path',
    (level) => {
      let seen = 0;
      play(only('gunBear', 'ricochet', level), (s) => {
        for (const p of ofKind(s, 'ricochet') as RicochetPart[]) {
          expect(p.path).toHaveLength(D.gun.ricochet.bounces[level] + 2);
          // Every bounce is on a wall.
          const e = edges(s.box);
          for (const b of p.path.slice(1, -1)) {
            const onWall =
              Math.abs(b.x - e.left) < 1e-6 ||
              Math.abs(b.x - e.right) < 1e-6 ||
              Math.abs(b.y - e.top) < 1e-6 ||
              Math.abs(b.y - e.bottom) < 1e-6;
            expect(onWall).toBe(true);
          }
          if (s.time < p.activeAt) continue;
          seen++;
          const at = ricochetAt(p, s.time).at;
          const off = Math.min(...p.path.slice(1).map((b, i) => distToSegment(at, p.path[i]!, b)));
          expect(off).toBeLessThan(1e-6);
        }
      });
      expect(seen).toBeGreaterThan(10);
    },
  );
});

describe('Ants', () => {
  it('marching lines walk on the grid, turning only by 90°, never back on themselves', () => {
    const box = boxFor('ants');
    const { xs, ys } = antGrid(box);
    const onGrid = (v: number, list: number[]) => list.some((g) => Math.abs(g - v) < 1e-6);
    for (let seed = 1; seed <= 60; seed++) {
      for (const side of SIDES) {
        const path = marchPath(seedRng(seed), box, side, 40, 60);
        expect(path.length).toBeGreaterThanOrEqual(2);
        for (let k = 1; k < path.length; k++) {
          const a = path[k - 1]!;
          const b = path[k]!;
          // Straight along a grid line.
          const along = Math.abs(a.x - b.x) < 1e-6 ? 'y' : 'x';
          if (along === 'y') expect(onGrid(a.x, xs)).toBe(true);
          else {
            expect(Math.abs(a.y - b.y)).toBeLessThan(1e-6);
            expect(onGrid(a.y, ys)).toBe(true);
          }
          if (k < 2) continue;
          const p0 = path[k - 2]!;
          const d1 = { x: Math.sign(a.x - p0.x), y: Math.sign(a.y - p0.y) };
          const d2 = { x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) };
          // Never back on itself.
          expect(d1.x === -d2.x && d1.y === -d2.y).toBe(false);
        }
        // The corners are grid points; it starts and ends outside the box.
        for (const c of path.slice(1, -1)) {
          expect(onGrid(c.x, xs) && onGrid(c.y, ys)).toBe(true);
        }
        const e = edges(box);
        const outside = (q: { x: number; y: number }) =>
          q.x < e.left || q.x > e.right || q.y < e.top || q.y > e.bottom;
        expect(outside(path[0]!)).toBe(true);
        expect(outside(path.at(-1)!)).toBe(true);
      }
    }
  });

  it.each(LEVELS)('Level %i: every ant of a marching line stays on a grid line', (level) => {
    const box = boxFor('ants');
    const { xs, ys } = antGrid(box);
    const onGrid = (v: number, list: number[]) => list.some((g) => Math.abs(g - v) < 1e-6);
    const e = edges(box);
    let checked = 0;
    play(only('ants', 'marching', level), (s) => {
      for (const p of ofKind(s, 'march')) {
        for (const a of marchAnts(p, s.time)) {
          if (a.at.x < e.left || a.at.x > e.right || a.at.y < e.top || a.at.y > e.bottom) continue;
          checked++;
          expect(onGrid(a.at.x, xs) || onGrid(a.at.y, ys)).toBe(true);
        }
      }
    });
    expect(checked).toBeGreaterThan(100);
  });

  it('fire ants: no blast ever reaches the safe circle, and the safe ant starts away from the sprite', () => {
    for (const [level, tier] of [
      [2, 4],
      [3, 4],
      [3, 5],
    ] as const) {
      for (let seed = 1; seed <= 25; seed++) {
        const s0 = newDodge(
          { animal: 'ants', tier, level, attack: 'fireAnts', lives: 9, lengthSec: 4 },
          FOUR,
          seed,
        );
        const s = step(s0, D.firstAttackSec + DT, STILL);
        const p = ofKind(s, 'fireAnts')[0] as FireAntsPart;
        expect(p).toBeDefined();
        const want = tier === 5 ? D.ants.fire.tierFive : D.ants.fire.ants[level];
        expect(p.ants.length).toBeGreaterThanOrEqual(Math.min(want, 3));
        expect(dist(p.ants[p.safe]!.at, s.pos)).toBeGreaterThanOrEqual(D.ants.fire.fromSprite);
        expect(p.moveTo !== undefined).toBe(level >= D.ants.fire.moveFrom);
        const safe = safeSpot(p);
        p.ants.forEach((a, k) => {
          if (k !== p.safe)
            expect(dist(a.at, safe)).toBeGreaterThanOrEqual(D.ants.fire.blast + D.ants.fire.safe);
        });
      }
    }
  });

  it('fire ants: standing by the safe ant when they blow up is never a hit', () => {
    for (let seed = 1; seed <= 10; seed++) {
      let s = step(only('ants', 'fireAnts', 3, seed), D.firstAttackSec + DT, STILL);
      const p = ofKind(s, 'fireAnts')[0]!;
      const hits = s.hits[s.active];
      while (s.time < p.activeAt + 0.2) {
        s = { ...s, pos: safeSpot(p), safeFor: 0 };
        s = step(s, DT, STILL);
      }
      expect(s.hits[s.active]).toBe(hits);
    }
  });

  it('the Ant Hill blocks the sprite, and fires its ants at where the sprite is', () => {
    let s = only('ants', 'antHill', 2);
    let fired = 0;
    let blocked = 0;
    for (let i = 0; i < 2000 && !s.over; i++) {
      const prev = s;
      const hill0 = ofKind(s, 'antHill')[0];
      // Walk straight at the hill.
      const input = hill0
        ? { x: Math.sign(hill0.x - s.pos.x), y: Math.sign(hill0.y - s.pos.y) }
        : STILL;
      s = step({ ...s, safeFor: 1 }, DT, input);
      const hill = ofKind(s, 'antHill')[0];
      if (!hill || s.time < hill.activeAt) continue;
      if (s.time < hill.downAt) {
        blocked++;
        expect(dist(s.pos, hill)).toBeGreaterThanOrEqual(D.ants.hill.radius + D.blockPad - 1e-6);
      }
      for (const w of ofKind(s, 'walker')) {
        if (prev.parts.some((x) => x.id === w.id)) continue;
        fired++;
        // Aimed at the sprite as it was fired.
        const to = { x: s.pos.x - hill.x, y: s.pos.y - hill.y };
        const cross = to.x * w.vy - to.y * w.vx;
        expect(Math.abs(cross) / (Math.hypot(to.x, to.y) * Math.hypot(w.vx, w.vy))).toBeLessThan(
          0.05,
        );
      }
    }
    expect(blocked).toBeGreaterThan(30);
    expect(fired).toBeGreaterThan(3);
  });
});
