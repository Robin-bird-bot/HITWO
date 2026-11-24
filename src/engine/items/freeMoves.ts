/**
 * Moves that don't use the hiker's action, from their shoes:
 * - Jogging Shoes: the first move each phase.
 * - Hiking Crocs: once a day, after passing a challenge.
 * - Work Boots: after crafting (Phase 8 step 7 adds crafting).
 * Crocs and Boots' move also costs 1 less Appetite and takes 1 more
 * durability (BALANCE.items.freeMove). An earned move lasts until it's used
 * or the day ends. TODO(wyatt): free moves are the Move action, not Move All,
 * and an earned one lasts the rest of the day.
 *
 * Traits give free moves too (Phase 10a): Fast's first move each day (for 1
 * extra Appetite) and Stalker's once-a-day move to a hiker's tile (no
 * Appetite). When several apply, the cheapest is used.
 */
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content/items';
import { tally, traitFreeMoves, type TraitFreeMove } from '../effects';
import { pushEvent } from '../log';
import type { GameState, Hiker, ItemId, TileId } from '../types';
import { loseDurability } from './wear';

export interface FreeMove {
  /** Shoes: which pair. */
  itemId?: ItemId;
  uid?: string;
  /** A trait's free move: its name and how its use is counted (never, for an unlimited one). */
  trait?: { source: string; key: string; per: TraitFreeMove['per']; unlimited?: true };
  /** Appetite off the move (Infinity: all of it). */
  discount: number;
  /** Extra Appetite the move costs (Fast). */
  extra: number;
  /** Extra durability the shoes lose. */
  wear: number;
}

/**
 * The free move this hiker has right now, if any: from their shoes, or (for a
 * move to `toTileId`) from a trait. The cheapest one wins.
 */
export function freeMoveFor(
  state: GameState,
  hiker: Hiker,
  toTileId?: TileId,
): FreeMove | undefined {
  const shoes = shoesFreeMove(state, hiker);
  const traits: FreeMove[] = toTileId
    ? traitFreeMoves(state, hiker, hiker.tileId, toTileId).map(({ source, move }) => ({
        trait: {
          source,
          key: move.key,
          per: move.per,
          ...(move.unlimited ? { unlimited: true as const } : {}),
        },
        discount: move.discount === 'all' ? Infinity : (move.discount ?? 0),
        extra: move.extra ?? 0,
        wear: 0,
      }))
    : [];
  const all = [...(shoes ? [shoes] : []), ...traits];
  // Cheapest first: the most Appetite off, then the least extra.
  return all.sort((a, b) => b.discount - b.extra - (a.discount - a.extra))[0];
}

/** The free move this hiker's shoes give right now, if any. */
function shoesFreeMove(state: GameState, hiker: Hiker): FreeMove | undefined {
  const feet = hiker.inventory.equipped.feet;
  const def = feet && ITEMS[feet.itemId];
  if (!feet || !def?.freeMove) return undefined;
  if (def.freeMove === 'eachPhase') {
    const used = tally(state, hiker, `freeMove:${feet.itemId}`, 0, 'phase');
    return used === 0
      ? { itemId: feet.itemId, uid: feet.uid, discount: 0, extra: 0, wear: 0 }
      : undefined;
  }
  const earned = hiker.freeMove;
  if (earned?.itemId !== feet.itemId || earned.day !== state.day) return undefined;
  const { discount, wear } = BALANCE.items.freeMove;
  return { itemId: feet.itemId, uid: feet.uid, discount, extra: 0, wear };
}

/** Uses up the free move: shoes take their extra wear, and the log says it was free. */
export function spendFreeMove(state: GameState, hiker: Hiker, free: FreeMove): void {
  if (free.trait) {
    if (!free.trait.unlimited) tally(state, hiker, free.trait.key, 1, free.trait.per);
    pushEvent(state, { kind: 'freeAction', hikerId: hiker.id, cause: free.trait.source });
    return;
  }
  if (!free.itemId) return;
  if (ITEMS[free.itemId]?.freeMove === 'eachPhase') {
    tally(state, hiker, `freeMove:${free.itemId}`, 1, 'phase');
  } else {
    delete hiker.freeMove;
  }
  const name = ITEMS[free.itemId]?.name ?? 'Shoes';
  pushEvent(state, { kind: 'freeAction', hikerId: hiker.id, cause: name });
  const shoes = hiker.inventory.equipped.feet;
  if (free.wear && shoes && shoes.uid === free.uid) {
    loseDurability(state, hiker, shoes, free.wear, name);
  }
}

/**
 * After passing a challenge (Hiking Crocs, once a day) or crafting (Work
 * Boots): the hiker's shoes give them a free move.
 */
export function earnFreeMove(
  state: GameState,
  hiker: Hiker,
  after: 'afterChallenge' | 'afterCraft',
): void {
  const feet = hiker.inventory.equipped.feet;
  const def = feet && ITEMS[feet.itemId];
  if (!feet || def?.freeMove !== after || hiker.status !== 'active') return;
  if (after === 'afterChallenge') {
    if (tally(state, hiker, `earned:${feet.itemId}`, 0, 'day') > 0) return;
    tally(state, hiker, `earned:${feet.itemId}`, 1, 'day');
  }
  hiker.freeMove = { itemId: feet.itemId, day: state.day };
}
