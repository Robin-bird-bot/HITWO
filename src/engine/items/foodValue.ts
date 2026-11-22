/**
 * How much Appetite a food gives over all its bites (Phase 10.6): for tuning
 * toward "one scavenge plus one craft feeds about 3 actions". A plain
 * estimate: every chance roll misses, a random range gives its middle, and
 * it's eaten by a human in the daytime.
 */
import type { EatContext, ItemDef } from '../effects';
import type { Hiker } from '../types';
import { valueAt, type Quality } from './quality';

export function foodAppetiteEstimate(def: ItemDef, quality: Quality): number {
  if (def.type !== 'food' || !def.onEat) return 0;
  const bites = Math.max(1, valueAt(def.bites ?? 1, quality));
  let total = 0;
  for (let left = bites; left >= 1; left--) {
    const e: EatContext = {
      hiker: { family: 'human' } as Hiker,
      v: (key) => valueAt(def.values?.[key], quality),
      bitesLeft: left,
      firstBite: left === bites,
      night: false,
      appetite: (n) => {
        total += Math.max(0, n);
      },
      stat: () => {},
      condition: () => {},
      chance: () => false,
      rollY: (lo, hi) => (lo + hi) / 2,
      randomPositive: () => {},
      randomNegative: () => {},
      cureRandomNegative: () => {},
      otherFood: () => [],
      keepBite: () => {},
    };
    def.onEat(e);
  }
  return total;
}
