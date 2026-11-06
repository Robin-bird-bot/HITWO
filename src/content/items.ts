/**
 * Items as typed data. Phase 9 builds their effects. Until then:
 * - a placeholder Backpack shows how slots added by an item look in the bag;
 * - the items named in docs/design/03-items.md exist so scavenging can find
 *   them, but they do nothing yet (Wyatt, Nov 4).
 */
import type { ItemDef } from '../engine/effects';

const backpack: ItemDef = {
  id: 'backpack',
  name: 'Backpack',
  type: 'clothes',
  slot: 'gear',
  tier: 1,
  text: '+2 bag slots.',
  placeholder: true, // TODO(wyatt): stand-in until Phase 9's item list.
  hooks: {
    modifyCapacity(q) {
      return q.key === 'bag.slots' ? { source: 'Backpack', flat: 2 } : undefined;
    },
  },
};

/**
 * An item from docs/design/03-items.md, with its exact wording, that does
 * nothing until Phase 9. TODO(wyatt): every tier is a stand-in 1.
 */
function inert(
  id: string,
  name: string,
  type: ItemDef['type'],
  text: string,
  slot?: ItemDef['slot'],
): ItemDef {
  return { id, name, type, tier: 1, text, ...(slot ? { slot } : {}), placeholder: true };
}

const NAMED: ItemDef[] = [
  // Clothes
  inert('thinkingCap', 'Thinking Cap', 'clothes', 'Extra XP from every source', 'gear'),
  inert('camera', 'Camera', 'clothes', 'Gains XP when other hikers on its tile gain XP', 'gear'),
  inert(
    'safetyVest',
    'Safety Vest',
    'clothes',
    'Prevents the next injury to this hiker, at the cost of durability',
    'body',
  ),
  inert(
    'helmet',
    'Helmet',
    'clothes',
    'Prevents the next injury to this hiker, at the cost of durability',
    'gear',
  ),
  inert(
    'metalDetector',
    'Metal Detector',
    'clothes',
    'Higher chance of Item find cards when scavenging',
    'gear',
  ),
  inert(
    'carrierPack',
    'Carrier Pack',
    'clothes',
    'Carrying a passed-out hiker costs no extra Appetite',
    'gear',
  ),
  inert(
    'leash',
    'Leash',
    'clothes',
    'Moving the group costs 1 less Appetite when it includes a Human',
    'gear',
  ),
  inert('harness', 'Harness', 'clothes', 'Effect to come', 'body'),
  inert('discoHarness', 'Disco Harness', 'clothes', 'Effect to come', 'body'),
  inert(
    'snackPack',
    'Snack Pack',
    'clothes',
    'Each phase, an (X)15% chance to gain 1 Appetite; each time it does, it loses 1 durability',
    'gear',
  ),
  inert(
    'trooperMask',
    'Trooper Mask',
    'clothes',
    'Ignores the extra costs of steep, muddy and rough trail lines; each time it does, it loses 1 durability',
    'gear',
  ),
  // Food (Puked Nuggets only come from Nugget Puker, so scavenging never finds them)
  inert('fireFlower', 'Fire Flower', 'food', 'Pass a challenge automatically'),
  inert('chocolateRose', 'Chocolate Rose', 'food', 'Effect to come'),
  inert('energyDrink', 'Energy Drink', 'food', 'Energized for 2 days, then Buzzed for 2'),
  inert(
    'dogFood',
    'Dog Food',
    'food',
    'Dogs: +4 Appetite and +1 Morale. Anyone else: +2 Appetite and −1 Morale',
  ),
  // Tools
  inert(
    'magnifyingGlass',
    'Magnifying Glass',
    'tool',
    'Higher chance of Choice cards when scavenging',
  ),
  inert('medicine', 'Medicine', 'tool', 'Cures a condition'),
  inert('medkit', 'Medkit', 'tool', 'Cures a condition and an injury'),
  inert('phone', 'Phone', 'tool', 'Several uses: Uber Eats (a food), Call, Maps (reveal tiles)'),
  inert('bundle', 'Bundle', 'tool', 'Gives 5 random resources. Crafted from any 6 resources'),
  // Shelters
  inert(
    'medicTent',
    'Medic Tent',
    'shelter',
    'The first time a hiker sleeps here, they cure 1 injury',
  ),
  // Trinkets
  inert('ring', 'Ring', 'trinket', "Changes a hiker's family for a set number of days"),
];

/** Opportunity rewards (Nov 6 update) until the real items exist. Not found by scavenging. */
const REWARDS: ItemDef[] = [
  inert('citroDrink', 'Citro Drink', 'food', 'A fizzy drink from the Citro Tub (placeholder)'),
];

/**
 * Tier III stand-ins for a Wonder's "pick 1 of 3" and Snake Slots' jackpot.
 * TODO(phase 9): the real Tier III items and traits.
 */
const TIER_3: ItemDef[] = [
  { ...inert('tier3Tool', 'Tier III Tool', 'tool', 'A top-tier tool (placeholder)'), tier: 3 },
  {
    ...inert(
      'tier3Clothes',
      'Tier III Clothes',
      'clothes',
      'Top-tier clothes (placeholder)',
      'body',
    ),
    tier: 3,
  },
  {
    ...inert('tier3Trinket', 'Lucky Charm', 'trinket', 'A top-tier trinket (placeholder)'),
    tier: 3,
  },
];
export const TIER_3_ITEMS: readonly string[] = TIER_3.map((i) => i.id);

export const ITEMS: Readonly<Record<string, ItemDef>> = Object.fromEntries(
  [backpack, ...NAMED, ...REWARDS, ...TIER_3].map((i) => [i.id, i]),
);

/** Items scavenging can find, by type (the Backpack is a test stand-in, so it's left out). */
export function findableItems(type: ItemDef['type']): ItemDef[] {
  return NAMED.filter((i) => i.type === type);
}
