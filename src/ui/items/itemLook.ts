/**
 * How each item type looks on its card (docs/mockups/ItemCard.dc.html): the
 * accent color, the counter and its pip shape, and the tier numeral's colors.
 */
import type { ItemType } from '../../engine';
import type { IconName } from '../icons/paths';

export interface TypeLook {
  label: string;
  accent: string;
  /** The counter on the bottom right, and how its pips look. */
  count: 'USES' | 'DURABILITY' | 'BITES' | 'NIGHTS' | null;
  shape: 'square' | 'bar' | 'circle';
}

export const TYPE_LOOK: Record<ItemType, TypeLook> = {
  tool: { label: 'Tool', accent: '#F2A65A', count: 'USES', shape: 'square' },
  clothes: { label: 'Clothes', accent: '#E6B389', count: 'DURABILITY', shape: 'bar' },
  food: { label: 'Food', accent: '#C7DA7B', count: 'BITES', shape: 'circle' },
  shelter: { label: 'Shelter', accent: '#83C4ED', count: 'NIGHTS', shape: 'square' },
  trinket: { label: 'Trinket', accent: '#E2A9F1', count: null, shape: 'square' },
};

/** Each item type's icon (type tabs, blueprints). */
export const TYPE_ICON: Record<ItemType, IconName> = {
  tool: 'hammer',
  clothes: 'shirt',
  food: 'utensils',
  shelter: 'tent',
  trinket: 'sparkles',
};

/** Tier numerals: Tier I shows none; II silver, III gold, IV prismatic (Luck only). */
export const TIER_LOOK: Record<number, { numeral: string; fill: string } | null> = {
  1: null,
  2: { numeral: 'II', fill: 'linear-gradient(160deg, #F1F5F8, #9AA8B4)' },
  3: { numeral: 'III', fill: 'linear-gradient(160deg, #FFE08A, #D79A1E)' },
  4: { numeral: 'IV', fill: 'linear-gradient(160deg, #7FD3E6, #CDA6EE, #F0875A)' },
};

export const SLOT_NAME = { gear: 'Gear', body: 'Body', feet: 'Feet' } as const;
