/**
 * Every item (docs/design/03-items.md), by type, as typed data. Suggested
 * items without art aren't built (Wyatt, Nov 7).
 */
import type { ItemDef, ItemType } from '../../engine/effects';
import { CLOTHES } from './clothes';
import { FOOD } from './food';
import { TIER_3_STAND_INS, TO_PLACE } from './others';
import { SHELTERS } from './shelters';
import { TOOLS } from './tools';
import { TRINKETS } from './trinkets';

const ALL: readonly ItemDef[] = [
  ...TOOLS,
  ...CLOTHES,
  ...FOOD,
  ...SHELTERS,
  ...TRINKETS,
  ...TO_PLACE,
  ...TIER_3_STAND_INS,
];

export const ITEMS: Readonly<Record<string, ItemDef>> = Object.fromEntries(
  ALL.map((i) => [i.id, i]),
);

/** Every item in 03-items.md's tables, in the doc's order (for the debug gallery). */
export const TABLE_ITEMS: readonly ItemDef[] = [
  ...TOOLS,
  ...CLOTHES,
  ...FOOD,
  ...SHELTERS,
  ...TRINKETS,
];

export const TIER_3_ITEMS: readonly string[] = TIER_3_STAND_INS.map((i) => i.id);

/**
 * Items scavenging can find, by type, at a tier (1 for the Meadow). Never the
 * ones only from events (Puked Nuggets) or still to place.
 */
export function findableItems(type: ItemType, tier: number = 1): ItemDef[] {
  return TABLE_ITEMS.filter((i) => i.type === type && !i.notFound && i.tier === tier);
}

/** Items a basic recipe can deal at exactly this tier: never "Not crafted" ones. */
export function craftableItems(type: ItemType, tier: number): ItemDef[] {
  return TABLE_ITEMS.filter((i) => i.type === type && !i.notCrafted && i.tier === tier);
}

/**
 * Old item ids from before the Nov 7 item list, and what they became
 * (03-items.md, "Older items, merged or replaced"). Saves are upgraded with it.
 */
export const RENAMED_ITEMS: Readonly<Record<string, string>> = {
  medicine: 'bandaid',
  splint: 'crutches',
  safetyVest: 'hardhat',
  helmet: 'hardhat',
  // The old Camera was clothes (XP when others gain XP); the new one is a tool.
  camera: 'vrHeadset',
  bundle: 'resourcePack',
};
