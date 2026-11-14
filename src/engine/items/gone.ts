/**
 * Rocco's "Borrowed" Boutique (docs/design/06-ranger-stations.md) stocks the
 * party's own items that were used up or lost this run. Every place an item
 * leaves for good by being used up or lost calls `noteGone`:
 *
 * - uses, bites or durability ran out (including durability or uses spent on
 *   a challenge, and a Hardhat breaking);
 * - a shelter's nights ended;
 * - a Use trinket was used;
 * - it was stolen or lost by a challenge or night event, or paid to a
 *   challenge. TODO(wyatt): paying an item to a challenge counts as lost.
 *
 * Selling, dropping, giving and trading don't count.
 */
import type { GameState, ItemId } from '../types';

export function noteGone(state: GameState, itemId: ItemId): void {
  state.usedOrLost = { ...state.usedOrLost, [itemId]: (state.usedOrLost?.[itemId] ?? 0) + 1 };
}
