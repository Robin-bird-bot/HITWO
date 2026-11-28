/**
 * An item card's counter (docs/design/31-trailmate-item-cards.md, section 2):
 * what's left and the most there can be at its Quality, which the LEDs and
 * the "3/4" show.
 */
import { ITEMS } from '../../content';
import { fullCounters, type ItemInstance, type Quality } from '../../engine';

export type Counters = Pick<
  ItemInstance,
  | 'quality'
  | 'usesLeft'
  | 'bitesLeft'
  | 'durability'
  | 'deploymentsLeft'
  | 'node'
  | 'colorway'
  | 'grade'
>;

/** What's left and the most there can be, for the counter. */
export function counterOf(
  itemId: string,
  item: Counters | undefined,
  quality: Quality | undefined,
): { left: number; max: number } {
  const def = ITEMS[itemId];
  if (!def) return { left: 0, max: 0 };
  // Shelters (Phase 10.6): the times it can still be set up.
  if (def.type === 'shelter') {
    const max = def.deployments ?? 0;
    return { left: Math.min(max, item?.deploymentsLeft ?? max), max };
  }
  const full = fullCounters(def, quality);
  const max = full.usesLeft ?? full.bitesLeft ?? full.durability ?? 0;
  const own = item?.usesLeft ?? item?.bitesLeft ?? item?.durability;
  return { left: Math.min(max, own ?? max), max };
}
