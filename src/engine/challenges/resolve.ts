/**
 * Paying for a challenge, or taking its penalty (04-challenges.md, "How to
 * read a challenge"; Challenge.dc.html and ChallengeParty.dc.html).
 *
 * - A party challenge has one section, and anyone on the tile can chip in.
 * - An each-hiker challenge has a section for each hiker it judges. Other
 *   hikers on the tile can still hand things in for them (the mockup's
 *   "Finnegan or Cody can add a Fish").
 * - One resolveChallenge action carries every section: pay or not, which cost
 *   option, and each gift (who gave which resource, item, caps or stat
 *   points). It's all checked before anything is spent.
 * - Passing earns XP (passXpPerTier × the tier it played at); failing applies
 *   the penalty to that hiker, or to every hiker on the tile for a party card.
 */
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content';
import { CARDS } from '../../content/challenges';
import { RESOURCES } from '../../content/resources';
import { resourceCount } from '../inventory';
import { pushEvent } from '../log';
import { changeStat } from '../stats';
import type {
  Action,
  ChallengePaid,
  ChallengeSection,
  GameState,
  Gift,
  Hiker,
  HikerId,
  OpenChallenge,
  ResourceId,
  StatName,
} from '../types';
import { applyEffects, foodCarried, type EffectResult } from './applyEffects';
import { openNext, revealTile } from './reveal';
import { amount, notBuiltYet } from './rolls';
import type { ChallengeDef, Requirement, ResourceFilter, Who } from './types';

type ResolveAction = Extract<Action, { type: 'resolveChallenge' }>;

const STAT_WORD: Record<StatName, string> = {
  energy: 'Energy',
  appetite: 'Appetite',
  morale: 'Morale',
};

/** The open card, if it's one the pop-up resolves (not a Trial). */
export function openCardDef(open: OpenChallenge): ChallengeDef | undefined {
  const card = CARDS[open.cardId];
  return card && card.kind !== 'trial' ? card : undefined;
}

/** The hikers it opened for who are still on the tile. */
export function challengeHikers(state: GameState, open: OpenChallenge): Hiker[] {
  return open.hikerIds
    .map((id) => state.hikers.find((h) => h.id === id))
    .filter((h): h is Hiker => !!h && h.tileId === open.tileId && h.status !== 'abandoned');
}

const wearsClothes = (h: Hiker) =>
  Object.values(h.inventory.equipped).some((i) => i && ITEMS[i.itemId]?.type === 'clothes');

function whoMatches(who: Who, h: Hiker): boolean {
  switch (who) {
    case 'all':
      return true;
    case 'noClothing':
      return !wearsClothes(h);
    case 'wearingClothes':
      return wearsClothes(h);
    case 'carryingFood':
      return foodCarried(h) > 0;
  }
}

/** The pop-up's sections: one for the party, or one per hiker it judges. */
export function challengeSections(state: GameState, open: OpenChallenge): { hikerId?: HikerId }[] {
  const card = openCardDef(open);
  if (!card) return [];
  const here = challengeHikers(state, open);
  if (card.scope === 'party') return here.length ? [{}] : [];
  return here.filter((h) => whoMatches(card.who ?? 'all', h)).map((h) => ({ hikerId: h.id }));
}

/** How many of a requirement a section needs (a Y uses that section's hiker). */
export function requirementNeed(
  state: GameState,
  open: OpenChallenge,
  req: Requirement,
  hikerId?: HikerId,
): number {
  const here = challengeHikers(state, open);
  const hiker = hikerId ? here.find((h) => h.id === hikerId) : undefined;
  const ctx = { rolls: open.rolls, onTile: here, foodCarried, ...(hiker ? { hiker } : {}) };
  switch (req.kind) {
    case 'resources':
      return req.fromEach ? here.length : Math.max(0, amount(req.count, ctx));
    case 'carryLimit':
      return hiker ? Math.max(0, resourceCount(hiker) - req.max) : 0;
    default:
      return Math.max(0, amount(req.count, ctx));
  }
}

/** Does a resource fit a requirement's filter? Fox's are the ones it rolled. */
export function resourceFits(
  filter: ResourceFilter | undefined,
  id: ResourceId,
  open: OpenChallenge,
): boolean {
  if (!filter) return true;
  if (filter.randomOf) return open.rolls.options?.includes(id) ?? false;
  const def = RESOURCES.find((r) => r.id === id);
  if (filter.ids && !filter.ids.includes(id)) return false;
  if (filter.nodes && (!def || !filter.nodes.includes(def.node))) return false;
  return true;
}

/** Can this gift go into this requirement at all (whatever the count)? */
export function giftFits(
  state: GameState,
  open: OpenChallenge,
  req: Requirement,
  gift: Gift,
  hikerId?: HikerId,
): boolean {
  const here = challengeHikers(state, open);
  if (gift.kind !== 'caps' && !here.some((h) => h.id === gift.from)) return false;
  switch (req.kind) {
    case 'resources':
      return gift.kind === 'resource' && resourceFits(req.filter, gift.resource, open);
    case 'carryLimit':
      // Rocky Path: a hiker sheds their own extra resources.
      return gift.kind === 'resource' && gift.from === hikerId;
    case 'items': {
      if (gift.kind !== 'item') return false;
      const item = here
        .find((h) => h.id === gift.from)
        ?.inventory.bag.find((i) => i.uid === gift.uid);
      const type = item && ITEMS[item.itemId]?.type;
      return !!type && (!req.itemTypes || req.itemTypes.includes(type));
    }
    case 'caps':
      return gift.kind === 'caps';
    case 'stat':
      return gift.kind === 'stat' && req.stats.includes(gift.stat);
    case 'durability':
    case 'toolUse':
      return false;
  }
}

export const giftCount = (g: Gift): number => (g.kind === 'item' ? 1 : g.count);

/** Why these gifts don't pay this option, or undefined when they pay it exactly. */
export function optionShortfall(
  state: GameState,
  open: OpenChallenge,
  option: number,
  gifts: readonly Gift[],
  hikerId?: HikerId,
): string | undefined {
  const reqs = openCardDef(open)?.cost[option];
  if (!reqs) return 'Pick a way to pay.';
  if (reqs.some(notBuiltYet)) return 'That way to pay arrives in Phase 9.';
  if (gifts.some((g) => !reqs[g.req]))
    return 'Something was handed in that this cost doesn’t ask for.';
  for (const [i, req] of reqs.entries()) {
    const mine = gifts.filter((g) => g.req === i);
    if (mine.some((g) => !giftFits(state, open, req, g, hikerId))) {
      return 'Something handed in doesn’t fit that space.';
    }
    const need = requirementNeed(state, open, req, hikerId);
    const got = mine.reduce((n, g) => n + giftCount(g), 0);
    if (got < need) return `Needs ${need - got} more.`;
    if (got > need) return 'That’s more than it asks for.';
    if (req.kind === 'resources' && req.same) {
      const kinds = new Set(mine.map((g) => (g.kind === 'resource' ? g.resource : '')));
      if (kinds.size > 1) return 'Those all have to be the same resource.';
    }
    if (req.kind === 'resources' && req.fromEach) {
      const givers = mine.map((g) => (g.kind === 'resource' ? g.from : ''));
      if (challengeHikers(state, open).some((h) => !givers.includes(h.id))) {
        return 'Each hiker on the tile gives one.';
      }
    }
  }
  return undefined;
}

/** Whether the givers still have everything handed in, across every section. */
function ledgerProblem(
  state: GameState,
  open: OpenChallenge,
  sections: readonly ChallengeSection[],
): string | undefined {
  const here = challengeHikers(state, open);
  const resources = new Map<string, number>();
  const stats = new Map<string, number>();
  const items = new Set<string>();
  let caps = 0;
  for (const g of sections.flatMap((s) => s.gifts)) {
    if (g.kind !== 'item' && (!Number.isInteger(g.count) || g.count < 1)) {
      return 'Hand things in one at a time.';
    }
    switch (g.kind) {
      case 'resource': {
        const key = `${g.from}|${g.resource}`;
        resources.set(key, (resources.get(key) ?? 0) + g.count);
        break;
      }
      case 'stat': {
        const key = `${g.from}|${g.stat}`;
        stats.set(key, (stats.get(key) ?? 0) + g.count);
        break;
      }
      case 'item': {
        if (items.has(g.uid)) return 'That item was handed in twice.';
        items.add(g.uid);
        const h = here.find((x) => x.id === g.from);
        if (!h?.inventory.bag.some((i) => i.uid === g.uid)) return 'That item isn’t in their bag.';
        break;
      }
      case 'caps':
        caps += g.count;
        break;
    }
  }
  for (const [key, n] of resources) {
    const [from, id] = key.split('|') as [HikerId, ResourceId];
    const h = here.find((x) => x.id === from);
    if (!h) return 'Only hikers on this tile can hand things in.';
    if ((h.inventory.resources[id] ?? 0) < n) {
      const name = RESOURCES.find((r) => r.id === id)?.name ?? id;
      return `${h.name} doesn’t have ${n} ${name}.`;
    }
  }
  for (const [key, n] of stats) {
    const [from, stat] = key.split('|') as [HikerId, StatName];
    const h = here.find((x) => x.id === from);
    if (!h) return 'Only hikers on this tile can hand things in.';
    if (stat === 'morale' && h.stats.morale <= 0) return `Morale 0: ${h.name} can’t give Morale.`;
    if (h.stats[stat] < n) return `${h.name} doesn’t have ${n} ${STAT_WORD[stat]}.`;
  }
  if (caps > state.caps) return 'The party purse doesn’t have that many caps.';
  return undefined;
}

export function validateResolve(state: GameState, action: ResolveAction): string | undefined {
  const open = state.challenge;
  if (!open) return 'There’s no challenge to finish.';
  if (!openCardDef(open)) return 'That card can’t be finished here.';
  const expected = challengeSections(state, open);
  const answered = (hikerId?: HikerId) =>
    action.sections.filter((s) => s.hikerId === hikerId).length === 1;
  if (action.sections.length !== expected.length || !expected.every((e) => answered(e.hikerId))) {
    return 'Every part of the challenge needs an answer.';
  }
  for (const s of action.sections) {
    if (!s.pay) {
      if (s.gifts.length) return 'Nothing is spent when taking the penalty.';
      continue;
    }
    if (s.option === undefined) return 'Pick a way to pay.';
    const short = optionShortfall(state, open, s.option, s.gifts, s.hikerId);
    if (short) return short;
  }
  return ledgerProblem(state, open, action.sections);
}

function paidBy(here: readonly Hiker[], gifts: readonly Gift[]): ChallengePaid {
  const paid: ChallengePaid = { resources: [], items: [], caps: 0, stats: {} };
  for (const g of gifts) {
    if (g.kind === 'resource') for (let i = 0; i < g.count; i++) paid.resources.push(g.resource);
    if (g.kind === 'caps') paid.caps += g.count;
    if (g.kind === 'stat') paid.stats[g.stat] = (paid.stats[g.stat] ?? 0) + g.count;
    if (g.kind === 'item') {
      const item = here.find((h) => h.id === g.from)?.inventory.bag.find((i) => i.uid === g.uid);
      if (item) paid.items.push(item.itemId);
    }
  }
  return paid;
}

/** Stat costs paid for a challenge carry this cause, so the log can fold them in. */
export const paidCause = (cardName: string) => `${cardName}: paid`;

function spend(state: GameState, here: readonly Hiker[], gifts: readonly Gift[], cause: string) {
  for (const g of gifts) {
    if (g.kind === 'caps') {
      state.caps -= g.count;
      continue;
    }
    const h = here.find((x) => x.id === g.from);
    if (!h) continue;
    if (g.kind === 'resource') {
      const left = (h.inventory.resources[g.resource] ?? 0) - g.count;
      if (left > 0) h.inventory.resources[g.resource] = left;
      else delete h.inventory.resources[g.resource];
    } else if (g.kind === 'item') {
      h.inventory.bag = h.inventory.bag.filter((i) => i.uid !== g.uid);
    } else {
      changeStat(state, h, g.stat, -g.count, cause);
    }
  }
}

export function applyResolve(state: GameState, action: ResolveAction): void {
  const open = state.challenge;
  const card = open && openCardDef(open);
  if (!open || !card) throw new Error('applyResolve: no challenge open');
  const here = challengeHikers(state, open);
  const xp = BALANCE.challenges.passXpPerTier * open.tier;
  const targetsOf = (s: ChallengeSection) =>
    s.hikerId ? here.filter((h) => h.id === s.hikerId) : here;

  // The log line first, so the penalties that follow read in order.
  pushEvent(state, {
    kind: 'challenge',
    cardId: card.id,
    tileId: open.tileId,
    party: card.scope === 'party',
    results: action.sections.map((s) => ({
      ...(s.hikerId ? { hikerId: s.hikerId } : {}),
      passed: s.pay,
      ...(s.pay ? { paid: paidBy(here, s.gifts), xp } : {}),
    })),
  });

  for (const s of action.sections) if (s.pay) spend(state, here, s.gifts, paidCause(card.name));

  const entered: EffectResult['entered'] = [];
  const run = (targets: Hiker[]) => ({
    card,
    tileId: open.tileId,
    targets,
    onTile: here,
    rolls: open.rolls,
  });
  for (const s of action.sections) {
    const targets = targetsOf(s);
    if (s.pay) {
      for (const h of targets) h.xp += xp;
      if (card.reward?.length)
        entered.push(...applyEffects(state, run(targets), card.reward).entered);
    } else {
      entered.push(...applyEffects(state, run(targets), card.penalty).entered);
    }
  }

  delete state.challenge;
  // Hikers moved onto tiles nobody had landed on: those open next.
  // TODO(phase 5 step 3): the `triggers` result (Bear Country's Wildlife challenge).
  for (const e of entered) revealTile(state, e.tileId, e.hikerIds);
  openNext(state);
}
