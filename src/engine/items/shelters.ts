/**
 * Portable shelters (Phase 10.6, docs/design/08-overhaul-plan.md).
 *
 * - A shelter rides in a pack (1 item slot) and is set up on a tile as a free
 *   action, using 1 deployment. Only 1 can be up on a tile at a time.
 * - While it's up, it takes no slot, and everyone on its tile is sheltered:
 *   +1 Energy from sleeping and safe from night events (isSheltered), plus
 *   its own effect, as an effect source (ItemDef.placedHooks or hooks). Some
 *   reach the tiles next to it: an RV shelters them, a Tree-House guards them.
 * - Any hiker on the tile with room can pack it up (free). When the hiker who
 *   set it up leaves the tile, it packs itself into their pack if there's
 *   room; if not, it stays up until someone packs it.
 * - With no deployments left it can't be set up again, and it's thrown away
 *   when it's packed.
 */
import { noteGone } from './gone';
import { ITEMS } from '../../content/items';
import { countShelter } from '../counters';
import type { EffectSource } from '../effects';
import { bagSlots } from '../inventory';
import { pushEvent } from '../log';
import { adjacentTileIds } from '../map';
import type {
  GameState,
  Hiker,
  HikerId,
  ItemId,
  ItemInstance,
  PlacedShelter,
  TileId,
} from '../types';

/** How many times a shelter can be set up, new. */
export function shelterDeployments(itemId: ItemId): number {
  return Math.max(1, ITEMS[itemId]?.deployments ?? 1);
}

/** A carried shelter's deployments left. */
export const deploymentsOf = (item: ItemInstance): number =>
  item.deploymentsLeft ?? shelterDeployments(item.itemId);

/** The shelter set up on a tile, if any (only 1 at a time). */
export const shelterOn = (state: GameState, tileId: TileId): PlacedShelter | undefined =>
  state.section.tiles[tileId]?.shelters?.[0];

/**
 * Sets a shelter up on a tile, using 1 deployment, and logs it. `left` is
 * what it had before (a pack item's, or a new one's for Ruins).
 */
export function setUpShelterOn(
  state: GameState,
  tileId: TileId,
  itemId: ItemId,
  left: number,
  by?: HikerId,
  itemUid?: string,
): PlacedShelter | undefined {
  const tile = state.section.tiles[tileId];
  if (!tile) return undefined;
  const placed: PlacedShelter = {
    uid: `shelter-${state.nextEventId}-${itemId}`,
    itemId,
    deploymentsLeft: Math.max(0, left - 1),
    ...(by ? { by } : {}),
    ...(itemUid ? { itemUid } : {}),
  };
  tile.shelters = [placed];
  countShelter(state);
  pushEvent(state, {
    kind: 'shelterSetUp',
    tileId,
    itemId,
    left: placed.deploymentsLeft,
    ...(by ? { hikerId: by } : {}),
  });
  return placed;
}

const hasRoom = (state: GameState, h: Hiker) => h.inventory.bag.length < bagSlots(state, h).total;

/**
 * Packs a tile's shelter into a hiker's pack. With no deployments left it's
 * thrown away instead. Returns false if it couldn't (no room).
 */
export function packUpShelter(state: GameState, hiker: Hiker, auto = false): boolean {
  const tile = state.section.tiles[hiker.tileId];
  const placed = tile?.shelters?.[0];
  if (!tile || !placed) return false;
  if (placed.deploymentsLeft <= 0) {
    delete tile.shelters;
    pushEvent(state, {
      kind: 'shelterWornOut',
      tileId: tile.id,
      itemId: placed.itemId,
      hikerId: hiker.id,
    });
    noteGone(state, placed.itemId);
    return true;
  }
  if (!hasRoom(state, hiker)) return false;
  delete tile.shelters;
  hiker.inventory.bag.push({
    uid: placed.itemUid ?? placed.uid,
    itemId: placed.itemId,
    deploymentsLeft: placed.deploymentsLeft,
  });
  pushEvent(state, {
    kind: 'shelterPackedUp',
    tileId: tile.id,
    itemId: placed.itemId,
    hikerId: hiker.id,
    left: placed.deploymentsLeft,
    ...(auto ? { auto: true as const } : {}),
  });
  return true;
}

/** A hiker just left this tile: a shelter they set up there packs itself, if there's room. */
export function ownerLeft(state: GameState, hiker: Hiker, fromTileId: TileId): void {
  const placed = shelterOn(state, fromTileId);
  if (!placed || placed.by !== hiker.id) return;
  const here = hiker.tileId;
  hiker.tileId = fromTileId;
  packUpShelter(state, hiker, true);
  hiker.tileId = here;
}

/** The shelters on a tile right now (0 or 1). */
export const sheltersOn = (state: GameState, tileId: TileId): PlacedShelter[] =>
  state.section.tiles[tileId]?.shelters ?? [];

/** A shelter next to this tile whose effect reaches it (an RV, a Tree-House). */
export function neighborShelter(
  state: GameState,
  tileId: TileId,
  reach: 'shelters' | 'guards',
): PlacedShelter | undefined {
  for (const id of adjacentTileIds(state.section, tileId)) {
    const found = sheltersOn(state, id).find((s) => ITEMS[s.itemId]?.shelterReach === reach);
    if (found) return found;
  }
  return undefined;
}

/** The shelters on a hiker's tile, as effect sources (a Cabin's Energy, a Yurt's card). */
export function shelterSources(state: GameState, hiker: Hiker): EffectSource[] {
  const out: EffectSource[] = [];
  for (const placed of sheltersOn(state, hiker.tileId)) {
    const def = ITEMS[placed.itemId];
    if (!def) continue;
    const hooks = { ...def.hooks, ...def.placedHooks?.(placed) };
    if (!Object.keys(hooks).length) continue;
    out.push({ id: `shelter:${placed.uid}`, kind: 'item', itemId: def.id, name: def.name, hooks });
  }
  return out;
}
