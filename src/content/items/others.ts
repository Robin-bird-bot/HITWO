/**
 * Items that aren't in 03-items.md's tables yet: the ones "still to place",
 * and the Tier III stand-ins for the Wonder and Snake Slots rewards. They do
 * nothing, and scavenging and crafting never give them.
 */
import type { ItemDef } from '../../engine/effects';
import { item } from './build';

/** An item from "Still to place" (03-items.md), inert until Wyatt places it. */
const toPlace = (
  id: string,
  name: string,
  type: ItemDef['type'],
  text: string,
  slot?: ItemDef['slot'],
): ItemDef =>
  item({
    id,
    name,
    type,
    tier: 1,
    text,
    ...(slot ? { slot } : {}),
    art: null,
    notCrafted: true,
    notFound: true,
    placeholder: true,
  });

export const TO_PLACE: readonly ItemDef[] = [
  toPlace(
    'metalDetector',
    'Metal Detector',
    'clothes',
    'More Item find cards when scavenging.',
    'gear',
  ),
  toPlace(
    'carrierPack',
    'Carrier Pack',
    'clothes',
    'Carrying a passed-out hiker costs no extra Appetite.',
    'gear',
  ),
  toPlace(
    'leash',
    'Leash',
    'clothes',
    'Move All costs 1 less Appetite when it includes a Human.',
    'gear',
  ),
  toPlace('magnifyingGlass', 'Magnifying Glass', 'tool', 'More Choice cards when scavenging.'),
  toPlace('phone', 'Phone', 'tool', 'Several uses: Uber Eats (a food), Call, Maps (reveal tiles).'),
];

/**
 * Tier III stand-ins for a Wonder's "pick 1 of 3" and Snake Slots' jackpot.
 * TODO(phase 8): the real Tier III items (step 9).
 */
export const TIER_3_STAND_INS: readonly ItemDef[] = [
  toPlace('tier3Tool', 'Tier III Tool', 'tool', 'A top-tier tool (placeholder).'),
  toPlace('tier3Clothes', 'Tier III Clothes', 'clothes', 'Top-tier clothes (placeholder).', 'body'),
  toPlace('tier3Trinket', 'Lucky Charm', 'trinket', 'A top-tier trinket (placeholder).'),
].map((d) => ({ ...d, tier: 3 as const }));
