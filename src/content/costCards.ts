/**
 * The 18 cost cards (docs/design/24-challenges-reset.md, section 4, "Cost
 * cards"): basic problems on the trail. (There were 22: Incoming Bike!,
 * Wrong Turn, Fallen Branch and Snagged Pack are minigames now.) When one
 * is revealed, the hikers it judges pay its cost or take its punishment.
 *
 * - **Party** cards are paid once, by anyone on the tile; **each-hiker**
 *   cards judge every hiker on their own (others can chip in).
 * - Tier I cards use only general costs; categories start at Tier II; named
 *   resources and items only at Tier III, always with another way to pay.
 * - Cost numbers are written for the card's "From" tier and scale up by
 *   tierScale above it. Punishments (X, Y) come from the punishment table at
 *   the tile's tier, with the backup rule.
 * - "Art for now" reuses Wyatt's old challenge art (`artFile`); a card with
 *   none yet shows a plain panel.
 * - Every cost, node, "From" tier and punishment is Claude's guess or
 *   Wyatt's first guess. TODO(wyatt): pick them after playtesting.
 */
import type { ChallengeDef } from '../engine/challenges/types';
import {
  F,
  M,
  R,
  W,
  X,
  Y,
  caps,
  cond,
  durability,
  idsOf,
  items,
  listed,
  opt,
  P,
  res,
  stat,
} from './cardBuilders';

/**
 * Every challenge is a minigame now (29-core-loop.md, section 6; Wyatt:
 * "Honestly the minigames are much more fun… every challenge is a
 * minigame"): the cost cards are switched off, their data kept so they can
 * come back as minigames or opportunities. Incoming Bike!, Wrong Turn, Fallen
 * Branch and Snagged Pack came back as quick minigames
 * (30-quick-minigames.md) in src/content/minigameChallenges.ts, so their
 * cards are gone from here.
 */
const off = (card: ChallengeDef): ChallengeDef => ({ ...card, enabled: false });

export const COST_CARDS: readonly ChallengeDef[] = [
  // ── Tier I ──
  listed({
    name: 'Blisters',
    art: false,
    tier: 1,
    nodes: 'any',
    scope: 'each',
    cost: [opt(res(1, undefined, { most: true })), opt(stat(2, 'appetite'))],
    costText: ['Spend 1 of the resource you have the most of, or 2 Appetite.'],
    penalty: [P.energy, cond('sluggish', 1, 'phases')],
    penaltyText: ['If failed: lose {x} Energy, and Sluggish for 1 phase.'],
  }),
  listed({
    name: 'Thirsty Trail',
    art: true,
    tier: 1,
    nodes: 'any',
    scope: 'party',
    cost: [opt(res({ base: 1, per: 'hikerOnTile' }, undefined, { most: true }))],
    costText: ['Spend 1 of the party’s most for each hiker here (traded for water).'],
    penalty: [P.appetite],
    penaltyText: ['If not: every hiker loses {x} Appetite.'],
  }),
  listed({
    name: 'Heavy Pack',
    art: true,
    artFile: 'rocky-path',
    tier: 1,
    nodes: [M],
    scope: 'each',
    rolls: { phases: Y(2, 2) },
    // Rocky Path's old rule. TODO(wyatt): [6].
    cost: [opt({ kind: 'carryLimit', max: 6 })],
    costText: ['Carry no more than 6 resources. Spend the extras to pass.'],
    penalty: [P.energy, cond('sluggish', 'phases', 'phases')],
    penaltyText: ['If failed: lose {x} Energy, and Sluggish for {phases} phases.'],
  }),
  listed({
    name: 'Sunburn',
    art: true,
    artFile: 'blazing-sun',
    tier: 1,
    nodes: [M, R],
    scope: 'each',
    who: 'noClothing',
    cost: [opt(res(2, undefined, { same: true })), opt(items(1, 'food'))],
    costText: ['Each hiker with no clothing on spends 2 of the same resource, or 1 food card.'],
    penalty: [P.energy],
    penaltyText: ['If failed: lose {x} Energy.'],
  }),
  listed({
    name: 'Upset Stomach',
    art: false,
    tier: 1,
    nodes: 'any',
    scope: 'each',
    cost: [opt(items(1, 'food')), opt(res(2, undefined, { same: true }))],
    costText: ['Spend 1 food card, or 2 of the same resource.'],
    penalty: [P.appetite, cond('nauseous', 1, 'days')],
    penaltyText: ['If failed: lose {x} Appetite, and Nauseous for 1 day.'],
  }),
  listed({
    name: 'Splinter',
    art: false,
    tier: 1,
    nodes: [F],
    scope: 'each',
    cost: [opt({ kind: 'toolUse', count: 1 }), opt(res(1, undefined, { most: true }))],
    costText: ['Spend 1 tool use, or 1 of the resource you have the most of.'],
    penalty: [P.bleeding],
    penaltyText: ['If failed: Bleeding for {y} phases.'],
  }),
  listed({
    name: 'Fox with a Specific Taste',
    art: true,
    tier: 1,
    nodes: [W, F],
    scope: 'party',
    // Picked from your packs (Wyatt): X resources the hikers here carry; 1 of each.
    rolls: { options: X(3, 3), lose: X(3, 3) },
    cost: [opt(res('options', { randomOf: 'options' }, { distinct: true }))],
    costText: ['It wants {options} resources you carry: spend 1 of each.'],
    penalty: [{ op: 'loseResources', count: 'lose', from: 'party' }],
    penaltyText: ['If not: lose {lose} random resources across the party.'],
  }),
  listed({
    name: 'Tummy Rumbling',
    art: true,
    tier: 1,
    nodes: 'any',
    scope: 'party',
    rolls: { hunger: Y(2, 3) },
    cost: [
      opt(items({ base: 1, per: 'twoHikersOnTile' }, 'food')),
      opt(res({ base: 1, per: 'hikerOnTile' }, undefined, { most: true })),
    ],
    costText: [
      'Spend 1 food card for every 2 hikers, or 1 of the party’s most for each hiker here.',
    ],
    penalty: [{ op: 'stat', stat: 'appetite', delta: 'hunger', lose: true }],
    penaltyText: ['If not: every hiker loses {hunger} Appetite.'],
  }),
  listed({
    name: 'Tourist Trap',
    art: true,
    tier: 1,
    nodes: 'any',
    scope: 'each',
    rolls: { n: X(1, 2) },
    cost: [opt(caps('n'))],
    costText: ['Spend {n} caps from the party purse.'],
    penalty: [P.back, { op: 'stat', stat: 'energy', delta: 1, lose: true }],
    penaltyText: ['If failed: go back, and lose 1 Energy.'],
  }),
  listed({
    name: 'Black Cat',
    art: true,
    tier: 1,
    nodes: [F, W],
    scope: 'each',
    // Singles (Wyatt): every resource you only have 1 of.
    cost: [opt(res(1, undefined, { singles: true }))],
    costText: ['Spend every resource you only have 1 of.'],
    penalty: [P.random, cond('unlucky', 1, 'days')],
    penaltyText: ['If failed: lose {x} random resources, and Unlucky for 1 day.'],
    reward: [cond('lucky', 1, 'days', { chance: 0.5 })],
    rewardText: ['If passed: a 50% chance to be Lucky for 1 day.'],
  }),

  // ── Tier II (categories from here) ──
  listed({
    name: 'Rolled Ankle',
    art: true,
    artFile: 'steep-trail',
    tier: 2,
    nodes: [M, F],
    scope: 'each',
    rolls: { n: X(2, 2) },
    cost: [opt(res('n', { categories: ['fiber'] })), opt(stat(3, 'energy'))],
    costText: ['Spend {n} Fiber (a wrap), or 3 Energy.'],
    penalty: [P.injury],
    penaltyText: ['If failed: 1 injury.'],
  }),
  listed({
    name: 'Cold Snap',
    art: true,
    tier: 2,
    nodes: [M, R],
    scope: 'each',
    rolls: { n: X(2, 2) },
    cost: [opt(res('n', { categories: ['fire'] })), opt(durability(2, { oneItem: true }))],
    costText: ['Spend {n} Fire, or 2 durability from one clothing item.'],
    penalty: [P.energy, cond('frozen', 1, 'phases')],
    penaltyText: ['If failed: lose {x} Energy, and Frozen for 1 phase.'],
  }),
  listed({
    name: 'Allergy Season',
    art: true,
    tier: 2,
    nodes: [F, W],
    scope: 'each',
    rolls: { n: X(2, 2) },
    cost: [opt(res('n', { categories: ['fiber'] })), opt(items(1, 'food'))],
    costText: ['Spend {n} Fiber, or 1 food card.'],
    penalty: [P.energy, cond('allergies', 1, 'days', { node: 'tile' })],
    penaltyText: ['If failed: lose {x} Energy, and Allergies (this tile’s node) for 1 day.'],
  }),
  listed({
    name: 'Bug Bites',
    art: true,
    artFile: 'mosquito-swarm',
    tier: 2,
    nodes: [R, F],
    scope: 'each',
    rolls: { n: X(2, 2) },
    cost: [opt(res('n', { categories: ['fire'] })), opt(res(2, undefined, { same: true }))],
    costText: ['Spend {n} Fire (smoke them off), or 2 of the same resource.'],
    penalty: [P.appetite, cond('clumsy', 1, 'days')],
    penaltyText: ['If failed: lose {x} Appetite, and Clumsy for 1 day.'],
  }),
  listed({
    name: 'Crow Collector',
    art: true,
    tier: 2,
    nodes: [W, M],
    scope: 'each',
    rolls: { n: X(2, 2), same: X(2, 3) },
    cost: [
      opt(res('n', { categories: ['trinkets'] })),
      opt(res('same', undefined, { same: true })),
    ],
    costText: ['Spend {n} Trinkets, or {same} of the same resource.'],
    penalty: [{ op: 'loseItem', mode: 'randomUnequipped', orResources: 'x' }],
    penaltyText: ['If failed: lose 1 random unequipped item (with none: {x} random resources).'],
  }),

  // ── Tier III (a named resource or item, always with another way) ──
  listed({
    name: 'Frozen Fingers',
    art: true,
    tier: 3,
    nodes: 'any',
    gates: ['snow'],
    scope: 'each',
    rolls: { n: X(2, 3) },
    cost: [opt(res('n', { categories: ['fire'] })), opt(durability(3))],
    costText: ['Spend {n} Fire, or 3 clothing durability.'],
    penalty: [P.singles, cond('butterfingers', 1, 'days')],
    penaltyText: [
      'If failed: lose every resource you only have 1 of (dropped), and Butterfingers for 1 day.',
    ],
  }),
  listed({
    name: 'Lost Map',
    art: true,
    artFile: 'rangers-request',
    tier: 3,
    nodes: 'any',
    scope: 'party',
    rolls: { n: X(4, 6) },
    cost: [opt({ kind: 'items', count: 1, itemIds: ['supplyMap', 'treasureMap'] }), opt(caps('n'))],
    costText: ['Spend 1 map (Supply Map or Treasure Map), or {n} caps.'],
    penalty: [P.back, P.energy],
    penaltyText: ['If not: everyone goes back, and loses {x} Energy.'],
  }),
  listed({
    name: 'Leeches',
    art: true,
    tier: 3,
    nodes: [R],
    scope: 'each',
    rolls: { n: X(2, 2) },
    cost: [
      opt(res(1, idsOf('salt'))),
      opt(res('n', { categories: ['fire'] })),
      opt(stat(3, 'energy')),
    ],
    costText: ['Spend 1 Salt, or {n} Fire (burn them off), or 3 Energy.'],
    penalty: [P.bleeding, cond('weak', 1, 'days')],
    penaltyText: ['If failed: Bleeding for {y} phases, and Weak for 1 day.'],
  }),
].map(off);
