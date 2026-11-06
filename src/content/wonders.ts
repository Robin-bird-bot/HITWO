/**
 * The 7 Wonders (04-challenges.md, "Wonders"). Each has 5 goals, of which 3
 * are picked when it's revealed, and 3 rewards, of which each hiker on the
 * tile picks 1. Numbers marked X in the doc scale by biome (see GoalNumber).
 *
 * Goals that need a later system are marked `waitingOn` and never picked yet
 * (Wyatt, Nov 6). Every Wonder still has 4 or 5 goals to pick from.
 */
import { BALANCE } from '../config/balance';
import type { WonderDef, WonderRewardDef } from '../engine/wonders/types';

const X = (base: number, compare: 'atLeast' | 'atMost' | 'moreThan' = 'atLeast') => ({
  base,
  compare,
});
/** A number the doc writes without an X: it doesn't scale by biome. */
const fixed = (base: number, compare: 'atLeast' | 'lessThan' = 'atLeast') => ({
  base,
  compare,
  scales: false as const,
});

const TIER_3: WonderRewardDef = {
  title: 'Pick 1 of 3',
  text: 'Tier III items or traits, rolled when the Wonder was found. No doubles.',
  reward: { kind: 'tier3' },
};
const XP: WonderRewardDef = {
  title: 'Lots of XP',
  text: 'A big XP boost for that hiker.',
  reward: { kind: 'xp' },
};

export const WONDERS: readonly WonderDef[] = [
  {
    id: 'witchs-castle',
    name: 'Witch’s Castle',
    goals: [
      {
        text: 'The hikers here have {x} negative conditions between them.',
        check: { kind: 'conditions', which: 'negative' },
        x: X(3),
      },
      {
        text: 'The hikers here have {x} positive conditions between them.',
        check: { kind: 'conditions', which: 'positive' },
        x: X(1),
      },
      {
        text: 'The hikers here carry {x} Bones, Mushroom, Shell or Salt (any mix).',
        check: { kind: 'carryAny', resources: ['bones', 'mushroom', 'shell', 'salt'] },
        x: X(6),
      },
      {
        text: 'One hiker carries {x} of one of Bones, Mushroom, Shell or Salt.',
        check: { kind: 'oneCarriesOne', resources: ['bones', 'mushroom', 'shell', 'salt'] },
        x: X(3),
      },
      {
        text: 'The hikers here have {x} Morale combined.',
        check: { kind: 'statTotal', stat: 'morale' },
        x: fixed(5, 'lessThan'),
      },
    ],
    rewards: [
      {
        title: 'Bad to good',
        text: 'Every negative condition becomes a random positive one for 2 days.',
        reward: { kind: 'flipConditions', days: 2 },
      },
      TIER_3,
      XP,
    ],
  },
  {
    id: 'fort-rock',
    name: 'Fort Rock',
    goals: [
      {
        text: 'The hikers here carry {x} Stone, Clay, Meat or Wood (any mix).',
        check: { kind: 'carryAny', resources: ['stone', 'clay', 'meat', 'wood'] },
        x: X(6),
      },
      {
        text: '{x} shelters have been placed in this biome.',
        check: { kind: 'sheltersPlaced' },
        x: X(3),
      },
      {
        text: 'One hiker carries {x} Stone.',
        check: { kind: 'oneCarriesOne', resources: ['stone'] },
        x: X(5),
      },
      {
        text: 'One hiker here has failed {x} challenges.',
        check: { kind: 'counter', counter: 'failed' },
        x: X(3),
      },
      {
        text: 'The hikers here have {x} clothing durability between them.',
        check: { kind: 'waiting' },
        x: X(10),
        waitingOn: 'Phase 9 (clothing durability)',
      },
    ],
    rewards: [
      {
        title: '2 shelters',
        text: 'Gain 2 random shelter cards. At most 2 hikers can pick this.',
        reward: { kind: 'shelters', count: 2 },
        maxTakers: 2,
      },
      {
        title: 'Double durability',
        text: 'Double the current and maximum durability of one equipped clothing item.',
        reward: { kind: 'waiting' },
        waitingOn: 'Phase 9 (durability)',
      },
      XP,
    ],
  },
  {
    id: 'pittock-mansion',
    name: 'Pittock Mansion',
    goals: [
      {
        text: 'One hiker has 3 clothing items equipped.',
        check: { kind: 'waiting' },
        waitingOn: 'Phase 9 (equipping clothes)',
      },
      {
        text: 'The party has {x} caps.',
        check: { kind: 'caps' },
        x: X(BALANCE.wonders.pittockCaps),
      },
      {
        text: 'The hikers here carry {x} resources between them.',
        check: { kind: 'carryTotal' },
        x: X(20),
      },
      {
        text: 'One hiker has full Appetite, Energy and Morale.',
        check: { kind: 'fullStats' },
      },
      {
        text: 'The hikers here carry {x} shelter cards between them.',
        check: { kind: 'itemsOfType', type: 'shelter' },
        x: X(3),
      },
    ],
    rewards: [
      {
        title: 'Lots of caps',
        text: 'A big pile of acorn caps for the party purse.',
        reward: { kind: 'caps' },
      },
      TIER_3,
      XP,
    ],
  },
  {
    id: 'crater-lake',
    name: 'Crater Lake',
    goals: [
      {
        text: 'The hikers here carry {x} Grass, Fish, Oil or Flint (any mix).',
        check: { kind: 'carryAny', resources: ['grass', 'fish', 'oil', 'flint'] },
        x: X(6),
      },
      {
        text: 'River Abundance is {x}.',
        check: { kind: 'abundance', node: 'river' },
        x: fixed(10),
      },
      {
        text: 'Each hiker here carries {x} Fish.',
        check: { kind: 'eachCarries', resource: 'fish' },
        x: fixed(2),
      },
      {
        text: 'There’s a weather condition right now.',
        check: { kind: 'waiting' },
        waitingOn: 'Phase 6 (weather)',
      },
      {
        text: 'The hikers here carry {x} tools between them.',
        check: { kind: 'itemsOfType', type: 'tool' },
        x: X(5, 'atMost'),
      },
    ],
    rewards: [
      {
        title: '+5 Abundance',
        text: 'Raise one node type’s Abundance by 5 (your choice).',
        reward: { kind: 'abundance', amount: 5 },
      },
      TIER_3,
      XP,
    ],
  },
  {
    id: 'swiss-alps',
    name: 'Swiss Alps',
    goals: [
      {
        text: 'One hiker here has passed {x} challenges.',
        check: { kind: 'counter', counter: 'passed' },
        x: X(5),
      },
      { text: 'No hiker here has an injury.', check: { kind: 'noInjuries' } },
      {
        text: 'Every hiker here has {x} Morale.',
        check: { kind: 'eachStat', stat: 'morale' },
        x: fixed(9),
      },
      {
        // TODO(wyatt): this one doesn't scale by biome, since the party is only 4.
        text: '{x} hikers are on this tile.',
        check: { kind: 'hikersHere' },
        x: fixed(3),
      },
      {
        text: 'One hiker here is level {x}.',
        check: { kind: 'level' },
        x: X(2),
      },
    ],
    rewards: [
      { title: 'Heal up', text: 'Cure all injuries.', reward: { kind: 'cureInjuries' } },
      TIER_3,
      XP,
    ],
  },
  {
    id: 'multnomah-falls',
    name: 'Multnomah Falls',
    goals: [
      {
        text: 'One hiker has crafted {x} items of one type.',
        check: { kind: 'waiting' },
        x: X(3),
        waitingOn: 'Phase 9 (crafting)',
      },
      {
        text: 'One hiker here has 2 or less Morale and another has 8 or more.',
        check: { kind: 'spread', stat: 'morale', low: 2, high: 8 },
      },
      {
        text: 'Every hiker here has the same Appetite.',
        check: { kind: 'sameStat', stat: 'appetite' },
      },
      {
        text: 'One hiker carries {x} of the same resource.',
        check: { kind: 'oneCarriesOne' },
        x: X(5),
      },
      {
        text: 'One hiker carries {x} resources of every type (Forest, River, Wildlife and Mountain).',
        check: { kind: 'oneCarriesEachNode' },
        x: X(2),
      },
    ],
    rewards: [
      {
        title: 'See ahead',
        text: 'Reveal every challenge in this biome.',
        reward: { kind: 'revealBiome' },
      },
      TIER_3,
      XP,
    ],
  },
  {
    id: 'sleeping-giant',
    name: 'Sleeping Giant',
    goals: [
      {
        text: 'The hikers here have {x} Energy combined.',
        check: { kind: 'statTotal', stat: 'energy' },
        x: X(10, 'moreThan'),
      },
      {
        text: 'Every hiker here is Fatigued or Exhausted.',
        check: { kind: 'eachThreshold', states: ['fatigued', 'exhausted'] },
      },
      {
        text: 'The hikers here carry {x} Metal, Moss, Seaweed or Fur (any mix).',
        check: { kind: 'carryAny', resources: ['metal', 'moss', 'seaweed', 'fur'] },
        x: X(6),
      },
      {
        text: 'One hiker here has Brain Fog, Nightmares or Sleepy.',
        check: { kind: 'oneHasCondition', conditions: ['brainFog', 'nightmares', 'sleepy'] },
      },
      {
        text: 'One hiker here has gone {x} days without sleeping.',
        check: { kind: 'counter', counter: 'daysSinceSleep' },
        x: fixed(3),
      },
    ],
    rewards: [
      {
        title: 'Energized',
        text: 'Become Energized and gain 5 Energy.',
        // TODO(wyatt): the doc doesn't say how long Energized lasts here.
        reward: { kind: 'energized', energy: 5, days: 1 },
      },
      TIER_3,
      {
        title: '+2 max Energy',
        text: 'Permanently gain +2 maximum Energy.',
        reward: { kind: 'maxStat', stat: 'energy', amount: 2 },
      },
    ],
  },
];

export const WONDER_BY_ID: Readonly<Record<string, WonderDef>> = Object.fromEntries(
  WONDERS.map((w) => [w.id, w]),
);
