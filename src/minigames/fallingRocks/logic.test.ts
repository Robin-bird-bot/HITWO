/**
 * Falling Rocks (docs/design/23-minigames-final.md, sections 2 and 13):
 * nothing hits a hiker under an overhang; every shadow shows at least the
 * tier's warning before its rock lands. And walking, lives, boulders,
 * reaching the end, Prepare, and the bot.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { TIERS } from '../types';
import { fallingRocksBot } from './bot';
import {
  newFallingRocks,
  result,
  setDir,
  tick,
  underOverhang,
  walker,
  type FallingRocksState,
} from './logic';

const F = BALANCE.minigames.fallingRocks;
const DT = 1 / 120;
const THREE = ['finn', 'mom', 'ellie'];

const ready = (s: FallingRocksState) => tick(s, BALANCE.minigames.quick.handoffSec + DT);

describe('the trail', () => {
  it('walks right at [40] and backs up at [30]; reaching the right end passes', () => {
    let s = ready(newFallingRocks({ tier: 1 }, ['finn'], 1));
    s = setDir({ ...s, nextAt: 999 }, 1);
    const x0 = s.x;
    for (let k = 0; k < 120; k++) s = tick(s, DT);
    expect(s.x - x0).toBeCloseTo(F.walk, 0);
    s = setDir(s, -1);
    const x1 = s.x;
    for (let k = 0; k < 120; k++) s = tick(s, DT);
    expect(x1 - s.x).toBeCloseTo(F.back, 0);
    s = setDir({ ...s, nextAt: 999 }, 1);
    for (let k = 0; k < 120 * 10 && !s.over; k++) s = tick({ ...s, nextAt: 999 }, DT);
    expect(s.turns.done.finn).toBe(true);
  });
});

describe('hazards', () => {
  it.each(TIERS)(
    'Tier %i: every shadow shows at least the tier’s warning before its rock lands',
    (tier) => {
      let s = ready(newFallingRocks({ tier }, THREE, tier * 7));
      const seen = new Map<number, { warnAt: number; landAt: number }>();
      for (let k = 0; k < 120 * 40 && !s.over; k++) {
        s = tick(setDir(s, 1), DT);
        for (const h of s.hazards) if (h.kind === 'rock') seen.set(h.id, h);
      }
      expect(seen.size).toBeGreaterThan(5);
      for (const r of seen.values()) {
        expect(r.landAt - r.warnAt).toBeGreaterThanOrEqual(F.tiers[tier].warnSec - 1e-9);
      }
    },
  );

  it.each(TIERS)('Tier %i: nothing hits a hiker under an overhang', (tier) => {
    for (const o of F.overhangs) {
      let s = ready(newFallingRocks({ tier, boulders: 'on' }, ['finn'], tier + o.x));
      s = { ...s, x: o.x, dir: 0 };
      const lives = s.lives.finn;
      for (let k = 0; k < 120 * 30; k++) {
        s = tick(s, DT);
        // Aim everything right at the hiker.
        s = { ...s, hazards: s.hazards.map((h) => (h.kind === 'rock' ? { ...h, x: o.x } : h)) };
      }
      expect(underOverhang(s.x)).toBe(true);
      expect(s.lives.finn).toBe(lives);
    }
  });

  it('a rock that lands on the hiker costs a life, then a moment of safety', () => {
    let s = ready(newFallingRocks({ tier: 1 }, ['finn', 'mom'], 3));
    s = {
      ...s,
      x: 40,
      nextAt: 999,
      hazards: [{ kind: 'rock', id: 1, x: 40, size: 'm', warnAt: s.time, landAt: s.time + 0.1 }],
    };
    for (let k = 0; k < 30; k++) s = tick(s, DT);
    expect(s.lives.finn).toBe(F.lives - 1);
    expect(s.safeUntil).toBeGreaterThan(s.time);
    expect(s.lastHit?.by).toBe('rock');
  });

  it('a boulder rolls the whole trail: it hits anywhere but under an overhang', () => {
    let s = ready(newFallingRocks({ tier: 3 }, ['finn'], 5));
    s = {
      ...s,
      x: 150,
      nextAt: 999,
      hazards: [{ kind: 'boulder', id: 1, dir: 1, warnAt: s.time, rollAt: s.time, speed: 70 }],
    };
    for (let k = 0; k < 120 * 6; k++) s = tick(s, DT);
    expect(s.lives.finn).toBe(F.lives - 1);
    expect(s.lastHit?.by).toBe('boulder');
  });

  it('out of lives: that hiker fails with the stake, and the next starts at the left', () => {
    let s = ready(newFallingRocks({ tier: 2, lives: 1 }, ['finn', 'mom'], 8));
    s = {
      ...s,
      x: 60,
      nextAt: 999,
      hazards: [{ kind: 'rock', id: 1, x: 60, size: 'l', warnAt: s.time, landAt: s.time + 0.05 }],
    };
    for (let k = 0; k < 30; k++) s = tick(s, DT);
    expect(s.out).toEqual(['finn']);
    expect(walker(s)).toBe('mom');
    expect(s.x).toBe(0);
    const r = result({ ...s, over: true });
    expect(r.pays?.finn).toMatchObject({ conditions: [F.stake] });
  });
});

describe('Prepare and the settings', () => {
  it('+1 life for a hiker, Binoculars add warning, slower rocks; boulders follow the setting', () => {
    const s = newFallingRocks(
      { tier: 4, extraLives: { mom: 1 }, extraWarnSec: F.binocularsSec, slower: 0.1 },
      THREE,
      1,
    );
    expect(s.lives).toEqual({ finn: F.lives, mom: F.lives + 1, ellie: F.lives });
    expect(s.warnSec).toBeCloseTo(F.tiers[4].warnSec * 1.1 + F.binocularsSec);
    expect(newFallingRocks({ tier: 1, boulders: 'on' }, THREE, 1).boulders).toBe(true);
    expect(newFallingRocks({ tier: 5, boulders: 'off' }, THREE, 1).boulders).toBe(false);
    expect(newFallingRocks({ tier: 2 }, THREE, 1).boulders).toBe(false);
    expect(newFallingRocks({ tier: 3 }, THREE, 1).boulders).toBe(true);
  });
});

describe('the demo bot', () => {
  it('gets hikers across at Tier I most of the time', () => {
    let across = 0;
    for (let seed = 1; seed <= 10; seed++) {
      let s = ready(newFallingRocks({ tier: 1 }, ['finn'], seed));
      const mem: Record<string, unknown> = {};
      const rng = seedRng(seed);
      for (let k = 0; k < 120 * 60 && !s.over; k++) {
        const d = fallingRocksBot(s, mem, rng, s.time);
        if (d !== null) s = setDir(s, d);
        s = tick(s, DT);
      }
      if (s.turns.done.finn) across++;
    }
    expect(across).toBeGreaterThanOrEqual(6);
  });
});
