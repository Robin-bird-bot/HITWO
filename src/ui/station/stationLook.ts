/**
 * Shared looks and helpers for the station screen: the specials' names and
 * icons, dragging a pack thing onto the sell slot, and bundle names.
 */
import { ITEMS } from '../../content';
import { findOffer, type StationSpecialId, type StationVisit } from '../../engine';
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

export const bundleName = (b: { item?: { itemId: string }; resource?: string; count?: number }) =>
  b.item
    ? (ITEMS[b.item.itemId]?.name ?? 'A pack')
    : `${b.count ?? 0} ${resourceName(b.resource ?? 'wood')}`;

/** What a counter card is, in words ("the Shovel", "a mystery item", "the Shovel blueprint"). */
export function offerName(station: StationVisit, offerId: string): string {
  if (offerId === 'rejoin') return 'the Taxi Service';
  const offer = findOffer(station, offerId);
  if (!offer) return 'this';
  switch (offer.kind) {
    case 'item':
      return offer.hidden ? 'a mystery item' : `the ${ITEMS[offer.item.itemId]?.name}`;
    case 'blueprint':
      return offer.hidden ? 'a mystery blueprint' : `the ${ITEMS[offer.itemId]?.name} blueprint`;
    case 'bundle':
      return bundleName(offer);
    case 'special':
      return `the ${SPECIAL_LOOK[offer.special].title}`;
  }
}
