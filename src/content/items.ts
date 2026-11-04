/**
 * Items as typed data. Phase 9 brings the real item list from
 * docs/design/03-items.md; for now there is one placeholder so the bag can
 * show slots added by an item.
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

export const ITEMS: Readonly<Record<string, ItemDef>> = Object.fromEntries(
  [backpack].map((i) => [i.id, i]),
);
