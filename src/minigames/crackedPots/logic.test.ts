/**
 * Cracked Pots (docs/design/24-challenges-reset.md, section 7).
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { TIERS } from '../types';
import { crackedPotsBot } from './bot';
import {
  cutPot,
  drop,
  newCrackedPots,
  placedOf,
  result,
  tick,
  type CrackedPotsState,
} from './logic';
import { POT_MASKS } from './masks';

const C = BALANCE.minigames.crackedPots;
const FOUR = ['finn', 'mom', 'ellie', 'wyatt'];
const THREE = ['finn', 'mom', 'ellie'];

/** Every shard of a pot dropped right in its spot. */
const finishPot = (s0: CrackedPotsState, pot: number): CrackedPotsState =>
  s0.shards.filter((x) => x.pot === pot).reduce((s, x) => drop(s, x.id, x.home), s0);

describe('the shards', () => {
  it.each(TIERS)(
    'Tier %i: each pot breaks into its shards, every pixel in one, each shard one piece',
    (tier) => {
      for (const [k, mask] of POT_MASKS.entries()) {
        const n = C.tiers[tier].shards;
        const map = cutPot(mask, n, seedRng(tier * 10 + k));
        const ids = new Set(map.filter((v) => v >= 0));
        expect(ids.size).toBe(n);
        // Every pot pixel has a shard; nothing outside does.
        mask.rows.forEach((spans, y) => {
          for (let x = 0; x < mask.width; x++) {
            const inside = spans.some(([a, b]) => x >= a && x < b);
            expect(map[y * mask.width + x]! >= 0).toBe(inside);
          }
        });
        // Each shard is connected (one piece).
        for (const id of ids) {
          const cells = map.flatMap((v, i) => (v === id ? [i] : []));
          const seen = new Set([cells[0]!]);
          const stack = [cells[0]!];
          while (stack.length) {
            const c = stack.pop()!;
            for (const j of [c - 1, c + 1, c - mask.width, c + mask.width]) {
              if (j < 0 || j >= map.length || map[j] !== id || seen.has(j)) continue;
              if (
                (j === c - 1 || j === c + 1) &&
                Math.floor(j / mask.width) !== Math.floor(c / mask.width)
              )
                continue;
              seen.add(j);
              stack.push(j);
            }
          }
          expect(seen.size).toBe(cells.length);
        }
      }
    },
  );

  it('every shard is different (a real break), and the same seed breaks it the same way', () => {
    const a = cutPot(POT_MASKS[0]!, 8, seedRng(3));
    const b = cutPot(POT_MASKS[0]!, 8, seedRng(3));
    expect(a).toEqual(b);
    const s = newCrackedPots({ tier: 2 }, THREE, 4);
    const shapes = new Set(s.shards.map((x) => `${x.w}x${x.h}:${x.cells}`));
    expect(shapes.size).toBe(s.shards.length);
  });
});

describe('Cracked Pots', () => {
  it('pairs share one blanket of both pots’ shards, mixed; each hiker has their own pot', () => {
    const s = newCrackedPots({ tier: 1 }, FOUR, 1);
    expect(s.rounds).toEqual([
      ['finn', 'mom'],
      ['ellie', 'wyatt'],
    ]);
    expect(s.pots.map((p) => p.owner)).toEqual(['finn', 'mom']);
    expect(s.shards).toHaveLength(2 * C.tiers[1].shards);
    // On the blanket.
    const b = C.blanket;
    for (const x of s.shards) {
      expect(x.at.x).toBeGreaterThanOrEqual(b.left - 1e-9);
      expect(x.at.y).toBeGreaterThanOrEqual(b.top - 1e-9);
      expect(x.placed).toBe(false);
    }
    // Mixed: not one pot's shards, then the other's.
    const order = [...s.shards]
      .sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x)
      .map((x) => x.pot);
    expect(order.slice(0, C.tiers[1].shards)).not.toEqual(Array(C.tiers[1].shards).fill(0));
  });

  it('a shard snaps in within [6] of its spot and locks; anywhere else it goes back to the blanket', () => {
    let s = newCrackedPots({ tier: 2 }, THREE, 2);
    const x = s.shards[0]!;
    s = drop(s, x.id, { x: x.home.x + 20, y: x.home.y });
    expect(s.shards[0]!.placed).toBe(false);
    expect(s.shards[0]!.at).toEqual(x.spot);
    const before = s.timeLeft;
    s = drop(s, x.id, { x: x.home.x + 4, y: x.home.y - 3 });
    expect(s.shards[0]!.placed).toBe(true);
    expect(s.shards[0]!.at).toEqual(x.home);
    expect(s.timeLeft).toBeCloseTo(before + C.tiers[2].snapSec, 9);
    // Locked: dropping it again does nothing.
    expect(drop(s, x.id, { x: 0, y: 0 })).toBe(s);
  });

  it('a whole pot passes its hiker; the clock is seconds per shard × the round’s shards', () => {
    let s = newCrackedPots({ tier: 3 }, THREE, 5);
    expect(s.timeSec).toBeCloseTo(C.tiers[3].secPerShard * s.shards.length, 9);
    s = finishPot(s, 1);
    expect(s.results.mom).toBe('passed');
    expect(placedOf(s, 'mom')).toBe(C.tiers[3].shards);
    // Time runs out: Finn's pot isn't whole.
    for (let k = 0; k < 10000 && s.round === 0; k++) s = tick(s, 0.1);
    expect(s.results.finn).toBe('failed');
    // Then Ellie plays alone.
    expect(s.pots.map((p) => p.owner)).toEqual(['ellie']);
    s = finishPot(s, 0);
    for (let k = 0; k < 100 && !s.over; k++) s = tick(s, 0.1);
    expect(s.over).toBe(true);
    expect(result(s).safe.sort()).toEqual(['ellie', 'mom']);
  });

  it('faint crack lines at Tier I only (the testing setting can turn them on or off)', () => {
    expect(newCrackedPots({ tier: 1 }, THREE, 1).cracks).toBe(true);
    expect(newCrackedPots({ tier: 2 }, THREE, 1).cracks).toBe(false);
    expect(newCrackedPots({ tier: 3, cracks: 'on' }, THREE, 1).cracks).toBe(true);
  });

  it('Prepare: FOOD adds [10] s; GLUE puts a shard of each pot in place', () => {
    const plain = newCrackedPots({ tier: 2 }, THREE, 1);
    const food = newCrackedPots({ tier: 2, extraSec: C.extraSec }, THREE, 1);
    expect(food.timeSec - plain.timeSec).toBe(C.extraSec);
    const glue = newCrackedPots({ tier: 2, glued: 1 }, THREE, 1);
    expect(glue.shards.filter((x) => x.placed && x.pot === 0)).toHaveLength(1);
    expect(glue.shards.filter((x) => x.placed && x.pot === 1)).toHaveLength(1);
  });

  it('the demo bot puts pots together', () => {
    let s = newCrackedPots({ tier: 1 }, ['finn', 'mom'], 3);
    const mem: Record<string, unknown> = {};
    const rng = seedRng(7);
    for (let t = 0; t < 120 && s.round === 0 && s.phase === 'play'; t += 0.05) {
      const a = crackedPotsBot(s, mem, rng, t);
      if (a) s = drop(s, a.id, a.at);
      s = tick(s, 0.05);
    }
    expect(s.pots.filter((p) => p.done).length).toBeGreaterThanOrEqual(1);
  });
});
