/**
 * Shelters on tiles (03-items.md, "Shelters"). A hiker places one from their
 * bag (a free action; TODO(wyatt): placing is a free action, on any tile), or
 * Ruins builds one. Every shelter is a basic shelter: hikers sleeping there get
 * the shelter bonus and are safe from night events, Drizzle and Sheer Cold
 * (isSheltered). Its own effect works for hikers on its tile, as an effect
 * source (ItemDef.placedHooks or hooks), and some reach the tiles next to it:
 * an RV shelters them, a Tree-House guards them from night events.
 * Its nights count down at the end of each camp step; at 0 it's gone.
 */
import { noteGone } from './gone';
import { ITEMS } from '../../content/items';
import { countShelter } from '../counters';
import type { EffectSource } from '../effects';
import { pushEvent } from '../log';
import { adjacentTileIds } from '../map';
import type { GameState, Hiker, HikerId, ItemId, PlacedShelter, TileId } from '../types';

/** How many nights a shelter lasts once placed. */
export function shelterNights(itemId: ItemId): number {
  return Math.max(1, ITEMS[itemId]?.nights ?? 1);
}

/** Puts a new shelter on a tile and logs it. */
export function placeShelterOn(
  state: GameState,
  tileId: TileId,
  itemId: ItemId,
  by?: HikerId,
): PlacedShelter | undefined {
  const tile = state.section.tiles[tileId];
  if (!tile) return undefined;
  const placed: PlacedShelter = {
    uid: `shelter-${state.nextEventId}-${tile.shelters?.length ?? 0}-${itemId}`,
    itemId,
    nightsLeft: shelterNights(itemId),
    ...(by ? { by } : {}),
  };
  tile.shelters = [...(tile.shelters ?? []), placed];
  countShelter(state);
  pushEvent(state, {
    kind: 'shelterPlaced',
    tileId,
    itemId,
    nights: placed.nightsLeft,
    ...(by ? { hikerId: by } : {}),
  });
  return placed;
}

/** The shelters on a tile right now. */
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

/** The camp step: every shelter counts a night; one with none left is gone. */
export function sheltersAtCamp(state: GameState): void {
  for (const tile of Object.values(state.section.tiles)) {
    if (!tile.shelters?.length) continue;
    const left: PlacedShelter[] = [];
    for (const s of tile.shelters) {
      s.nightsLeft -= 1;
      if (s.nightsLeft > 0) left.push(s);
      else {
        pushEvent(state, { kind: 'shelterGone', tileId: tile.id, itemId: s.itemId });
        noteGone(state, s.itemId);
      }
    }
    if (left.length) tile.shelters = left;
    else delete tile.shelters;
  }
}
