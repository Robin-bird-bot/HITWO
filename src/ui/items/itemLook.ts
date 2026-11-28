/**
 * How each item type looks: its accent color (type tabs, shop badges), and
 * on the TrailMate item cards (docs/design/31-trailmate-item-cards.md,
 * section 4) its shell colors, bright color, icon and counter word.
 */
import { ASSETS } from '../../config/assets';
import type { ItemDef, ItemType } from '../../engine';
import type { IconName } from '../icons/paths';

export interface TypeLook {
  label: string;
  accent: string;
  /** The counter on the bottom right (31, section 2). */
  count: 'USES' | 'DURABILITY' | 'BITES' | 'SIPS' | 'SET UPS' | null;
  shape: 'square' | 'bar' | 'circle';
}

/** A drink (29-core-loop.md, section 3): food that says DRINK and counts SIPS. */
export const DRINK_LOOK: TypeLook = {
  label: 'Drink',
  accent: '#8BE6DD',
  count: 'SIPS',
  shape: 'circle',
};

export const TYPE_LOOK: Record<ItemType, TypeLook> = {
  tool: { label: 'Tool', accent: '#F2A65A', count: 'USES', shape: 'square' },
  clothes: { label: 'Clothes', accent: '#E6B389', count: 'DURABILITY', shape: 'bar' },
  food: { label: 'Food', accent: '#C7DA7B', count: 'BITES', shape: 'circle' },
  shelter: { label: 'Shelter', accent: '#83C4ED', count: 'SET UPS', shape: 'square' },
  trinket: { label: 'Trinket', accent: '#E2A9F1', count: null, shape: 'square' },
  present: { label: 'Present', accent: '#F2867A', count: null, shape: 'square' },
};

/** Each item type's icon (type tabs, blueprints). */
export const TYPE_ICON: Record<ItemType, IconName> = {
  tool: 'hammer',
  clothes: 'shirt',
  food: 'utensils',
  shelter: 'tent',
  trinket: 'sparkles',
  present: 'package',
};

/** Tier numerals: Tier I shows none; II silver, III gold, IV prismatic (Luck only). */
export const TIER_LOOK: Record<number, { numeral: string; fill: string } | null> = {
  1: null,
  2: { numeral: 'II', fill: 'linear-gradient(160deg, #F1F5F8, #9AA8B4)' },
  3: { numeral: 'III', fill: 'linear-gradient(160deg, #FFE08A, #D79A1E)' },
  4: { numeral: 'IV', fill: 'linear-gradient(160deg, #7FD3E6, #CDA6EE, #F0875A)' },
};

export const SLOT_NAME = { gear: 'Gear', body: 'Body', feet: 'Feet' } as const;

/** A TrailMate card's colors (31, section 4): the shell's light and dark, and the bright one. */
export interface DeviceColors {
  light: string;
  dark: string;
  bright: string;
}

export const DEVICE_COLORS: Readonly<Record<ItemType | 'drink', DeviceColors>> = {
  tool: { light: '#F6BA55', dark: '#E0642E', bright: '#FF9F1C' },
  food: { light: '#86D594', dark: '#3A8A5A', bright: '#8BE04E' },
  drink: { light: '#8BE6DD', dark: '#2C9A93', bright: '#3FE0D0' },
  clothes: { light: '#DDA470', dark: '#8A5636', bright: '#FFB37A' },
  shelter: { light: '#A3D3F3', dark: '#5468A0', bright: '#4FC3F7' },
  // Claude's pick (not on the board).
  trinket: { light: '#E2A9F1', dark: '#9A3F64', bright: '#D675EF' },
  // Presents keep their wrapping; the shell is holiday red (Claude's pick).
  present: { light: '#F2867A', dark: '#A8233A', bright: '#FFD27A' },
};

/** An item card's look: its words, colors and icon (a drink is food that looks like a drink). */
export function deviceLook(
  def: Pick<ItemDef, 'type' | 'drink'>,
): TypeLook & DeviceColors & { kind: ItemType | 'drink'; icon: string | null } {
  const kind = def.drink ? 'drink' : def.type;
  const look = def.drink ? DRINK_LOOK : TYPE_LOOK[def.type];
  return {
    ...look,
    ...DEVICE_COLORS[kind],
    kind,
    icon:
      kind === 'drink'
        ? ASSETS.itemCards.drinkIcon
        : kind === 'present'
          ? null
          : ASSETS.itemCards.typeIcons[kind],
  };
}
