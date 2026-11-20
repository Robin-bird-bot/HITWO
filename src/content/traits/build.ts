/**
 * Small helpers for writing traits as data (docs/design/02-traits-and-conditions.md
 * and 07-characters.md). Each trait's effect plugs into the engine's hooks;
 * the engine never checks for a trait by name.
 */
import type { TraitDef } from '../../engine/effects';
import type { Family, NodeType, TraitSetting } from '../../engine/types';

type Rest = Omit<TraitDef, 'id' | 'name' | 'type' | 'tier' | 'text'>;

/** A Trail trait (yellow). Special and unique ones have no tier. */
export const trail = (
  tier: TraitDef['tier'],
  id: string,
  name: string,
  text: string,
  rest: Rest = {},
): TraitDef => ({ id, name, type: 'T', tier, text, ...rest });

/** A Utility trait (green). */
export const utility = (
  tier: TraitDef['tier'],
  id: string,
  name: string,
  text: string,
  rest: Rest = {},
): TraitDef => ({ id, name, type: 'U', tier, text, ...rest });

/** A Morale trait (purple). Morale traits have no tier and are always on. */
export const morale = (id: string, name: string, text: string, rest: Rest = {}): TraitDef => ({
  id,
  name,
  type: 'M',
  tier: null,
  text,
  ...rest,
});

/** Who the family traits are for: "Pets" are Dogs and Cats (Plush hikers aren't real pets). */
export const PETS: readonly Family[] = ['dog', 'cat'];

/** The characters a special or unique trait belongs to (07-characters.md ids). */
export const special = (...owners: string[]): Rest => ({ kind: 'special', owners });
export const unique = (...owners: string[]): Rest => ({ kind: 'unique', owners });
export const family = (...who: Family[]): Rest => ({ kind: 'family', who });

/** What each node is called in text, and in the four "[Node]" trait names. */
export const NODE_WORD: Readonly<Record<NodeType, string>> = {
  forest: 'Forest',
  river: 'River',
  wildlife: 'Wildlife',
  mountain: 'Mountain',
};

export const isNode = (x: string | undefined): x is NodeType =>
  x === 'forest' || x === 'river' || x === 'wildlife' || x === 'mountain';

/** The node a "[Node]" trait is set to, if any. */
export const nodeOf = (setting: TraitSetting): NodeType | undefined =>
  isNode(setting.x) ? setting.x : undefined;

/** Actions a trait can be set to (Action [X/Y], Traveler [X]). */
export const TRAIT_ACTIONS = [
  'move',
  'scavenge',
  'craft',
  'tend',
  'eat',
  'sleep',
  'watch',
] as const;
export type TraitAction = (typeof TRAIT_ACTIONS)[number];

/** "crafting", "Tending": how an action reads in a trait's text. */
export const ACTION_WORD: Readonly<Record<TraitAction, string>> = {
  move: 'moving',
  scavenge: 'scavenging',
  craft: 'crafting',
  tend: 'Tending',
  eat: 'eating',
  sleep: 'sleeping',
  watch: 'keeping watch',
};

/** "Tend" or "crafting", for a name in brackets: Traveler (Tend), Action (crafting). */
export const ACTION_NAME: Readonly<Record<TraitAction, string>> = {
  move: 'Move',
  scavenge: 'Scavenge',
  craft: 'Craft',
  tend: 'Tend',
  eat: 'Eat',
  sleep: 'Sleep',
  watch: 'Keep Watch',
};

export const isTraitAction = (x: string | undefined): x is TraitAction =>
  (TRAIT_ACTIONS as readonly string[]).includes(x ?? '');
