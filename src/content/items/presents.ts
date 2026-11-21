/**
 * Presents (Nov 20 update, holiday hikers; 03-items.md, "Presents"). Only
 * Grammy Clause wraps them (Gift Wrapper), so the Present is kept out of
 * TABLE_ITEMS and every random pool: scavenging, shops, Rocco, bundles,
 * Mystery Items, night events, challenge and Wonder rewards, and starting
 * resources.
 *
 * Each Present has a wrapping (1–5), who wrapped it, and a grade from the
 * recipe it was wrapped with. No Tier and no Quality: what's inside is only
 * rolled when it's opened.
 */
import type { ItemDef } from '../../engine/effects';
import type { ItemInstance, PresentGrade } from '../../engine/types';
import { item } from './build';

export const PRESENT_ID = 'present';

export const PRESENT: ItemDef = item({
  id: PRESENT_ID,
  name: 'Present',
  type: 'present',
  // No tier of its own (the card shows none); 1 so nothing reads a missing tier.
  tier: 1,
  text: 'Open: your action and 1 Energy. Get a random item.',
  notCrafted: true,
  notFound: true,
  // The art is the Present's own wrapping (presentArt).
  art: null,
});

/** The 5 wrappings, in colorway order (public/assets/items/presents/). */
export const PRESENT_WRAPPINGS: readonly { file: string; name: string }[] = [
  { file: 'present-1-candy-cane', name: 'Candy cane' },
  { file: 'present-2-holly', name: 'Holly' },
  { file: 'present-3-lilac', name: 'Lilac' },
  { file: 'present-4-midnight', name: 'Midnight' },
  { file: 'present-5-berry', name: 'Berry' },
];

/** A Present's art name (for ASSETS.itemArt): its wrapping, or the first when it has none. */
export function presentArt(item: Pick<ItemInstance, 'colorway'> | undefined): string {
  const i = Math.min(PRESENT_WRAPPINGS.length, Math.max(1, item?.colorway ?? 1)) - 1;
  return `presents/${PRESENT_WRAPPINGS[i]?.file ?? 'present-1-candy-cane'}`;
}

/** The small tag where the tier numeral usually sits: none for a plain Present. */
export const GRADE_TAG: Readonly<Record<PresentGrade, string | null>> = {
  plain: null,
  tier2plus: 'Tier 2+',
  tier3: 'Tier 3',
};

/** "Present", "Tier 2+ Present", "Tier 3 Present". */
export function presentName(grade: PresentGrade | undefined): string {
  const tag = GRADE_TAG[grade ?? 'plain'];
  return tag ? `${tag} Present` : 'Present';
}
