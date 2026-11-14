/**
 * Shared looks and helpers for the station screen: the specials' names and
 * icons, dragging a pack thing onto the sell slot, and bundle names.
 */
import type { DragEvent } from 'react';
import { ITEMS } from '../../content';
import type { StationSpecialId } from '../../engine';
import type { IconName } from '../icons/paths';
import { resourceName } from '../scavenge/cardLook';

export const SPECIAL_LOOK: Record<
  StationSpecialId | 'rejoin',
  { name: string; title: string; icon: IconName; desc: string }
> = {
  cementMixer: {
    name: 'CEMENT MIXER',
    title: 'Cement Mixer',
    icon: 'road',
    desc: 'Pave one line in the next biome. Pick it with Preview Next Trail.',
  },
  scoutReport: {
    name: 'SCOUT REPORT',
    title: 'Scout Report',
    icon: 'eye',
    desc: 'See the challenges on 3 tiles of the next biome. Pick them with Preview Next Trail.',
  },
  rejoin: {
    name: 'TAXI SERVICE',
    title: 'Taxi Service',
    icon: 'users',
    desc: 'Bring back a hiker who abandoned the hike.',
  },
};

/** A bag item or resource dragged from a pack. */
export interface DragSale {
  hikerId: string;
  itemUid?: string;
  resource?: string;
}

export const DRAG_TYPE = 'application/x-hike-sale';

export const startSaleDrag = (e: DragEvent, sale: DragSale) => {
  e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(sale));
  e.dataTransfer.effectAllowed = 'move';
};

export const bundleName = (b: { item?: { itemId: string }; resource?: string; count?: number }) =>
  b.item
    ? (ITEMS[b.item.itemId]?.name ?? 'A pack')
    : `${b.count ?? 0} ${resourceName(b.resource ?? 'wood')}`;
