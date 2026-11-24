/**
 * Every trait (docs/design/02-traits-and-conditions.md and 07-characters.md)
 * as data. Each one plugs into engine hooks; the engine never checks for a
 * trait by name. Phase 10a builds their effects step by step.
 */
import type { TraitDef } from '../../engine/effects';
import { FAMILY_TRAITS } from './family';
import { HOLIDAY_TRAITS } from './holiday';
import { MORALE_TRAITS } from './morale';
import { SPECIAL_TRAITS } from './special';
import { TRAIL_TRAITS } from './trail';
import { UTILITY_TRAITS } from './utility';
import { TREE_TRAITS } from '../trails/traits';

export const TRAIT_LIST: readonly TraitDef[] = [
  ...TRAIL_TRAITS,
  ...UTILITY_TRAITS,
  ...MORALE_TRAITS,
  ...FAMILY_TRAITS,
  ...SPECIAL_TRAITS,
  ...HOLIDAY_TRAITS,
  ...TREE_TRAITS,
];

export const TRAITS: Readonly<Record<string, TraitDef>> = Object.fromEntries(
  TRAIT_LIST.map((t) => [t.id, t]),
);

/** A usable trait: needs the player to choose to use it (a button in the Abilities panel). */
export const isUsable = (def: TraitDef): boolean => !!def.ability;

export { NODE_WORD, TRAIT_ACTIONS, ACTION_WORD, ACTION_NAME, type TraitAction } from './build';
