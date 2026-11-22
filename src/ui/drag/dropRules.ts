/**
 * Which drops are valid, and what each does (Nov 14 update, section 6).
 * Pure, so it's tested; the screens ask these while something is dragged.
 * Each one asks the engine (validateAction) whether the action a drop would
 * make can happen, so a spot only glows when the drop would work.
 */
import { ITEMS } from '../../content';
import {
  applyAction,
  choiceOfUse,
  findOffer,
  mapTargets,
  validateAction,
  type Action,
  type EquipSlot,
  type GameState,
  type Hiker,
  type HikerId,
  type TileId,
} from '../../engine';
import { moveTargets } from '../game/movePlan';
import type { DragPayload } from './drag';

const ok = (state: GameState, action: Action) => validateAction(state, action) === null;
const hikerOf = (state: GameState, id: HikerId) => state.hikers.find((h) => h.id === id);
const itemOf = (state: GameState, p: DragPayload) =>
  p.kind === 'item'
    ? hikerOf(state, p.hikerId)?.inventory.bag.find((i) => i.uid === p.itemUid)
    : undefined;
const defOf = (state: GameState, p: DragPayload) => ITEMS[itemOf(state, p)?.itemId ?? ''];

// ── Hikers ───────────────────────────────────────────────────────────────────

/** A hiker can be picked up off the map while they're on the trail and awake. */
export function canDragHiker(hiker: Hiker | undefined): boolean {
  return hiker?.status === 'active';
}

/** The tiles a dragged hiker can be dropped on: every connected tile they can move to now. */
export function hikerDropTiles(state: GameState, hikerId: HikerId): ReadonlySet<TileId> {
  const hiker = hikerOf(state, hikerId);
  if (!canDragHiker(hiker) || !hiker) return new Set();
  return new Set(
    moveTargets(state, hiker, { kind: 'move' })
      .filter((t) => t.reason === null)
      .map((t) => t.tileId),
  );
}

// ── Items and resources on the trail ─────────────────────────────────────────

/** What a pack thing dropped on a hiker's portrait does. */
export type PortraitDrop =
  /** Hand it over (free, and easy to give back). */
  | { kind: 'give'; action: Action }
  /** Their own food: eat it. */
  | { kind: 'eat'; action: Action }
  /** Their own Present: open it (holiday hikers). */
  | { kind: 'open'; action: Action }
  /**
   * Food on someone else: give it, or they eat it now (`eat`, when they can).
   * TODO(wyatt): first guess, since giving and eating share the portrait.
   */
  | {
      kind: 'feed';
      give: Action;
      eat: Action | null;
      /** A camp meal (Phase 10.6): they eat a bite straight from the owner's pack, no trade. */
      campEat?: Action;
    };

export function portraitDrop(state: GameState, p: DragPayload, toId: HikerId): PortraitDrop | null {
  if (p.kind === 'resource') {
    const give: Action = { type: 'give', fromId: p.hikerId, toId, resource: p.resource };
    return p.hikerId !== toId && ok(state, give) ? { kind: 'give', action: give } : null;
  }
  if (p.kind !== 'item') return null;
  const food = defOf(state, p)?.type === 'food';
  if (p.hikerId === toId) {
    if (defOf(state, p)?.type === 'present') {
      const open: Action = { type: 'openPresent', hikerId: toId, itemUid: p.itemUid };
      return ok(state, open) ? { kind: 'open', action: open } : null;
    }
    const eat: Action = { type: 'eat', hikerId: toId, itemUid: p.itemUid };
    return food && ok(state, eat) ? { kind: 'eat', action: eat } : null;
  }
  const give: Action = { type: 'give', fromId: p.hikerId, toId, itemUid: p.itemUid };
  // A camp meal: they can eat a bite where it is, without trading for it.
  const campEat: Action = {
    type: 'eat',
    hikerId: toId,
    itemUid: p.itemUid,
    fromHikerId: p.hikerId,
  };
  const canCampEat = food && !!defOf(state, p)?.campMeal && ok(state, campEat);
  if (!ok(state, give)) return canCampEat ? { kind: 'eat', action: campEat } : null;
  if (!food) return { kind: 'give', action: give };
  // Could they eat it once it's theirs?
  const eat: Action = { type: 'eat', hikerId: toId, itemUid: p.itemUid };
  return {
    kind: 'feed',
    give,
    eat: ok(applyAction(state, give), eat) ? eat : null,
    ...(canCampEat ? { campEat } : {}),
  };
}

/** Clothes dropped on one of the wearer's slots: put them on, if it's their slot. */
export function slotDrop(state: GameState, p: DragPayload, slot: EquipSlot): Action | null {
  if (p.kind !== 'item' || defOf(state, p)?.slot !== slot) return null;
  const putOn: Action = { type: 'putOn', hikerId: p.hikerId, itemUid: p.itemUid };
  return ok(state, putOn) ? putOn : null;
}

/** What a pack thing dropped on a map tile does: a map tool's tile, or a shelter on its own tile. */
export type TileDrop = { kind: 'tool'; action: Action } | { kind: 'place'; action: Action };

export function tileDrop(state: GameState, p: DragPayload, tileId: TileId): TileDrop | null {
  if (p.kind !== 'item') return null;
  const hiker = hikerOf(state, p.hikerId);
  const def = defOf(state, p);
  if (!hiker || !def) return null;
  if (def.type === 'shelter') {
    const place: Action = { type: 'placeShelter', hikerId: hiker.id, itemUid: p.itemUid };
    return tileId === hiker.tileId && ok(state, place) ? { kind: 'place', action: place } : null;
  }
  const map = def.use?.map;
  if (!map?.pick || !mapTargets(state, hiker, map).includes(tileId)) return null;
  const use: Action = {
    type: 'useItem',
    hikerId: hiker.id,
    itemUid: p.itemUid,
    targetId: hiker.id,
    choice: tileId,
  };
  return ok(state, use) ? { kind: 'tool', action: use } : null;
}

/**
 * A usable item with no tile to pick, dropped anywhere on the map: it opens
 * its Use step (who it's for, what to pick, then a confirm).
 */
export function mapDrop(state: GameState, p: DragPayload): boolean {
  const def = defOf(state, p);
  const hiker = p.kind === 'item' ? hikerOf(state, p.hikerId) : undefined;
  if (!def?.use || hiker?.status !== 'active' || def.type === 'food') return false;
  return choiceOfUse(def.use) !== 'tile';
}

// ── The ranger station ───────────────────────────────────────────────────────

/** A counter card can be picked up while it's for sale and the party can afford it. */
export function canPickUpOffer(state: GameState, offerId: string): boolean {
  const station = state.station;
  const offer = station ? findOffer(station, offerId) : undefined;
  if (!offer || offer.sold || offer.kind === 'special') return false;
  return state.caps >= offer.price;
}

/** A counter card dropped on a hiker's pack: they buy it, if they can take it. */
export function buyDrop(state: GameState, p: DragPayload, hikerId: HikerId): Action | null {
  if (p.kind !== 'offer' || !canPickUpOffer(state, p.offerId)) return null;
  const buy: Action = { type: 'buy', offerId: p.offerId, hikerId };
  return ok(state, buy) ? buy : null;
}

/** A pack thing dropped on the sell slot: what's being sold (a whole resource stack). */
export function sellDrop(
  state: GameState,
  p: DragPayload,
): { hikerId: HikerId; itemUid?: string; resource?: string; count?: number } | null {
  if (!state.station) return null;
  if (p.kind === 'item') {
    return ok(state, { type: 'sell', hikerId: p.hikerId, itemUid: p.itemUid })
      ? { hikerId: p.hikerId, itemUid: p.itemUid }
      : null;
  }
  if (p.kind === 'resource') {
    const count = hikerOf(state, p.hikerId)?.inventory.resources[p.resource] ?? 0;
    return count > 0 && ok(state, { type: 'sell', hikerId: p.hikerId, resource: p.resource, count })
      ? { hikerId: p.hikerId, resource: p.resource, count }
      : null;
  }
  return null;
}
