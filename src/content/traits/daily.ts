/**
 * Traits that change each morning (Nov 20 update): what each can become.
 * Quirky becomes a random Tier I Utility trait, Zany a Utility trait of any
 * tier, Nosework a node type, and Moody gives 1 of 6 conditions for the day.
 */
import type { TraitDef } from '../../engine/effects';
import { NODE_TYPES } from '../../engine/types';
import { TRAIT_LIST } from './index';

/** Moody's set: 3 positive and 3 negative conditions (02-traits-and-conditions.md). */
export const MOODY_CONDITIONS = [
  'inspired',
  'lucky',
  'energized',
  'bored',
  'unlucky',
  'dejected',
] as const;

/**
 * What a daily trait can become today. Quirky and Zany draw from the open
 * Utility traits; ones that need a setting, or that change daily themselves,
 * are left out. TODO(wyatt): first guess at which Utility traits they can become.
 */
export function dailyPicks(def: TraitDef): string[] {
  switch (def.daily) {
    case 'trait':
      return TRAIT_LIST.filter(
        (t) =>
          t.type === 'U' &&
          (t.kind ?? 'normal') === 'normal' &&
          !t.setting &&
          !t.daily &&
          t.tier !== null &&
          (def.dailyTiers ?? [1, 2, 3]).includes(t.tier),
      ).map((t) => t.id);
    case 'node':
      return [...NODE_TYPES];
    case 'condition':
      return [...MOODY_CONDITIONS];
    default:
      return [];
  }
}
