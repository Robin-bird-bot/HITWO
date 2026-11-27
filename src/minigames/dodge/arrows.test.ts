/**
 * Dodge fixes after Wyatt played (docs/design/26-fixes-and-wyatt-trees.md,
 * section 3): arrows on the attacks that move across the box, and
 * Avalanche's bigger gap near the sprite.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { ANIMAL_IDS, pool } from './animals';
import { arrowFade, moveArrows } from './arrows';
import { avalancheColumns, avalancheGap, type AvalanchePart } from './attacks/snow';
import { edges } from './geometry';
import { ATTACKS } from './library';
import { newDodge, step, type DodgeState } from './logic';
import type { AnimalId, AttackId } from './types';

const D = BALANCE.minigames.dodge;
const S = D.snow;
const FOUR = ['finn', 'mom', 'ellie', 'wyatt'];
const DT = 1 / 60;
const wander = (t: number) => ({ x: Math.sin(t * 1.3), y: Math.cos(t * 0.9) });

const MOVING: readonly AttackId[] = [
  'swoop',
  'wingGust',
  'combOver',
  'tailSweep',
  'antlerCharge',
  'avalanche',
];

/** One attack, played at Level 3 (Tier IV, so nothing overlaps). */
const only = (animal: AnimalId, attack: AttackId, seed = 5) =>
  newDodge(
    { animal, tier: 4, level: 3, attack, lives: 99, lengthSec: 20, ideas: true },
    FOUR,
    seed,
  );

/** Plays a game for a while, handing each frame to `each`. */
function play(s0: DodgeState, sec: number, each: (s: DodgeState) => void) {
  let s = s0;
  while (s.time < sec && !s.over) {
    s = step(s, DT, wander(s.time));
    each(s);
  }
}

describe('arrows on attacks that move across the box', () => {
  it('are on Comb-Over, Avalanche, Antler Charge, Swoop, Wing Gust and Tail Sweep only', () => {
    const flagged = (Object.keys(ATTACKS) as AttackId[]).filter((id) => ATTACKS[id].movesAcross);
    expect(flagged.sort()).toEqual([...MOVING].sort());
  });

  const owner: Readonly<Record<string, AnimalId>> = {
    swoop: 'eagle',
    wingGust: 'eagle',
    combOver: 'eagle',
    tailSweep: 'snowLeopard',
    antlerCharge: 'snowgirl',
    avalanche: 'snowgirl',
  };

  it.each(MOVING)('%s: arrows show while it warns, then fade once it moves', (attack) => {
    let warned = 0;
    let after = 0;
    play(only(owner[attack]!, attack), 12, (s) => {
      for (const p of s.parts) {
        // A chained attack's later parts wait for their own warning.
        if (s.time < p.warnAt) continue;
        const arrows = moveArrows(p, s.box);
        if (!arrows.length) continue;
        if (s.time < p.activeAt) {
          warned++;
          expect(arrowFade(p, s.time)).toBe(1);
          for (const a of arrows) expect(Number.isFinite(a.angle)).toBe(true);
        } else if (s.time > p.activeAt + D.arrows.fadeSec) {
          after++;
          expect(arrowFade(p, s.time)).toBe(0);
        }
      }
    });
    expect(warned).toBeGreaterThan(0);
    expect(after).toBeGreaterThan(0);
  });

  it('Comb-Over: [4] arrows in front of the wall, none across the gap, pointing the way it sweeps', () => {
    play(only('eagle', 'combOver'), 8, (s) => {
      for (const p of s.parts) {
        if (p.kind !== 'comb' || s.time >= p.activeAt) continue;
        const arrows = moveArrows(p, s.box);
        expect(arrows).toHaveLength(D.arrows.comb);
        for (const a of arrows) {
          expect(Math.abs(a.y - p.gapAt)).toBeGreaterThan(D.eagle.comb.gap / 2);
          expect(a.angle).toBe(p.side === 'left' ? 0 : 180);
        }
      }
    });
  });

  it('Avalanche: a down arrow under each falling column', () => {
    play(only('snowgirl', 'avalanche'), 8, (s) => {
      for (const p of s.parts) {
        if (p.kind !== 'avalanche' || s.time >= p.activeAt) continue;
        const arrows = moveArrows(p, s.box);
        expect(arrows).toHaveLength(avalancheColumns(p, s.box).length);
        for (const a of arrows) {
          expect(a.angle).toBe(90);
          expect(
            a.x < edges(s.box).left + p.gapAt || a.x > edges(s.box).left + p.gapAt + p.gapW,
          ).toBe(true);
        }
      }
    });
  });

  it('nothing else has arrows', () => {
    for (const animal of ANIMAL_IDS) {
      const attacks = new Set(pool(animal, 3, true).map((e) => e.attack));
      for (const attack of attacks) {
        if (MOVING.includes(attack)) continue;
        play(only(animal, attack, 2), 4, (s) => {
          for (const p of s.parts) expect(moveArrows(p, s.box), `${animal} ${attack}`).toEqual([]);
        });
      }
    }
  });
});

describe('Avalanche’s gap', () => {
  const box = { cx: 160, cy: 141, w: 150, h: 110 };
  const e = edges(box);

  it('is [38] units wide, with the columns on each side splitting their space evenly', () => {
    const p = {
      kind: 'avalanche',
      id: 1,
      round: 1,
      warnAt: 0,
      activeAt: 1,
      gapAt: 50,
      gapW: S.avalanche.gap,
      speed: 100,
    } satisfies AvalanchePart;
    expect(S.avalanche.gap).toBe(38);
    const cols = avalancheColumns(p, box);
    const left = cols.filter((c) => c.x < e.left + p.gapAt);
    const right = cols.filter((c) => c.x >= e.left + p.gapAt + p.gapW);
    expect(left.length + right.length).toBe(cols.length);
    // Each side is split evenly and covers its whole space.
    for (const side of [left, right]) {
      for (const c of side) expect(c.w).toBeCloseTo(side[0]!.w, 6);
    }
    expect(left.reduce((n, c) => n + c.w, 0)).toBeCloseTo(p.gapAt, 6);
    expect(right.reduce((n, c) => n + c.w, 0)).toBeCloseTo(box.w - p.gapAt - p.gapW, 6);
  });

  it('starts within [60] units of the sprite, never over it', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const x of [e.left + 4, e.left + 40, 160, e.right - 30, e.right - 4]) {
        const pos = { x, y: 150 };
        const gapAt = avalancheGap({ box, pos, rng: seedRng(seed) });
        const from = e.left + gapAt;
        const to = from + S.avalanche.gap;
        expect(from).toBeGreaterThanOrEqual(e.left - 1e-9);
        expect(to).toBeLessThanOrEqual(e.right + 1e-9);
        // The sprite (and its hit circle) is never inside the gap.
        expect(x + D.hitRadius <= from || x - D.hitRadius >= to).toBe(true);
        expect(Math.abs((from + to) / 2 - x)).toBeLessThanOrEqual(S.avalanche.near);
      }
    }
  });

  it('warns for [1.1 s]', () => {
    expect(S.avalanche.warnSec).toBe(1.1);
  });
});
