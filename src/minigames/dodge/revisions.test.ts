/**
 * Dodge's Nov 26 second-round revisions (docs/design/22-minigame-revisions.md,
 * sections 3 to 6): Bear with a Gun's traps land gray and never bite until
 * they turn red; Ricochet fires the tier's number of shots; Bullet Ring
 * never plays below Tier IV; Ants at Easy play only Marching Lines and Ant
 * Mill, with one line and one ring, and two rings never show below Level 3;
 * the Sword sweep is gone, and Sword Volley's swords fly in number order,
 * never closer together than the minimum.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { ANIMALS, attackChoices, pool } from './animals';
import { ANT_MILL, MARCHING } from './attacks/ants';
import { BULLET_RING, RICOCHET, ringPellets, type TrapPart } from './attacks/gunBear';
import { VOLLEY, volleyTip } from './attacks/sword';
import { dist, edges } from './geometry';
import { ATTACKS } from './library';
import { newDodge, step, type DodgeOptions, type DodgeState } from './logic';
import type { AttackCtx, Part, VolleyPart } from './types';
import { TIERS, type Tier } from '../types';

const D = BALANCE.minigames.dodge;
const FOUR = ['finn', 'mom', 'ellie', 'wyatt'];
const DT = 1 / 60;
const STILL = { x: 0, y: 0 };

const game = (animal: DodgeOptions['animal'], tier: Tier, extra: Partial<DodgeOptions> = {}) =>
  newDodge({ animal, tier, lives: 9, lengthSec: 30, ideas: true, ...extra }, FOUR, 5);

/** An attack's context from a fresh game (no other attacks running). */
function ctxOf(s: DodgeState, seed = 1): AttackCtx {
  let n = 1000;
  return {
    level: s.level,
    easy: s.easy,
    time: 0,
    box: s.box,
    pos: { ...s.pos },
    rng: seedRng(seed),
    speed: s.speed,
    round: 0,
    nextId: () => n++,
    tweak: {},
    state: s,
  };
}

/** Plays a whole game, sprite wandering, and lists every part ever seen. */
function partsSeen(s0: DodgeState): Part[] {
  const seen = new Map<number, Part>();
  let s = s0;
  for (let i = 0; i < 100000 && !s.over; i++) {
    s = step(s, DT, { x: Math.sin(s.time * 1.3), y: Math.cos(s.time * 0.9) });
    for (const p of s.parts) if (!seen.has(p.id)) seen.set(p.id, p);
  }
  return [...seen.values()];
}

describe('Bear with a Gun', () => {
  it('a gray trap never hits; once it turns red, it bites', () => {
    const base = { ...game('gunBear', 3), nextAttackAt: Infinity };
    const trap: TrapPart = {
      kind: 'trap',
      id: 1,
      round: 0,
      warnAt: 0,
      activeAt: 0,
      from: { x: base.pos.x, y: base.box.cy - 60 },
      x: base.pos.x,
      y: base.pos.y,
      armAt: D.gun.traps.armSec,
      openUntil: D.gun.traps.armSec + 5,
    };
    let s: DodgeState = { ...base, parts: [trap] };
    const hits = () => Object.values(s.hits).reduce((a, b) => a + b, 0);
    while (s.time < D.gun.traps.armSec - DT) {
      s = step(s, DT, STILL);
      expect(hits()).toBe(0);
    }
    for (let k = 0; k < 10; k++) s = step(s, DT, STILL);
    expect(hits()).toBe(1);
  });

  it('traps’ open time starts when they turn red', () => {
    const s = game('gunBear', 3);
    const start = ATTACKS.traps.start(ctxOf(s));
    for (const p of start.parts as TrapPart[]) {
      expect(p.armAt).toBeCloseTo(p.activeAt + D.gun.traps.armSec);
      expect(p.openUntil).toBeCloseTo(p.armAt + D.gun.traps.openSec[s.level]);
    }
  });

  it.each([3, 4, 5] as const)(
    'Tier %i: Ricochet fires the tier’s number of shots, every path shown at once, then a moment apart',
    (tier) => {
      const s = game('gunBear', tier, { level: 3 });
      const parts = RICOCHET.start(ctxOf(s)).parts;
      expect(parts).toHaveLength(D.gun.ricochet.shots[tier]);
      for (const p of parts) expect(p.warnAt).toBe(0);
      parts.forEach((p, k) =>
        expect(p.activeAt - parts[0]!.activeAt).toBeCloseTo(k * D.gun.ricochet.gapSec),
      );
    },
  );

  it('Bullet Ring never plays below Tier IV (the pool, the Attack picker and real games)', () => {
    for (const tier of TIERS) {
      const inPool = pool('gunBear', 3, true, 'all', tier).some((e) => e.attack === 'bulletRing');
      expect(inPool).toBe(tier >= 4);
      const choice = attackChoices('gunBear', 3, true, tier).find((c) => c.id === 'bulletRing')!;
      expect(choice.unlocked).toBe(tier >= 4);
      if (tier < 4) expect(choice.where).toBe('from Tier IV');
    }
    for (const tier of [1, 2, 3] as const) {
      const seen = partsSeen(game('gunBear', tier, { level: 3, attack: 'bulletRing' }));
      expect(seen.some((p) => p.kind === 'bulletRing')).toBe(false);
    }
    const t5 = partsSeen(game('gunBear', 5, { attack: 'bulletRing' }));
    expect(t5.some((p) => p.kind === 'bulletRing')).toBe(true);
  });

  it.each([4, 5] as const)(
    'Tier %i: the rings come from the top’s middle, turned from the last; only pellets flying into the box count',
    (tier) => {
      const s = game('gunBear', tier);
      const rings = BULLET_RING.start(ctxOf(s)).parts.filter((p) => p.kind === 'bulletRing');
      expect(rings).toHaveLength(D.gun.bulletRing.rings[tier]);
      const top = edges(s.box).top;
      for (const r of rings) {
        expect(r.from).toEqual({ x: s.box.cx, y: top });
        const pellets = ringPellets(r, r.activeAt + 0.3);
        expect(pellets.length).toBeGreaterThan(0);
        expect(pellets.length).toBeLessThan(D.gun.bulletRing.bullets);
        for (const q of pellets) expect(q.y).toBeGreaterThan(top);
      }
      for (let k = 1; k < rings.length; k++) {
        expect(rings[k]!.a0 - rings[k - 1]!.a0).toBeCloseTo(
          (D.gun.bulletRing.turnDeg * Math.PI) / 180,
        );
        expect(rings[k]!.activeAt - rings[k - 1]!.activeAt).toBeCloseTo(D.gun.bulletRing.apartSec);
      }
    },
  );
});

describe('Ants', () => {
  it('Easy (Tier I) plays only Marching Lines and Ant Mill', () => {
    const s = game('ants', 1);
    expect(s.easy).toBe(true);
    expect([...new Set(pool('ants', 0, true).map((e) => e.attack))].sort()).toEqual([
      'antMill',
      'marching',
    ]);
    const kinds = new Set(partsSeen(s).map((p) => p.kind));
    expect([...kinds].every((k) => k === 'march' || k === 'mill')).toBe(true);
  });

  it('Easy has one line and one ring, and no column', () => {
    const s = game('ants', 1);
    for (let seed = 1; seed <= 10; seed++) {
      const lines = MARCHING.start(ctxOf(s, seed)).parts;
      expect(lines).toHaveLength(1);
      const mill = ANT_MILL.start(ctxOf(s, seed)).parts;
      expect(mill.filter((p) => p.kind === 'mill')).toHaveLength(1);
      expect(mill.filter((p) => p.kind === 'march')).toHaveLength(0);
    }
  });

  it.each([1, 2, 3] as const)('Level %i: two rings only at Level 3', (level) => {
    const s = game('ants', 4, { level });
    for (let seed = 1; seed <= 10; seed++) {
      const rings = ANT_MILL.start(ctxOf(s, seed)).parts.filter((p) => p.kind === 'mill');
      if (level < 3) expect(rings).toHaveLength(1);
      else expect(rings.length).toBeLessThanOrEqual(2);
    }
  });
});

describe('Bear with a Sword', () => {
  it('the Sword sweep is gone; Sword Volley is in its place', () => {
    expect(Object.keys(ATTACKS)).not.toContain('sweep');
    const his = ANIMALS.swordBear.attacks.map((a) => a.attack);
    expect(his).not.toContain('sweep');
    expect(his).toContain('volley');
  });

  it.each([1, 2, 3] as const)(
    'Level %i: the swords appear and fly in number order, never closer than the minimum, tips just inside',
    (level) => {
      const s = game('swordBear', 3, { level });
      for (let seed = 1; seed <= 20; seed++) {
        const parts = VOLLEY.start(ctxOf(s, seed)).parts as VolleyPart[];
        expect(parts).toHaveLength(D.volley.swords[level]);
        parts.forEach((p, k) => {
          expect(p.n).toBe(k + 1);
          if (k === 0) return;
          const prev = parts[k - 1]!;
          expect(p.warnAt).toBeGreaterThan(prev.warnAt);
          expect(p.activeAt - prev.activeAt).toBeCloseTo(D.volley.flyGapSec);
        });
        const e = edges(s.box);
        const walls = parts.map((p) => ({
          x: p.tip.x - p.dir.x * D.volley.tipIn,
          y: p.tip.y - p.dir.y * D.volley.tipIn,
        }));
        walls.forEach((w, k) => {
          for (const o of walls.slice(k + 1))
            expect(dist(w, o)).toBeGreaterThanOrEqual(D.volley.apart);
          // On a wall, at least the corner distance from either end.
          const along =
            Math.abs(w.x - e.left) < 1e-6 || Math.abs(w.x - e.right) < 1e-6
              ? [w.y - e.top, e.bottom - w.y]
              : [w.x - e.left, e.right - w.x];
          for (const a of along) expect(a).toBeGreaterThanOrEqual(D.volley.corner - 1e-6);
        });
      }
    },
  );

  it('a waiting sword never hits; a flying one does', () => {
    const base = { ...game('swordBear', 3, { level: 1 }), nextAttackAt: Infinity };
    const parts = VOLLEY.start(ctxOf(base)).parts as VolleyPart[];
    const first = parts[0]!;
    // The sprite right by the first sword's tip, then in its path.
    const nearTip = { x: first.tip.x + first.dir.x * 4, y: first.tip.y + first.dir.y * 4 };
    let s: DodgeState = { ...base, parts: [first], pos: nearTip };
    const hits = () => Object.values(s.hits).reduce((a, b) => a + b, 0);
    while (s.time < first.activeAt - DT) {
      s = step(s, DT, STILL);
      expect(hits()).toBe(0);
    }
    for (let k = 0; k < 20; k++) s = step(s, DT, STILL);
    expect(hits()).toBe(1);
    expect(volleyTip(first, first.activeAt + 0.1)).not.toEqual(first.tip);
  });
});
