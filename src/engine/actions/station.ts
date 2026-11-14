/**
 * At a ranger station (Phase 9; docs/design/06-ranger-stations.md). The visit
 * costs no actions: buying, selling, giving between packs and crafting at the
 * Workbench are all free, and caps stay one party purse.
 *
 * - Buy: an item or bundle for a hiker with room, a blueprint for a hiker who
 *   doesn't know it, a shared special (its pick is in the next section), or
 *   the rejoin (Taxi Service) for an abandoned hiker.
 * - Sell: a bag item or some of one resource, at this visit's prices.
 * - Rest & Go: the free night (sheltered sleep, nothing lost, no night event),
 *   then the next morning at the next biome's Trailhead.
 */
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content/items';
import { freshAbundance } from '../abundance';
import { revealCardOn } from '../challenges/reveal';
import { tickConditions } from '../conditions';
import { countSleep } from '../counters';
import { startNewDay } from '../dayLoop';
import { bagSlots, resourceCount, resourceLimit } from '../inventory';
import { dropSectionBoosts, tickBoosts } from '../items/boosts';
import { knowsBlueprint } from '../items/craft';
import { PAVED } from '../items/scout';
import { removeItem } from '../items/wear';
import { pushEvent } from '../log';
import { changeStat } from '../stats';
import { marketMult, resourceSellPrice, sellPrice } from '../station/prices';
import type { Action, GameState, Hiker, StationVisit, StatName } from '../types';
import { findHiker, mustFindHiker } from './common';

type BuyAction = Extract<Action, { type: 'buy' }>;
type SellAction = Extract<Action, { type: 'sell' }>;

const S = BALANCE.station;

/** Why this hiker can't shop here: no station open, or they aren't at it. */
function shopperReason(state: GameState, hiker: Hiker | undefined): string | undefined {
  if (!state.station) return 'There’s no ranger station open.';
  if (!hiker || hiker.status !== 'checkedIn') {
    return `${hiker?.name ?? 'That hiker'} isn’t at the station.`;
  }
  return undefined;
}

/** Something on the counter, by id. */
export function findOffer(station: StationVisit, id: string) {
  return (
    station.items.find((o) => o.id === id) ??
    station.blueprints.find((o) => o.id === id) ??
    station.bundles.find((o) => o.id === id) ??
    (station.special?.id === id ? station.special : undefined)
  );
}

/** Why the rejoin can't bring this hiker back, if it can't. */
export function rejoinReason(state: GameState, hikerId: string): string | undefined {
  const station = state.station;
  if (!station) return 'There’s no ranger station open.';
  if (station.rejoined) return 'This station’s Taxi Service has already been used.';
  if ((state.rejoinsUsed ?? 0) >= S.rejoin.perRun) {
    return `Only ${S.rejoin.perRun} hikers can rejoin in one hike.`;
  }
  const h = findHiker(state, hikerId);
  if (!h || h.status !== 'abandoned') return 'Pick a hiker who left the hike.';
  if (state.caps < S.rejoin.price) return `The party needs ${S.rejoin.price} caps.`;
  return undefined;
}

export function validateBuy(state: GameState, action: BuyAction): string | undefined {
  const station = state.station;
  if (!station) return 'There’s no ranger station open.';
  if (action.offerId === 'rejoin') return rejoinReason(state, action.hikerId);
  const offer = findOffer(station, action.offerId);
  if (!offer) return 'That isn’t for sale here.';
  if (offer.sold) return 'That’s already sold.';
  if (state.caps < offer.price) return `The party needs ${offer.price} caps.`;
  if (offer.kind === 'special') return specialReason(station, offer.special, action.pick);
  const hiker = findHiker(state, action.hikerId);
  const reason = shopperReason(state, hiker);
  if (reason || !hiker) return reason;
  const bagFull = hiker.inventory.bag.length >= bagSlots(state, hiker).total;
  if (offer.kind === 'item' && bagFull) return `${hiker.name}’s bag is full.`;
  if (offer.kind === 'bundle') {
    if (offer.item && bagFull) return `${hiker.name}’s bag is full.`;
    const room = resourceLimit(state, hiker) - resourceCount(hiker);
    if (offer.resource && room < (offer.count ?? 0)) {
      return `${hiker.name} has room for ${Math.max(0, room)} more resource${room === 1 ? '' : 's'}.`;
    }
  }
  // A face-down blueprint is a gamble: it might be one they know.
  if (offer.kind === 'blueprint' && !offer.hidden && knowsBlueprint(hiker, offer.itemId)) {
    return `${hiker.name} already knows the ${ITEMS[offer.itemId]?.name ?? 'blueprint'}.`;
  }
  return undefined;
}

/** A special's pick, in the next section: a line to pave, or tiles to show. */
function specialReason(
  station: StationVisit,
  special: string,
  pick: BuyAction['pick'],
): string | undefined {
  const next = station.next;
  if (special === 'cementMixer') {
    const line = next.lines.find((l) => l.id === pick?.lineId);
    if (!line) return 'Pick a line in the next biome to pave.';
    return PAVED[line.kind] ? undefined : 'That line is already Paved.';
  }
  if (special === 'scoutReport') {
    const ids = pick?.tileIds ?? [];
    if (!ids.length) return 'Pick tiles in the next biome.';
    if (ids.length > S.scoutTiles) return `Pick up to ${S.scoutTiles} tiles.`;
    if (new Set(ids).size !== ids.length) return 'Pick different tiles.';
    if (ids.some((id) => next.tiles[id]?.kind !== 'normal')) return 'Pick tiles on the trail.';
  }
  return undefined;
}

export function applyBuy(state: GameState, action: BuyAction): void {
  const station = state.station;
  if (!station) return;
  if (action.offerId === 'rejoin') {
    rejoin(state, station, mustFindHiker(state, action.hikerId));
    return;
  }
  const offer = findOffer(station, action.offerId);
  if (!offer) return;
  state.caps -= offer.price;
  offer.sold = true;
  const mystery = offer.hidden ? { mystery: true as const } : {};
  delete offer.hidden;
  const price = offer.price;

  if (offer.kind === 'special') {
    if (offer.special === 'cementMixer') {
      const line = station.next.lines.find((l) => l.id === action.pick?.lineId);
      const paved = line && PAVED[line.kind];
      if (line && paved) line.kind = paved;
    } else {
      station.scout = [...(action.pick?.tileIds ?? [])];
    }
    pushEvent(state, { kind: 'bought', price, special: offer.special });
    return;
  }
  const hiker = mustFindHiker(state, action.hikerId);
  if (offer.kind === 'blueprint') {
    if (!knowsBlueprint(hiker, offer.itemId)) {
      hiker.blueprints = [...(hiker.blueprints ?? []), offer.itemId];
    }
    pushEvent(state, {
      kind: 'bought',
      hikerId: hiker.id,
      price,
      blueprint: offer.itemId,
      ...mystery,
    });
    return;
  }
  if (offer.kind === 'bundle' && offer.resource) {
    const n = offer.count ?? 0;
    hiker.inventory.resources[offer.resource] =
      (hiker.inventory.resources[offer.resource] ?? 0) + n;
    pushEvent(state, {
      kind: 'bought',
      hikerId: hiker.id,
      price,
      resource: offer.resource,
      count: n,
    });
    return;
  }
  const item = offer.kind === 'item' ? offer.item : offer.item;
  if (!item) return;
  hiker.inventory.bag.push(item);
  pushEvent(state, { kind: 'bought', hikerId: hiker.id, price, itemId: item.itemId, ...mystery });
}

/** The Taxi Service: an abandoned hiker comes back to the station, hurt and with an empty pack. */
function rejoin(state: GameState, station: StationVisit, h: Hiker): void {
  const { price, injuries, stat } = S.rejoin;
  state.caps -= price;
  station.rejoined = true;
  state.rejoinsUsed = (state.rejoinsUsed ?? 0) + 1;
  h.status = 'checkedIn';
  h.tileId = state.section.checkpointId;
  h.injuries = injuries;
  for (const s of Object.keys(h.stats) as StatName[]) h.stats[s] = stat;
  h.conditions = [];
  h.inventory = { bag: [], equipped: {}, resources: {} };
  delete h.boosts;
  delete h.countdown;
  pushEvent(state, { kind: 'rejoined', hikerId: h.id, price });
}

export function validateSell(state: GameState, action: SellAction): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  const reason = shopperReason(state, hiker);
  if (reason || !hiker) return reason;
  if (action.itemUid) {
    if (!hiker.inventory.bag.some((i) => i.uid === action.itemUid)) {
      return `${hiker.name} doesn’t have that in their bag.`;
    }
    return undefined;
  }
  const r = action.resource;
  const n = action.count ?? 1;
  if (!r || n < 1) return 'Pick something to sell.';
  if ((hiker.inventory.resources[r] ?? 0) < n) return `${hiker.name} doesn’t have that many.`;
  if (resourceSellPrice(state, r, n) < 1) {
    return `Worth less than a cap here: sell ${Math.ceil(1 / marketMult(state, r))} together.`;
  }
  return undefined;
}

/**
 * Selling: caps for the purse. TODO(wyatt): Fancy Attire and the Wallet don't
 * add to sales (selling one at a time would multiply them).
 */
export function applySell(state: GameState, action: SellAction): void {
  const hiker = mustFindHiker(state, action.hikerId);
  if (action.itemUid) {
    const item = removeItem(hiker, action.itemUid);
    if (!item) return;
    const caps = sellPrice(item);
    state.caps += caps;
    pushEvent(state, { kind: 'sold', hikerId: hiker.id, caps, itemId: item.itemId });
    return;
  }
  const r = action.resource;
  const n = action.count ?? 1;
  if (!r) return;
  const caps = resourceSellPrice(state, r, n);
  const left = (hiker.inventory.resources[r] ?? 0) - n;
  if (left > 0) hiker.inventory.resources[r] = left;
  else delete hiker.inventory.resources[r];
  state.caps += caps;
  pushEvent(state, { kind: 'sold', hikerId: hiker.id, caps, resource: r, count: n });
}

export function validateRestAndGo(state: GameState): string | undefined {
  if (!state.station) return 'There’s no ranger station open.';
  if (state.crafting) return 'Finish crafting first.';
  return undefined;
}

/**
 * Rest & Go (Wyatt, Nov 13): everyone at the station sleeps sheltered, losing
 * nothing (no drains, no wear, no night event). A night passes for conditions
 * and night-long boosts. Then it's the next morning on the next biome's
 * Trailhead; a hiker carried in, still out cold, is passed out there.
 */
export function applyRestAndGo(state: GameState): void {
  const station = state.station;
  if (!station) return;
  const here = state.hikers.filter((h) => h.status === 'checkedIn');
  for (const h of here) {
    changeStat(state, h, 'energy', BALANCE.sleep.shelteredEnergy, 'The station’s free night');
  }

  // The next section: its Trailhead is free (no challenge or nodes).
  state.sectionIndex += 1;
  state.section = station.next;
  const trailhead = state.section.tiles[state.section.trailheadId];
  if (trailhead) trailhead.visited = true;
  for (const h of here) {
    h.tileId = state.section.trailheadId;
    const out = h.injuries >= BALANCE.injuries.passOutAt;
    h.status = out ? 'passedOut' : 'active';
    if (out) h.countdown = BALANCE.passOut.countdownNights;
    h.acted = false;
    h.slept = true;
    delete h.cameFrom;
    delete h.carrying;
  }
  countSleep(state);
  tickConditions(state, 'days');
  tickBoosts(state, 'nights');
  // What belonged to the last section stays behind.
  dropSectionBoosts(state);
  state.usedCards = [];
  state.scavengedToday = [];
  state.abundance = freshAbundance();
  delete state.trials;
  delete state.challengeQueue;
  delete state.station;
  pushEvent(state, {
    kind: 'nextSection',
    biome: state.section.biome,
    section: state.sectionIndex,
  });
  // A Scout Report shows its cards now that the section is here.
  for (const id of station.scout ?? []) revealCardOn(state, id, 'the Scout Report');
  startNewDay(state);
}
