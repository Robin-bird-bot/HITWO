/**
 * The Eagle, the Snow Leopard, the Snowgirl and ice
 * (docs/design/23-minigames-final.md, sections 9 and 13): the Eagle's
 * version follows the level (or the testing tab's Version), each version
 * keeps the earlier ones' attacks, Freeagle's puddles and the snow animals'
 * boxes slide, and nothing else does.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { ANIMAL_IDS, eagleAttacks, eagleVersionFor, SNOW_ANIMALS } from './animals';
import { newDodge, onIce, step, type DodgeOptions, type DodgeState } from './logic';
import type { AnimalId } from './types';

const D = BALANCE.minigames.dodge;
const FOUR = ['finn', 'mom', 'ellie', 'wyatt'];
const DT = 1 / 60;
const RIGHT = { x: 1, y: 0 };
const STILL = { x: 0, y: 0 };

const game = (animal: AnimalId, extra: Partial<DodgeOptions> = {}, seed = 3) =>
  newDodge({ animal, tier: 4, lives: 99, lengthSec: 30, ideas: true, ...extra }, FOUR, seed);

/** Steps the game, steering with `input`, for `sec` seconds. */
function run(s0: DodgeState, sec: number, input: (t: number) => { x: number; y: number }) {
  let s = s0;
  const end = s.time + sec;
  while (s.time < end && !s.over) s = step(s, DT, input(s.time));
  return s;
}

describe('the Eagle’s version', () => {
  it('follows the level: Easy is the Eagle, Level 1 Toupeeagle, Levels 2 and 3 Freeagle', () => {
    expect(eagleVersionFor(0)).toBe('eagle');
    expect(eagleVersionFor(1)).toBe('toupeeEagle');
    expect(eagleVersionFor(2)).toBe('freeagle');
    expect(eagleVersionFor(3)).toBe('freeagle');
    expect(game('eagle', { tier: 1 }).eagle).toBe('eagle');
    expect(game('eagle', { tier: 2 }).eagle).toBe('toupeeEagle');
    expect(game('eagle', { tier: 3 }).eagle).toBe('freeagle');
    expect(game('eagle', { tier: 5 }).eagle).toBe('freeagle');
    expect(game('eagle', { tier: 5, level: 1 }).eagle).toBe('toupeeEagle');
    expect(game('eagle', { tier: 5, level: 'easy' }).eagle).toBe('eagle');
  });

  it('the testing tab’s Version wins over the level', () => {
    expect(game('eagle', { tier: 1, eagleVersion: 'freeagle' }).eagle).toBe('freeagle');
    expect(game('eagle', { tier: 5, eagleVersion: 'eagle' }).eagle).toBe('eagle');
    expect(game('eagle', { tier: 3, eagleVersion: 'auto' }).eagle).toBe('freeagle');
  });

  it('each version keeps the earlier versions’ attacks and adds its own', () => {
    const ids = (v: Parameters<typeof eagleAttacks>[0]) => eagleAttacks(v).map((e) => e.attack);
    expect(ids('eagle')).toEqual(['swoop', 'featherFall', 'talonDrop', 'wingGust']);
    expect(ids('toupeeEagle')).toEqual([...ids('eagle'), 'hairToss', 'combOver']);
    expect(ids('freeagle')).toEqual([
      ...ids('toupeeEagle'),
      'aimedShot',
      'rapidFire',
      'oilBarrels',
    ]);
  });
});

describe('ice', () => {
  it.each(SNOW_ANIMALS)('%s: the whole box slides', (animal) => {
    let s = game(animal, { lives: 99 });
    expect(s.ice).toBe(true);
    expect(onIce(s)).toBe(true);
    // It speeds up, not all at once.
    s = step(s, DT, RIGHT);
    expect(s.vel.x).toBeCloseTo(D.ice.accel * DT, 6);
    s = run(s, 0.3, () => RIGHT);
    // Let go: it keeps sliding, slowing down.
    const at = s.pos.x;
    const v = s.vel.x;
    expect(v).toBeGreaterThan(0);
    s = step(s, DT, STILL);
    expect(s.pos.x).toBeGreaterThan(at);
    expect(s.vel.x).toBeLessThan(v);
    expect(s.vel.x).toBeCloseTo(v * Math.exp(-D.ice.friction * DT), 6);
  });

  it('GRIP makes the ice less slippery', () => {
    const slow = (grip: boolean) => {
      let s = run(game('snowgirl', { grip }), 0.3, () => RIGHT);
      const v = s.vel.x;
      s = step(s, DT, STILL);
      return s.vel.x / v;
    };
    expect(slow(true)).toBeCloseTo(Math.exp(-D.ice.friction * D.ice.grip * DT), 6);
    expect(slow(true)).toBeLessThan(slow(false));
  });

  it('it stops at the box’s walls', () => {
    const s = run(game('snowLeopard'), 3, () => RIGHT);
    expect(s.vel.x).toBe(0);
  });

  it('Freeagle’s oil puddles slide, and only while they last', () => {
    let s = game('eagle', { tier: 3, attack: 'oilBarrels' });
    expect(s.ice).toBe(false);
    s = run(s, 15, () => STILL);
    const oil = s.parts.find((p) => p.kind === 'oil');
    if (oil?.kind !== 'oil') throw new Error('no puddle yet');
    // Stand in the puddle (the only one left): it slides. Just outside it doesn't.
    s = { ...s, parts: s.parts.filter((p) => p.kind !== 'oil' || p.id === oil.id) };
    const inside = { ...s, pos: { x: oil.x, y: oil.y }, safeFor: 99 };
    expect(onIce(inside)).toBe(true);
    const outside = { ...s, pos: { x: oil.x + oil.r + 2, y: oil.y }, safeFor: 99 };
    expect(onIce(outside)).toBe(false);
    // Once it dries up, nothing slides.
    expect(onIce({ ...inside, time: oil.until + 0.01 })).toBe(false);
  });

  it.each(ANIMAL_IDS.filter((a) => !SNOW_ANIMALS.includes(a)))(
    '%s: nothing slides (outside Freeagle’s puddles); the sprite stops when let go',
    (animal) => {
      for (const level of [1, 2, 3] as const) {
        let s = game(animal, { level });
        expect(s.ice).toBe(false);
        for (let k = 0; k < 600 && !s.over; k++) {
          const steer = Math.floor(k / 30) % 2 === 0 ? RIGHT : STILL;
          const before = s;
          s = step(s, DT, steer);
          const oily = s.parts.some((p) => p.kind === 'oil');
          if (!oily) expect(onIce(s)).toBe(false);
          // Let go off the ice: it doesn't move on its own (apart from a gust's push).
          const pushed = s.parts.some((p) => p.kind === 'gust');
          if (steer === STILL && !oily && !pushed && !onIce(before)) {
            expect(s.vel).toEqual({ x: 0, y: 0 });
          }
        }
      }
    },
  );
});
