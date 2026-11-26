/**
 * Fly Block (docs/design/23-minigames-final.md, sections 3 and 13): a fly
 * is blocked only at the swatter's panel; a zig-zag fly changes lanes
 * once; a bee blocked is a bite, and a bee that gets through isn't. And
 * horseflies, the bite limit, rounds, Prepare, and the bot.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { TIERS } from '../types';
import { flyBlockBot, stepToward } from './bot';
import {
  bitesLeft,
  move,
  newFlyBlock,
  result,
  swatting,
  tick,
  type Fly,
  type FlyBlockState,
} from './logic';

const FB = BALANCE.minigames.flyBlock;
const DT = 1 / 120;

const ready = (s: FlyBlockState) => tick(s, BALANCE.minigames.quick.handoffSec + DT);

/** One fly (or bee) about to reach the ring, nothing else coming. */
function withOne(s: FlyBlockState, f: Partial<Fly> & Pick<Fly, 'kind' | 'lane'>): FlyBlockState {
  return {
    ...s,
    sent: 0,
    total: 99,
    nextAt: 999,
    flies: [{ id: 1, dist: 2, speed: 40, hp: f.kind === 'horse' ? 2 : 1, ...f }],
  };
}
const run = (s: FlyBlockState, sec: number) => {
  let out = s;
  for (let t = 0; t < sec; t += DT) out = tick(out, DT);
  return out;
};

describe('the ring', () => {
  it('a fly is blocked only at the swatter’s panel: anywhere else it’s a bite', () => {
    const s = ready(newFlyBlock({ tier: 1 }, ['finn'], 1));
    for (let lane = 0; lane < s.panels; lane++) {
      const out = run(withOne(s, { kind: 'fly', lane }), 0.2);
      if (lane === s.at) {
        expect(out.bites).toBe(0);
        expect(out.last?.kind).toBe('swat');
      } else {
        expect(out.bites).toBe(1);
        expect(out.last?.kind).toBe('bite');
      }
    }
  });

  it('the swatter moves one panel at a time, all the way round', () => {
    let s = ready(newFlyBlock({ tier: 1 }, ['finn'], 1));
    s = move(s, 1);
    expect(s.at).toBe(1);
    s = move(move(s, -1), -1);
    expect(s.at).toBe(s.panels - 1);
    expect(stepToward(0, 7, 8)).toBe(-1);
    expect(stepToward(0, 3, 8)).toBe(1);
  });

  it('a zig-zag fly changes lanes once', () => {
    for (let seed = 1; seed <= 40; seed++) {
      let s = ready(newFlyBlock({ tier: 3 }, ['finn'], seed));
      const lanes = new Map<number, Set<number>>();
      for (let k = 0; k < 120 * 30 && !s.over; k++) {
        s = tick(s, DT);
        for (const f of s.flies) {
          if (f.kind !== 'zig') continue;
          if (!lanes.has(f.id)) lanes.set(f.id, new Set());
          lanes.get(f.id)!.add(f.lane);
        }
      }
      for (const seen of lanes.values()) expect(seen.size).toBeLessThanOrEqual(2);
    }
  });

  it('a bee blocked is a bite (a sting); a bee that gets through isn’t', () => {
    const s = ready(newFlyBlock({ tier: 3 }, ['finn'], 1));
    const stung = run(withOne(s, { kind: 'bee', lane: s.at }), 0.2);
    expect(stung.bites).toBe(1);
    expect(stung.last?.kind).toBe('sting');
    const passed = run(withOne(s, { kind: 'bee', lane: (s.at + 1) % s.panels }), 0.2);
    expect(passed.bites).toBe(0);
    expect(passed.last?.kind).toBe('pass');
  });

  it('a horsefly takes two swats: the first knocks it back', () => {
    const s = ready(newFlyBlock({ tier: 4 }, ['finn'], 1));
    let out = run(withOne(s, { kind: 'horse', lane: s.at }), 0.2);
    expect(out.last?.kind).toBe('knock');
    expect(out.flies[0]?.dist).toBeGreaterThan(FB.horse.knockBack - 10);
    out = run(out, 2);
    expect(out.last?.kind).toBe('swat');
    expect(out.bites).toBe(0);
  });
});

describe('rounds', () => {
  it('[3] bites and that hiker fails at once; the next hiker plays their own round', () => {
    let s = ready(newFlyBlock({ tier: 1 }, ['finn', 'mom'], 1));
    for (let k = 0; k < FB.bites; k++)
      s = run(withOne(s, { kind: 'fly', lane: (s.at + 1) % s.panels }), 0.2);
    expect(s.turns.done.finn).toBe(false);
    expect(swatting(s)).toBe('mom');
    expect(s.bites).toBe(0);
  });

  it.each(TIERS)('Tier %i: a perfect swatter passes everyone', (tier) => {
    let s = newFlyBlock({ tier }, ['finn', 'mom'], tier);
    for (let k = 0; k < 120 * 120 && !s.over; k++) {
      const next = s.flies.filter((f) => f.kind !== 'bee').sort((a, b) => a.dist - b.dist)[0];
      if (next) s = { ...s, at: next.lane };
      s = tick(s, DT);
    }
    expect(s.over).toBe(true);
    expect(result(s).safe.length).toBeGreaterThanOrEqual(1);
  });

  it('Prepare: +1 bite for a hiker, slower flies, fewer flies; the settings', () => {
    const s = newFlyBlock(
      { tier: 2, extraBites: { mom: 1 }, slower: 0.2, fewer: FB.smoke },
      ['finn', 'mom'],
      1,
    );
    expect(s.biteMax).toEqual({ finn: FB.bites, mom: FB.bites + 1 });
    expect(s.speedK).toBeCloseTo(0.8);
    expect(s.total).toBe(FB.tiers[2].flies - FB.smoke);
    expect(newFlyBlock({ tier: 1, panels: 14 }, ['finn'], 1).panels).toBe(14);
    expect(newFlyBlock({ tier: 1, bees: 'on' }, ['finn'], 1).bees).toBe(true);
    expect(newFlyBlock({ tier: 5, bees: 'off' }, ['finn'], 1).bees).toBe(false);
    expect(bitesLeft(ready(s))).toBe(FB.bites);
  });
});

describe('the demo bot', () => {
  it('passes Tier I most of the time', () => {
    let passed = 0;
    for (let seed = 1; seed <= 8; seed++) {
      let s = ready(newFlyBlock({ tier: 1 }, ['finn'], seed));
      const mem: Record<string, unknown> = {};
      const rng = seedRng(seed);
      for (let k = 0; k < 120 * 60 && !s.over; k++) {
        const d = flyBlockBot(s, mem, rng, s.time);
        if (d !== null) s = move(s, d);
        s = tick(s, DT);
      }
      if (s.turns.done.finn) passed++;
    }
    expect(passed).toBeGreaterThanOrEqual(5);
  });
});
