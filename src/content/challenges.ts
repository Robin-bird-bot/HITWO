/**
 * Every challenge, Trial and opportunity, as data.
 *
 * - **Challenges** (Nov 26 evening reset, docs/design/24-challenges-reset.md,
 *   section 4): the 22 cost cards here, and the 45 minigame challenges in
 *   src/content/minigameChallenges.ts. Failing always costs something from
 *   one list of punishments, with the backup rule (section 2).
 * - **Opportunities and Trials** are still docs/design/04-challenges.md's.
 * - Card text drops [brackets] (game logic) and shows {names} as the rolled
 *   numbers. A Y shows as its range on the card, and as each hiker's own
 *   number in their section.
 * - Descriptions say "Placeholder text" until Wyatt writes them (descriptionPlaceholder).
 */
import { BALANCE } from '../config/balance';
import type { CardDef, ChallengeDef, Effect, TrialDef } from '../engine/challenges/types';
import {
  F,
  M,
  R,
  W,
  X,
  Y,
  ch,
  cond,
  idsOf,
  injury,
  items,
  lose,
  opt,
  res,
  trial,
  type ChallengeInput,
} from './cardBuilders';
import { COST_CARDS } from './costCards';
import { MINIGAME_CHALLENGES } from './minigameChallenges';

// ── Opportunities (Nov 6 update) ───────────────────────────────────────────
// Optional rewards: skipping one never costs anything. X ranges scale with the
// section's tier. Nodes are Wyatt's first guess.

const SLOTS = BALANCE.opportunities.slots;
const DAYS = BALANCE.opportunities.conditionDays;
const op = (input: Omit<ChallengeInput, 'kind' | 'penalty' | 'penaltyText'>): ChallengeDef =>
  ch({ ...input, kind: 'opportunity', penalty: [], penaltyText: [] });

const OPPORTUNITIES: ChallengeDef[] = [
  op({
    name: 'Citro Tub',
    tier: 1,
    nodes: 'any',
    scope: 'each',
    cost: [],
    spendAny: {
      what: { stat: 'energy' },
      readout: 'statAfter',
      thresholds: [
        // Citro Drink is switched off (Phase 10.6): Trail Mix instead. TODO(wyatt): or another food?
        { atMost: 6, effects: [{ op: 'gainItem', itemId: 'trailMix' }] },
        { atMost: 3, effects: [cond('energized', DAYS, 'days')] },
      ],
    },
    costText: ['Each hiker may spend any amount of Energy.'],
    rewardText: [
      'Ending at 6 Energy or less: a Trail Mix (food card). Ending at 3 or less: also Energized.',
    ],
  }),
  op({
    name: 'Mysterious Berries',
    tier: 1,
    nodes: [F],
    scope: 'select',
    rolls: { appetite: Y(1, 6) },
    cost: [],
    costText: ['Pick who eats the berries.'],
    reward: [
      { op: 'stat', stat: 'appetite', delta: 'appetite' },
      { op: 'randomCondition', duration: DAYS, unit: 'days', chance: 0.5 },
    ],
    rewardText: [
      'Each one gains {appetite} Appetite, with a 50% chance to gain a random negative condition.',
    ],
  }),
  op({
    name: 'Secret Tunnel',
    tier: 1,
    nodes: [M],
    scope: 'select',
    moves: true,
    cost: [],
    costText: ['Pick who goes through the tunnel.'],
    reward: [{ op: 'move', how: 'tunnel' }],
    rewardText: [
      'They move together to a random tile in the next row up, at no Appetite cost. That tile’s challenge triggers.',
    ],
  }),
  op({
    name: 'Nap Time',
    tier: 1,
    nodes: 'any',
    scope: 'select',
    cost: [],
    costText: ['Pick who takes a nap.'],
    reward: [{ op: 'stat', stat: 'energy', delta: 2 }, cond('napping', 1, 'phases')],
    rewardText: [
      'Each one gains 2 Energy, but next phase they can’t move, be moved, scavenge, Tend or craft.',
    ],
  }),
  op({
    name: 'Airlift',
    tier: 1,
    nodes: 'any',
    scope: 'select',
    anyTile: true,
    moves: true,
    cost: [],
    costText: ['Pick hikers on any tile to fly back to the start of this biome.'],
    reward: [
      { op: 'move', how: 'trailhead' },
      { op: 'cureInjury', count: 1 },
      { op: 'cureConditions' },
      { op: 'refill', stat: 'appetite' },
    ],
    rewardText: ['Each one cures 1 injury and all conditions, and their Appetite refills.'],
  }),
  op({
    name: 'Abandoned Ranger Station',
    tier: 1,
    nodes: 'any',
    scope: 'each',
    rolls: { pct: X(65, 75) },
    cost: [],
    spendAny: {
      what: { stat: 'energy' },
      readout: 'tries',
      every: {
        n: 2,
        chance: 'pct',
        effects: [{ op: 'gainItem', itemTypes: ['tool', 'clothes'], orBlueprint: true }],
      },
    },
    costText: ['Each hiker may spend Energy to search the station.'],
    rewardText: [
      'For every 2 Energy spent, a {pct}% chance to find a random tool, clothing item or blueprint.',
    ],
  }),
  op({
    name: 'Snake Salesman',
    tier: 1,
    nodes: 'any',
    scope: 'party',
    cost: [],
    buttons: [
      {
        id: 'buy',
        label: 'BUY',
        per: 'party',
        max: 5,
        kind: 'buy',
        price: [0, 8],
        gives: [{ op: 'gainResources', count: 1 }],
      },
    ],
    costText: ['Press Buy up to 5 times. Each press costs a random 0–8 caps.'],
    rewardText: [
      '1 random resource each time. If the purse can’t cover the price, nothing happens.',
    ],
  }),
  op({
    name: 'Hikers Exchange',
    tier: 1,
    nodes: 'any',
    scope: 'party',
    cost: [],
    spendAny: {
      what: { resources: 'any' },
      readout: 'swaps',
      each: [{ op: 'gainResources', count: 1 }],
    },
    costText: ['Pick any number of resources to swap. Once only.'],
    rewardText: ['Each one is swapped for a random resource of any type.'],
  }),
  op({
    name: 'Old Trail Sign',
    tier: 1,
    nodes: 'any',
    scope: 'each',
    cost: [],
    spendAny: {
      what: { toolUses: true },
      max: 5,
      readout: 'peeks',
      each: [{ op: 'peekCard' }],
    },
    costText: ['Spend 1 use from a tool to peek at an unrevealed tile’s challenge. Up to 5 times.'],
    rewardText: ['Each use shows the card on a tile nobody has reached, without opening it.'],
  }),
  op({
    name: 'Old Firewatch Tower',
    tier: 1,
    nodes: [F, M],
    scope: 'each',
    rolls: { pct: X(15, 20) },
    cost: [],
    buttons: [
      { id: 'climb', label: 'REVEAL', per: 'hiker', kind: 'revealConnected', injury: 'pct' },
    ],
    costText: ['Climb the tower to reveal the challenge on any connected tile.'],
    rewardText: ['Each reveal has a {pct}% chance to give the climber an injury.'],
  }),
  op({
    name: 'Snake Slots',
    tier: 1,
    nodes: 'any',
    scope: 'each',
    cost: [],
    buttons: [
      {
        id: 'pull',
        label: 'PULL',
        per: 'hiker',
        // Wyatt, Nov 6: at most 5 pulls per hiker.
        max: 5,
        kind: 'slots',
        pay: [
          { stat: 'energy', amount: 2 },
          { stat: 'appetite', amount: 2 },
          { stat: 'morale', amount: 3 },
        ],
        table: [
          { weight: 2, label: 'a Tier III item!', effects: [{ op: 'gainItem', tier3: true }] },
          { weight: 3, label: 'a shelter', effects: [{ op: 'gainItem', itemType: 'shelter' }] },
          { weight: 7, label: 'a random item', effects: [{ op: 'gainItem' }] },
          {
            weight: 3,
            label: 'a lot of caps!',
            effects: [{ op: 'gainCaps', count: SLOTS.lotOfCaps }],
          },
          {
            weight: 10,
            label: 'several resources',
            effects: [{ op: 'gainResources', count: SLOTS.severalResources }],
          },
          { weight: 15, label: '1 random resource', effects: [{ op: 'gainResources', count: 1 }] },
          { weight: 30, label: 'a few caps', effects: [{ op: 'gainCaps', count: SLOTS.fewCaps }] },
          { weight: 30, label: 'nothing', effects: [] },
        ],
      },
    ],
    costText: ['Pull the lever: 2 Energy, 2 Appetite or 3 Morale a pull, up to 5 pulls each.'],
    rewardText: ['Anything from nothing to a Tier III item.'],
  }),
  op({
    name: 'Ruins',
    tier: 1,
    nodes: 'any',
    scope: 'party',
    cost: [opt(res(6, idsOf('wood', 'stone', 'metal', 'clay')))],
    costText: ['Spend 6 Wood, Stone, Metal or Clay (any mix).'],
    reward: [{ op: 'placeShelter' }],
    rewardText: ['Build a random shelter on this tile.'],
  }),
  op({
    name: 'Predator’s Den',
    tier: 1,
    nodes: [W],
    scope: 'each',
    cost: [],
    buttons: [
      {
        id: 'den',
        label: '+1 APPETITE',
        per: 'hiker',
        max: 3,
        kind: 'raiseRandom',
        gives: [{ op: 'stat', stat: 'appetite', delta: 1 }],
      },
    ],
    costText: ['Each hiker may gain 1 Appetite, up to 3 times.'],
    rewardText: [
      'Each time, a random unrevealed tile in this biome gets a challenge 1 tier higher.',
    ],
  }),
  op({
    name: 'Predator Bait',
    tier: 1,
    nodes: [W],
    scope: 'party',
    cost: [],
    buttons: [{ id: 'bait', label: 'SET BAIT', per: 'party', max: 3, kind: 'shiftTiers' }],
    costText: ['Press up to 3 times.'],
    rewardText: [
      'Each press lowers one random unrevealed tile’s challenge by 1 tier and raises another’s by 1 tier.',
    ],
  }),
  op({
    name: 'Hungry Animals',
    tier: 1,
    nodes: [W, F],
    scope: 'party',
    cost: [],
    spendAny: {
      what: { items: 'food' },
      max: 3,
      readout: 'luck',
      each: [{ op: 'tileLuck', amount: 2 }],
    },
    costText: ['Spend up to 3 food cards.'],
    rewardText: ['Each one gives +2 Luck when scavenging on this tile until morning.'],
  }),
  op({
    name: 'Raccoon Friend',
    tier: 1,
    nodes: [F, W],
    scope: 'one',
    rolls: { nights: X(2, 4) },
    cost: [opt(items(1, 'food'))],
    costText: ['One hiker spends 1 food card.'],
    reward: [cond('raccoonFriend', 'nights', 'nights')],
    rewardText: [
      'For the next {nights} nights, a 75% chance each night to receive a random resource.',
    ],
  }),
  op({
    name: 'Mysterious Pill',
    tier: 1,
    nodes: 'any',
    scope: 'select',
    cost: [],
    costText: ['Pick who takes the pill.'],
    reward: [
      {
        op: 'randomCondition',
        duration: DAYS,
        unit: 'days',
        from: [
          'sleepy',
          'nauseous',
          'bored',
          'blind',
          'brainFog',
          'ringingEars',
          'refreshed',
          'full',
          'energized',
          'sated',
          'lucky',
          'motivated',
        ],
      },
    ],
    rewardText: ['Each one gains a random condition for 1 day, good or bad.'],
  }),
];

// ── Trials ──────────────────────────────────────────────────────────────────

const roccoRewards = (condition: string) => [
  { withinDays: 1, effects: [{ op: 'gainItem' }, cond(condition, 1, 'days')] as Effect[] },
  { withinDays: 2, effects: [{ op: 'gainResources', count: 3 }] as Effect[] },
  { withinDays: 3, effects: [{ op: 'gainCaps', count: 'caps' }] as Effect[] },
];

const TRIAL_LIST: TrialDef[] = [
  trial({
    name: 'Incoming Bike',
    tier: 1,
    nodes: 'any',
    gates: ['dogOnTile'],
    rolls: { morale: Y(1, 3) },
    goal: { kind: 'leaveTile', who: 'dogs' },
    deadline: { until: 'endOfNextPhase' },
    goalText: ['Every Dog leaves this tile by the end of the next phase.'],
    penalty: [lose('morale', 'morale'), injury({ chance: 0.25 })],
    penaltyText: [
      'Each hiker on this tile loses {morale} Morale and has a 25% chance to gain 1 injury.',
    ],
  }),
  trial({
    name: 'Jogger',
    tier: 1,
    nodes: 'any',
    rolls: { days: Y(1, 2) },
    goal: { kind: 'skipAction' },
    deadline: { until: 'endOfNextPhase' },
    goalText: ['Each hiker on this tile skips their next action.'],
    penalty: [cond('buzzed', 'days', 'days')],
    penaltyText: ['Each hiker who acts anyway becomes Buzzed for {days} days.'],
  }),
  trial({
    name: 'Allergy Season',
    tier: 1,
    nodes: [F, W],
    rolls: { days: Y(1, 2) },
    goal: { kind: 'leaveTile', who: 'all' },
    deadline: { until: 'nextMorning' },
    goalText: ['Every hiker leaves this tile before the next Morning.'],
    penalty: [cond('allergies', 'days', 'days', { node: 'tile' })],
    penaltyText: [
      'Each hiker still here gets Allergies (a random node on this tile) for {days} days.',
    ],
  }),
  trial({
    name: 'Train!!',
    tier: 1,
    nodes: 'any',
    goal: { kind: 'leaveTile', who: 'all' },
    deadline: { until: 'endOfNextPhase' },
    goalText: ['Every hiker leaves this tile by the end of the next phase.'],
    penalty: [injury()],
    penaltyText: ['Each hiker still here gains 1 injury.'],
  }),
  trial({
    name: 'Ants Are Marching',
    tier: 1,
    nodes: [F, W],
    goal: { kind: 'leaveTile', who: 'all' },
    deadline: { phases: 2 },
    goalText: ['Every hiker leaves this tile within 2 phases.'],
    penalty: [{ op: 'loseFood', mode: 'all' }],
    penaltyText: ['Each hiker still here loses every food card they carry.'],
  }),
  trial({
    name: 'Mold Invasion',
    tier: 1,
    nodes: [F, R],
    rolls: { days: X(1, 2), sick: Y(1, 2) },
    goal: { kind: 'noEatHere' },
    deadline: { days: 'days' },
    goalText: ['No hiker on this tile eats for {days} days.'],
    penalty: [cond('foodPoisoning', 'sick', 'days')],
    penaltyText: ['Each hiker who eats gets Food Poisoning for {sick} days.'],
  }),
  trial({
    name: 'Frozen Fingers',
    tier: 1,
    nodes: [M],
    goal: { kind: 'off', waitingOn: 'phase 6 (Sitting by the Fire)' },
    deadline: { days: 1 },
    goalText: ['Each hiker on this tile Sits by the Fire, or sleeps on a tile with a shelter.'],
    penalty: [cond('inept', 1, 'days'), cond('clumsy', 1, 'days')],
    penaltyText: ['Until they do, they’re Inept and Clumsy.'],
  }),
  trial({
    name: 'The Grim Sleeper!',
    tier: 1,
    nodes: [F, M],
    rolls: { nights: Y(1, 2) },
    goal: { kind: 'noSleepNear' },
    deadline: { until: 'nextMorning' },
    goalText: ['Tonight, no hiker sleeps on this tile or any tile next to it.'],
    penalty: [cond('nightmares', 'nights', 'nights'), injury()],
    penaltyText: ['Each hiker who does gets Nightmares for {nights} nights and gains 1 injury.'],
  }),
  trial({
    name: 'Rising Fog',
    tier: 1,
    nodes: 'any',
    rolls: { phases: X(2, 4, true), days: X(1, 2) },
    goal: { kind: 'together' },
    deadline: { phases: 'phases' },
    goalText: ['Within {phases} phases, the whole party is together on one tile.'],
    penalty: [cond('blind', 'days', 'days')],
    penaltyText: ['Every hiker becomes Blind for {days} days.'],
  }),
  trial({
    name: 'High Water Warning',
    tier: 1,
    nodes: [R],
    rolls: { phases: X(1, 3, true), days: X(1, 2), lose: Y(1, 2) },
    goal: { kind: 'offNode', node: R },
    deadline: { phases: 'phases' },
    goalText: ['Within {phases} phases, no hiker is on a tile with a River node.'],
    penalty: [cond('wet', 'days', 'days'), { op: 'loseResources', count: 'lose', from: 'hiker' }],
    penaltyText: [
      'Each hiker still on one becomes Wet for {days} days and loses {lose} resources.',
    ],
  }),
  trial({
    name: 'Spreading Plague',
    tier: 1,
    nodes: 'any',
    rolls: { days: X(1, 2) },
    goal: { kind: 'apart' },
    deadline: { until: 'night' },
    goalText: ['By night, no two hikers share a tile.'],
    penalty: [cond('nauseous', 'days', 'days'), cond('foodPoisoning', 'days', 'days')],
    penaltyText: [
      'Each hiker sharing a tile becomes Nauseous and gets Food Poisoning for {days} days.',
    ],
  }),
  trial({
    name: 'Rocco Raccoon’s Running Trial',
    tier: 1,
    nodes: 'any',
    rolls: { caps: X(2, 4, true) },
    goal: { kind: 'roccoReach' },
    deadline: { days: 4 },
    goalText: [
      'A random tile with no hiker on it is marked in red. Each hiker who reaches it earns rewards, which stack.',
    ],
    stagedRewards: roccoRewards('refreshed'),
    rewardText: [
      'Within 1 day: a random item and Refreshed for 1 day. Within 2 days: 3 random resources. Within 3 days: {caps} caps.',
    ],
    penalty: [{ op: 'randomCondition', duration: 1, unit: 'days' }],
    penaltyText: [
      'Not reached within 4 days: a random negative condition. Reaching a checkpoint first means no penalty.',
    ],
  }),
  trial({
    name: 'Rocco Raccoon’s Resource Trial',
    tier: 1,
    nodes: 'any',
    rolls: { caps: X(2, 4, true) },
    goal: { kind: 'roccoScavenge' },
    deadline: { days: 4 },
    goalText: [
      'Picks a random resource. Each hiker who scavenges it (not trades for it or already has it) earns rewards, which stack.',
    ],
    stagedRewards: roccoRewards('full'),
    rewardText: [
      'Within 1 day: a random item and Full for 1 day. Within 2 days: 3 random resources. Within 3 days: {caps} caps.',
    ],
    penalty: [{ op: 'randomCondition', duration: 1, unit: 'days' }],
    penaltyText: [
      'Not done within 4 days: a random negative condition. Reaching a checkpoint first means no penalty.',
    ],
  }),
  trial({
    name: 'Rocco Raccoon’s Rebuilding Trial',
    tier: 1,
    nodes: 'any',
    rolls: { caps: X(2, 4, true) },
    goal: { kind: 'roccoCraft' },
    deadline: { days: 4 },
    goalText: [
      'Picks a random item type. Each hiker who crafts an item of that type earns rewards, which stack.',
    ],
    stagedRewards: roccoRewards('lucky'),
    rewardText: [
      'Within 1 day: a random item and Lucky for 1 day. Within 2 days: 3 random resources. Within 3 days: {caps} caps.',
    ],
    penalty: [{ op: 'randomCondition', duration: 1, unit: 'days' }],
    penaltyText: [
      'Not done within 4 days: a random negative condition. Reaching a checkpoint first means no penalty.',
    ],
  }),
  trial({
    name: 'Rockslide!',
    tier: 1,
    nodes: [M],
    rolls: { chance: X(20, 35) },
    goal: { kind: 'leaveTile', who: 'all' },
    deadline: { until: 'endOfNextPhase' },
    goalText: ['Every hiker leaves this tile by the end of the next phase.'],
    penalty: [injury({ chance: 'chance' })],
    penaltyText: ['Each hiker still here has a {chance}% chance to gain an injury.'],
  }),
  trial({
    name: 'Stampede',
    tier: 1,
    nodes: [W],
    rolls: { energy: Y(1, 3) },
    goal: { kind: 'apart' },
    deadline: { until: 'endOfNextPhase' },
    goalText: ['End the next phase with no two hikers on the same tile.'],
    penalty: [lose('energy', 'energy')],
    penaltyText: ['Each hiker sharing a tile loses {energy} Energy.'],
  }),
  trial({
    name: 'Bee Trouble',
    tier: 1,
    nodes: [F],
    rolls: { days: Y(1, 2) },
    goal: { kind: 'reachShelterOrNode', node: R },
    deadline: { phases: 2 },
    goalText: ['Within 2 phases, reach a tile with a shelter, a Campsite or a River node.'],
    penalty: [cond('allergies', 'days', 'days', { node: F })],
    penaltyText: ['Allergies (Forest) for {days} days.'],
  }),
  trial({
    name: 'Ranger’s Request',
    tier: 1,
    nodes: 'any',
    rolls: { pay: X(0, 4, true) },
    goal: { kind: 'rangerRequest', pay: 'pay' },
    deadline: { phases: 4 },
    goalText: [
      'Picks a resource type. After 4 phases, takes all resources of that type gathered since the trial started and pays {pay} caps for each one.',
    ],
    penalty: [],
    penaltyText: ['No failure, but a 0 roll means giving them up for nothing.'],
  }),
  trial({
    name: 'Storm Coming',
    tier: 2,
    nodes: 'any',
    gates: ['afternoon'],
    rolls: { days: Y(1, 2) },
    goal: { kind: 'underShelter' },
    deadline: { until: 'night' },
    goalText: ['Before night, every hiker on this tile is under a shelter.'],
    penalty: [cond('soaked', 2, 'phases', { then: { id: 'wet', duration: 'days', unit: 'days' } })],
    penaltyText: ['Soaked for 2 phases, then Wet for {days} days.'],
  }),
  trial({
    name: 'Smoke on the Wind',
    tier: 2,
    nodes: [F],
    rolls: { days: Y(1, 2) },
    goal: { kind: 'rowForward' },
    deadline: { days: 1 },
    goalText: ['Within 1 day, every hiker moves at least 1 row forward.'],
    penalty: [cond('sleepy', 'days', 'days'), cond('brainFog', 'days', 'days')],
    penaltyText: ['Sleepy and Brain Fog for {days} days.'],
  }),
  trial({
    name: 'Overfished',
    tier: 2,
    nodes: [R],
    rolls: { gain: X(3, 4) },
    goal: { kind: 'abundanceRise', by: 'gain' },
    deadline: { days: 2 },
    goalText: ['Within 2 days, Abundance rises by {gain} (Tend helps).'],
    penalty: [{ op: 'nodesVanish', chance: 0.25, where: 'trail', node: R }],
    penaltyText: ['Each River node on this trail has a 25% chance to disappear.'],
  }),
  trial({
    name: 'Thirsty Trail',
    tier: 2,
    nodes: [M],
    rolls: { lose: Y(2, 3) },
    goal: { kind: 'endOnNode', node: R },
    deadline: { phases: 3 },
    goalText: ['Within 3 phases, every hiker ends a phase on a tile with a River node.'],
    penalty: [lose('appetite', 'lose'), cond('inappetent', 1, 'days')],
    penaltyText: ['Lose {lose} Appetite and become Inappetent for 1 day.'],
  }),
  trial({
    name: 'Cold Snap',
    tier: 2,
    nodes: [M],
    goal: { kind: 'energyTogether', atLeast: 15 },
    deadline: { until: 'night' },
    goalText: [
      'By night, each hiker is on a tile where the hikers there have 15 or more Energy combined.',
    ],
    penalty: [cond('frozen', 1, 'phases')],
    penaltyText: ['Frozen for 1 phase.'],
  }),
  trial({
    name: 'Bear Country',
    tier: 2,
    nodes: [W],
    goal: { kind: 'noCraftHere' },
    deadline: { until: 'nextMorning' },
    goalText: ['Until morning, no one on this tile crafts or sits by the fire.'],
    penalty: [{ op: 'trigger', tier: 2, node: W }],
    penaltyText: ['A Tier II Wildlife challenge triggers on this tile.'],
  }),
  trial({
    name: 'Avalanche Warning',
    tier: 3,
    nodes: 'any',
    gates: ['snow'],
    goal: { kind: 'leaveRow' },
    deadline: { phases: 2 },
    goalText: ['Every hiker leaves this row within 2 phases.'],
    penalty: [injury()],
    penaltyText: ['Each hiker still on the row gains 1 injury.'],
  }),
];

export const CHALLENGES: readonly ChallengeDef[] = [...COST_CARDS, ...MINIGAME_CHALLENGES];

/**
 * The Trials (switched off since Phase 10.6). Several share a name with a
 * card in the Nov 26 list (Train!, Stampede!, Cold Snap…): those Trials get
 * "-trial" on their id, and keep their art.
 */
const TRIALS: readonly TrialDef[] = TRIAL_LIST.map((t) =>
  CHALLENGES.some((c) => c.id === t.id) ? { ...t, id: `${t.id}-trial`, artFile: t.id } : t,
);
export { OPPORTUNITIES, TRIALS };
export { slug } from './cardBuilders';

/** Every card by id. */
export const CARDS: Readonly<Record<string, CardDef>> = Object.fromEntries(
  [...CHALLENGES, ...OPPORTUNITIES, ...TRIALS].map((c) => [c.id, c]),
);
