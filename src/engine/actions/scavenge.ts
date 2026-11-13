/**
 * Scavenging: deal the cards face down, flip them, then take one.
 * - Dealing costs nothing. "Not now" is allowed until a card is flipped, and
 *   puts the RNG back, so dealing again gives the same cards.
 * - Taking a card pays the Appetite, uses the hiker's phase, gives what the
 *   card shows, and drains the card's node.
 * - A Sack keeps more cards: after the first, the window stays open for
 *   another take (no more Appetite or action), or Done.
 * While a scavenge is open, every other action waits (see applyAction).
 */
import { makeItem } from '../items/make';
import { noteScavenged } from '../challenges/trials';
import { BALANCE } from '../../config/balance';
import { SCAVENGE_CARDS } from '../../content';
import { RESOURCES } from '../../content/resources';
import { changeAbundance } from '../abundance';
import { bagSlots, resourceCount, resourceLimit } from '../inventory';
import { pushEvent } from '../log';
import { roll } from '../rng';
import { abilitiesFor, abilityPeriod, fireScavenge, gainCaps } from '../effects';
import { spendOnceBoosts } from '../items/boosts';
import { dealCard, dealCards } from '../scavenge/deal';
import { scavengeCost, scavengeSetup, scavengeTileReason } from '../scavenge/setup';
import type {
  Action,
  GameState,
  ItemId,
  NodeType,
  ResourceId,
  RngState,
  ScavengeBonusOffer,
} from '../types';
import {
  findHiker,
  mustFindHiker,
  notActiveReason,
  payCost,
  phaseActionReason,
  spendAction,
} from './common';

type ScavengeAction = Extract<Action, { type: 'scavenge' }>;
type FlipAction = Extract<Action, { type: 'scavengeFlip' }>;
type TakeAction = Extract<Action, { type: 'scavengeTake' }>;
type RerollAction = Extract<Action, { type: 'scavengeReroll' }>;

const NOTHING_OPEN = 'Nobody is scavenging right now.';

export function validateScavenge(state: GameState, action: ScavengeAction): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  const reason = phaseActionReason(state, hiker, action);
  if (reason || !hiker) return reason;
  return scavengeTileReason(state, hiker);
}

export function applyScavenge(state: GameState, action: ScavengeAction): void {
  const hiker = mustFindHiker(state, action.hikerId);
  const setup = scavengeSetup(state, hiker);
  // A Supply Map's card is in this deal, so the map is used up.
  spendOnceBoosts(hiker, hiker.tileId);
  const rngBefore = [...state.rng] as RngState;
  const cards = dealCards(state.rng, {
    ...setup,
    ...(state.debugDeal?.length ? { forceTypes: state.debugDeal } : {}),
  });
  delete state.debugDeal;
  state.scavenge = {
    hikerId: hiker.id,
    tileId: hiker.tileId,
    cards,
    luck: setup.luck,
    bonuses: setup.bonuses,
    rngBefore,
    ...(setup.bonusOffers.length ? { bonusOffers: setup.bonusOffers } : {}),
    ...(setup.dropChance > 0 ? { dropChance: setup.dropChance } : {}),
    ...(setup.keeps > 0 ? { keeps: setup.keeps } : {}),
    ...(setup.rerolls > 0 ? { rerolls: setup.rerolls } : {}),
  };
}

/** The scavenger's reroll ability (Gambler) and its uses left, if they have one. */
export function rerollAbility(state: GameState) {
  const open = state.scavenge;
  const hiker = open && findHiker(state, open.hikerId);
  if (!hiker) return undefined;
  return abilitiesFor(state, hiker).find((a) => a.ability.scavengeReroll);
}

/**
 * Every reroll the scavenger has: Glasses' for this scavenge first, then an
 * ability's for the day (Gambler). Undefined when they have none at all.
 */
export function rerollsLeft(state: GameState): { left: number; label: string } | undefined {
  const glasses = state.scavenge?.rerolls ?? 0;
  const ability = rerollAbility(state);
  if (!glasses && !ability) return undefined;
  const label = glasses ? 'Glasses' : (ability?.ability.label ?? 'Reroll');
  return { left: glasses + (ability?.usesLeft ?? 0), label };
}

export function validateReroll(state: GameState, action: RerollAction): string | undefined {
  const open = state.scavenge;
  if (!open) return NOTHING_OPEN;
  const card = open.cards[action.card];
  if (!card) return 'That card isn’t on the table.';
  if (!card.flipped) return 'Flip that card first.';
  if (open.rerolls) return undefined;
  const found = rerollAbility(state);
  if (!found) return 'Nobody here can reroll a card.';
  if (found.usesLeft <= 0) return `${found.ability.label} is used up today.`;
  return undefined;
}

export function applyReroll(state: GameState, action: RerollAction): void {
  const open = state.scavenge;
  if (!open) throw new Error('applyReroll: nothing to reroll');
  const hiker = mustFindHiker(state, open.hikerId);
  if (open.rerolls) {
    // Glasses' rerolls go first.
    open.rerolls -= 1;
  } else {
    const found = rerollAbility(state);
    if (!found) throw new Error('applyReroll: nothing to reroll');
    const { ability } = found;
    const period = abilityPeriod(state, ability.limit.per);
    const use = hiker.abilityUses[ability.id];
    hiker.abilityUses[ability.id] = {
      period,
      count: use && use.period === period ? use.count + 1 : 1,
    };
    pushEvent(state, { kind: 'ability', hikerId: hiker.id, abilityId: ability.id });
  }
  // A fresh card, face up, from the same tile and odds.
  const card = dealCard(state.rng, scavengeSetup(state, hiker));
  open.cards[action.card] = { ...card, flipped: true };
}

export function validateFlip(state: GameState, action: FlipAction): string | undefined {
  const open = state.scavenge;
  if (!open) return NOTHING_OPEN;
  if (action.cards.length === 0) return 'Pick a card to flip.';
  if (action.cards.some((i) => !open.cards[i])) return 'That card isn’t on the table.';
  return undefined;
}

export function applyFlip(state: GameState, action: FlipAction): void {
  for (const i of action.cards) {
    const card = state.scavenge?.cards[i];
    if (card) card.flipped = true;
  }
}

export function validateCancel(state: GameState): string | undefined {
  const open = state.scavenge;
  if (!open) return NOTHING_OPEN;
  // After a Sack's first take, this is "Done".
  if (open.took) return undefined;
  if (open.cards.some((c) => c.flipped)) return 'A card has been flipped, so pick one to take.';
  return undefined;
}

export function applyCancel(state: GameState): void {
  const open = state.scavenge;
  if (!open) return;
  if (!open.took) state.rng = [...open.rngBefore] as RngState;
  delete state.scavenge;
}

/** The resources a player may pick on a Choice card. */
export function pickOptions(from: NodeType | 'all'): ResourceId[] {
  return RESOURCES.filter((r) => from === 'all' || r.node === from).map((r) => r.id);
}

export function validateTake(state: GameState, action: TakeAction): string | undefined {
  const open = state.scavenge;
  if (!open) return NOTHING_OPEN;
  const card = open.cards[action.card];
  if (!card) return 'That card isn’t on the table.';
  if (card.taken) return 'That card is already taken.';
  if (!card.flipped) return 'Flip that card first.';
  const hiker = findHiker(state, open.hikerId);
  const reason = notActiveReason(hiker);
  if (reason || !hiker) return reason;

  if (card.pick) {
    const picks = action.picks ?? [];
    if (picks.length !== card.pick.count) {
      return card.pick.count === 1
        ? 'Pick a resource first.'
        : `Pick ${card.pick.count} resources first.`;
    }
    const allowed = pickOptions(card.pick.from);
    if (picks.some((r) => !allowed.includes(r))) return 'That resource isn’t on this card.';
  }
  if (card.items) {
    if (SCAVENGE_CARDS[card.type].choiceItem) {
      if (!action.item) return 'Pick an item first.';
      if (!card.items.includes(action.item)) return 'That item isn’t on this card.';
    }
    if (hiker.inventory.bag.length >= bagSlots(state, hiker).total) {
      return `${hiker.name}’s bag is full, so this card can’t be taken. Pick another card.`;
    }
  }
  return undefined;
}

/** What taking this card gives, before the resource limit. */
export function cardGains(
  card: NonNullable<GameState['scavenge']>['cards'][number],
  picks: readonly ResourceId[] = [],
  item?: ItemId,
): { resources: ResourceId[]; caps: number; items: ItemId[] } {
  const def = SCAVENGE_CARDS[card.type];
  const resources = card.pick
    ? picks.flatMap((r) => Array.from({ length: card.pick?.each ?? 1 }, () => r))
    : (card.resources ?? []);
  const items = card.items ? (def.choiceItem ? (item ? [item] : []) : card.items) : [];
  return { resources, caps: card.caps ?? 0, items };
}

export function applyTake(state: GameState, action: TakeAction): void {
  const open = state.scavenge;
  const card = open?.cards[action.card];
  if (!open || !card) throw new Error('applyTake: no card');
  const hiker = mustFindHiker(state, open.hikerId);
  const def = SCAVENGE_CARDS[card.type];
  const gains = cardGains(card, action.picks, action.item);
  // The first take pays for the scavenge and uses the phase; a Sack's extra ones don't.
  const first = !open.took;
  const bonus = first
    ? bonusTaken(open.bonusOffers ?? [], action.bonus ?? 0, gains.resources.length > 0)
    : { count: 0, appetite: 0 };
  const base = first ? scavengeCost(state, hiker) : BALANCE.items.sackAppetite;
  const cost = base + bonus.appetite;
  // With a Sack, the window stays open while there are cards left to keep.
  const more =
    (open.keeps ?? 0) > (open.took ?? 0) &&
    open.cards.some((c, i) => i !== action.card && !c.taken);
  const close = () => {
    if (more) {
      card.taken = true;
      open.took = (open.took ?? 0) + 1;
    } else {
      delete state.scavenge;
    }
  };

  if (first) {
    spendAction(state, hiker);
    // Jeans and Pajamas wear a little with each scavenge.
    fireScavenge(state, hiker, open.tileId);
  }

  // Butterfingers: the card slips away. The scavenge still costs its Appetite.
  if (open.dropChance && roll(state.rng, open.dropChance)) {
    pushEvent(state, {
      kind: 'scavenge',
      hikerId: hiker.id,
      tileId: open.tileId,
      card: card.type,
      resources: [],
      dropped: true,
    });
    close();
    payCost(state, hiker, { appetite: base, energy: 0, morale: 0 }, 'Scavenge');
    return;
  }

  // Bonus resources are more of the first resource taken (Copier, Copydog).
  const firstResource = gains.resources[0];
  const all = firstResource
    ? [...gains.resources, ...Array.from({ length: bonus.count }, () => firstResource)]
    : gains.resources;
  const room = Math.max(0, resourceLimit(state, hiker) - resourceCount(hiker));
  const kept = all.slice(0, room);
  const bonusKept = Math.max(0, kept.length - gains.resources.length);
  for (const r of kept) hiker.inventory.resources[r] = (hiker.inventory.resources[r] ?? 0) + 1;
  const caps = gainCaps(state, gains.caps);
  for (const itemId of gains.items) {
    hiker.inventory.bag.push(makeItem(state, itemId, { prefix: 'found' }));
  }

  const nodes: NodeType[] = [];
  if (card.node) {
    // Bonus resources a hiker chooses to take drain Abundance too.
    const drain = def.drain + (card.bounty ? BALANCE.abundance.bountyExtraDrain : 0) + bonusKept;
    changeAbundance(state, card.node, -drain);
    nodes.push(card.node);
  }
  if (card.node2) {
    changeAbundance(state, card.node2, -def.drain);
    nodes.push(card.node2);
  }
  state.scavengedToday.push({ hikerId: hiker.id, tileId: open.tileId, nodes });

  pushEvent(state, {
    kind: 'scavenge',
    hikerId: hiker.id,
    tileId: open.tileId,
    card: card.type,
    resources: kept,
    ...(caps ? { caps } : {}),
    ...(gains.items.length ? { items: gains.items } : {}),
    ...(kept.length < all.length ? { left: all.length - kept.length } : {}),
    ...(bonusKept ? { bonus: bonusKept } : {}),
  });
  close();
  payCost(state, hiker, { appetite: cost, energy: 0, morale: 0 }, 'Scavenge');
  noteScavenged(state, hiker, kept);
}

/** How many bonus resources a take gets, and the Appetite they cost. */
export function bonusTaken(
  offers: readonly ScavengeBonusOffer[],
  paidWanted: number,
  hasResource: boolean,
): { count: number; appetite: number } {
  if (!hasResource) return { count: 0, appetite: 0 };
  let count = 0;
  let appetite = 0;
  let wanted = Math.max(0, paidWanted);
  for (const o of offers) {
    if (o.appetiteEach === 0) {
      count += o.count;
      continue;
    }
    const n = Math.min(o.count, wanted);
    wanted -= n;
    count += n;
    appetite += n * o.appetiteEach;
  }
  return { count, appetite };
}
