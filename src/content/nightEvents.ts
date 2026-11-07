/**
 * Night events (docs/design/05-nights-and-weather.md, "Night events"): the 3
 * tiers, their 15 creatures and the outcomes one of which hits each hiker.
 *
 * - Outcomes are effect-engine data (src/engine/challenges/applyEffects.ts),
 *   the same ops challenges use. `needs` says when one can apply; the night
 *   engine skips any that can't.
 * - Lines are templates. Every outcome has a generic one, and creatures can
 *   have their own. The lines are placeholders for Wyatt to rewrite.
 *
 * Template words: {Creature} and {creature} ("A bear", "a bear"), {hiker},
 * {X} (the number, as it actually happened), {s} ("s" unless X is 1),
 * {Condition} and {time} ("Bleeding", "3 phases"), {item} and {item2} (the
 * items touched), {other} (the hiker an item was swapped with), {stats} (the
 * stats actually lost: "−2 Energy, −1 Appetite").
 */
import { BALANCE } from '../config/balance';
import type { Effect } from '../engine/challenges/types';
import type { StatName } from '../engine/types';

export type NightTier = 1 | 2 | 3;

export interface NightCreature {
  id: string;
  tier: NightTier;
  /** The window's title. */
  name: string;
  /** How lines name it: "a bear", "the raccoons". */
  called: string;
  /** Lines of its own, by outcome id, or "outcome:condition" for one condition. */
  lines?: Readonly<Record<string, string>>;
  placeholder?: true;
}

/** When an outcome can apply. Any that can't is skipped for that hiker. */
export type NightNeed =
  | { kind: 'caps' }
  | { kind: 'resources' }
  | { kind: 'items' }
  | { kind: 'clothes' }
  | { kind: 'food' }
  | { kind: 'xp' }
  /** At least one of these stats above 0 (losing a stat at 0 does nothing). */
  | { kind: 'stat'; stats: readonly StatName[] }
  /** The hiker has a bag item, and so does a hiker on another tile. */
  | { kind: 'farItem' }
  /** A connected tile in the row behind, and the hiker can be moved. */
  | { kind: 'behind' }
  /** An injury outcome's condition: one of these stats at or below a value, alone or few on the tile. */
  | {
      kind: 'weak';
      stats: readonly StatName[];
      atMost: number;
      alone?: true;
      maxOnTile?: number;
    };

/** One of these conditions, picked at random (Wet, Unlucky or Clumsy). */
export interface NightCondition {
  id: string;
  /** A fixed time, or a range rolled for the hiker. */
  time: number | readonly [number, number];
  unit: 'days' | 'phases';
}

export interface NightOutcome {
  id: string;
  /** Its number, rolled for each hiker hit (the effects call it "X"). */
  x?: readonly [number, number];
  effects?: readonly Effect[];
  oneOf?: readonly NightCondition[];
  needs?: readonly NightNeed[];
  /** What {X} shows: what was actually taken, when it can be less than the roll. */
  counts?: 'resources' | 'caps' | 'items' | 'xp';
  line: string;
  chip: string;
  placeholder?: true;
}

const N = BALANCE.nightEvents;
const R = N.ranges;
const range = (key: string): readonly [number, number] => R[key] ?? [1, 1];

const has = (kind: 'caps' | 'resources' | 'items' | 'clothes' | 'food' | 'xp'): NightNeed => ({
  kind,
});
/** TODO(wyatt): an outcome that would only take stats already at 0 is skipped. */
const above0 = (...stats: StatName[]): NightNeed => ({ kind: 'stat', stats });
const lose = (stat: StatName): Effect => ({ op: 'stat', stat, delta: 'X', lose: true });

const TIER_1: readonly NightOutcome[] = [
  {
    id: 'swapResources',
    x: range('swapResources'),
    effects: [{ op: 'swapResources', count: 'X' }],
    needs: [has('resources')],
    counts: 'resources',
    line: '{Creature} rummaged through {hiker}’s pack and mixed up {X} resource{s}.',
    chip: '{X} resource{s} swapped',
  },
  {
    id: 'stealCaps',
    x: range('stealCaps'),
    effects: [{ op: 'loseCaps', count: 'X' }],
    needs: [has('caps')],
    counts: 'caps',
    line: '{Creature} stole {X} cap{s} from {hiker}.',
    chip: '−{X} cap{s}',
  },
  {
    id: 'stealResources',
    x: range('stealResources'),
    effects: [{ op: 'loseResources', count: 'X', from: 'hiker' }],
    needs: [has('resources')],
    counts: 'resources',
    line: '{Creature} stole {X} resource{s} from {hiker}.',
    chip: '−{X} resource{s}',
  },
  {
    id: 'loseMorale',
    x: range('loseMorale'),
    effects: [lose('morale')],
    needs: [above0('morale')],
    line: '{Creature} kept {hiker} up all night.',
    chip: '{stats}',
  },
  {
    id: 'wearOne',
    effects: [{ op: 'wearClothes', which: 'one', amount: 1 }],
    needs: [has('clothes')],
    line: '{Creature} tore {hiker}’s {item}.',
    chip: '−1 durability',
  },
  {
    id: 'foodOne',
    effects: [{ op: 'foodAppetite', delta: -1, which: 'one' }],
    needs: [has('food')],
    line: '{Creature} nibbled {hiker}’s {item}.',
    chip: '{item} −1 Appetite',
  },
  {
    id: 'swapItemFar',
    effects: [{ op: 'swapItemFar' }],
    needs: [{ kind: 'farItem' }],
    line: '{Creature} swapped {hiker}’s {item} for {other}’s {item2}.',
    chip: 'Item swapped',
  },
  {
    id: 'loseXp',
    x: range('loseXp'),
    effects: [{ op: 'xp', delta: 'X', lose: true }],
    needs: [has('xp')],
    counts: 'xp',
    line: '{Creature} gave {hiker} such a fright that they forgot a thing or two.',
    chip: '−{X} XP',
  },
  {
    id: 'condition',
    oneOf: [
      { id: 'wet', time: N.tier1ConditionDays, unit: 'days' },
      { id: 'unlucky', time: N.tier1ConditionDays, unit: 'days' },
      { id: 'clumsy', time: N.tier1ConditionDays, unit: 'days' },
    ],
    line: '{Creature} bothered {hiker} all night. They’re {Condition}.',
    chip: '{Condition} · {time}',
  },
];

const TIER_2: readonly NightOutcome[] = [
  {
    id: 'loseEnergy',
    x: range('loseEnergy'),
    effects: [lose('energy')],
    needs: [above0('energy')],
    line: '{Creature} kept {hiker} running all night.',
    chip: '{stats}',
  },
  {
    id: 'loseAppetite',
    x: range('loseAppetite'),
    effects: [lose('appetite')],
    needs: [above0('appetite')],
    line: '{Creature} kept {hiker} on the run, and now they’re hungry.',
    chip: '{stats}',
  },
  {
    id: 'allFood',
    x: range('allFood'),
    effects: [{ op: 'foodAppetite', delta: 'X' }],
    needs: [has('food')],
    line: '{Creature} got into all of {hiker}’s food.',
    chip: 'Food −{X} Appetite',
  },
  {
    id: 'allClothes',
    effects: [{ op: 'wearClothes', which: 'all', amount: 1 }],
    needs: [has('clothes')],
    line: '{Creature} clawed at {hiker}’s clothes.',
    chip: 'Clothes −1 durability',
  },
  {
    id: 'stealItem',
    effects: [{ op: 'stealItems', count: 1 }],
    needs: [has('items')],
    line: '{Creature} ran off with {hiker}’s {item}.',
    chip: '−1 item',
  },
  {
    id: 'injury',
    effects: [{ op: 'injury' }],
    needs: [
      {
        kind: 'weak',
        stats: ['energy', 'appetite'],
        atMost: N.tier2Injury.energyOrAppetiteAtMost,
        alone: true,
      },
    ],
    line: '{Creature} attacked {hiker}, alone in the dark.',
    chip: '+1 injury',
  },
  {
    id: 'chased',
    effects: [{ op: 'move', how: 'chased' }],
    needs: [{ kind: 'behind' }],
    line: '{Creature} chased {hiker} back down the trail.',
    chip: 'Chased back',
  },
  {
    id: 'condition',
    oneOf: [
      { id: 'bleeding', time: range('bleedingPhases'), unit: 'phases' },
      { id: 'brainFog', time: range('conditionDays'), unit: 'days' },
      { id: 'nightmares', time: range('conditionDays'), unit: 'days' },
    ],
    line: '{Creature} came for {hiker} in the night. They’re {Condition}.',
    chip: '{Condition} · {time}',
  },
];

const T3 = N.tier3Injury;

const TIER_3: readonly NightOutcome[] = [
  {
    id: 'stealItems',
    x: range('stealItems'),
    effects: [{ op: 'stealItems', count: 'X' }],
    needs: [has('items')],
    counts: 'items',
    line: '{Creature} tore through {hiker}’s bag and took {X} item{s}.',
    chip: '−{X} item{s}',
  },
  {
    id: 'stealAll',
    effects: [{ op: 'loseEachResource', chance: 1 }],
    needs: [has('resources')],
    counts: 'resources',
    line: '{Creature} took every resource {hiker} had.',
    chip: '−{X} resource{s}',
  },
  {
    id: 'allClothes',
    x: range('allClothes'),
    effects: [{ op: 'wearClothes', which: 'all', amount: 'X' }],
    needs: [has('clothes')],
    line: '{Creature} shredded {hiker}’s clothes.',
    chip: 'Clothes −{X} durability',
  },
  {
    id: 'bigLoss',
    x: range('bigLoss'),
    effects: [lose('energy'), lose('appetite')],
    needs: [above0('energy', 'appetite')],
    line: '{Creature} chased {hiker} through the night.',
    chip: '{stats}',
  },
  {
    id: 'everyStat',
    x: range('everyStat'),
    effects: [lose('energy'), lose('appetite'), lose('morale')],
    needs: [above0('energy', 'appetite', 'morale')],
    line: '{Creature} terrorized {hiker} until morning.',
    chip: '{stats}',
  },
  {
    id: 'injuryWeak',
    effects: [{ op: 'injury' }],
    needs: [
      {
        kind: 'weak',
        stats: ['energy', 'appetite'],
        atMost: T3.energyOrAppetiteAtMost,
        maxOnTile: T3.maxOnTile,
      },
    ],
    line: '{Creature} attacked {hiker}, who was too worn out to get away.',
    chip: '+1 injury',
  },
  {
    id: 'injuryScared',
    effects: [{ op: 'injury' }],
    needs: [{ kind: 'weak', stats: ['morale'], atMost: T3.moraleAtMost, maxOnTile: T3.maxOnTile }],
    line: '{Creature} cornered {hiker}, who panicked and got hurt.',
    chip: '+1 injury',
  },
  {
    id: 'condition',
    oneOf: [
      { id: 'bleeding', time: range('bleedingPhases'), unit: 'phases' },
      { id: 'nightmares', time: range('conditionDays'), unit: 'days' },
      { id: 'frozen', time: N.frozenPhases, unit: 'phases' },
      { id: 'soaked', time: N.soakedDays, unit: 'days' },
    ],
    line: '{Creature} attacked {hiker}. They’re {Condition}.',
    chip: '{Condition} · {time}',
  },
];

/** Every outcome's line is a first draft (05: "Wyatt can write more of these later"). */
const draft = (list: readonly NightOutcome[]) =>
  list.map((o): NightOutcome => ({ ...o, placeholder: true }));

export const NIGHT_OUTCOMES: Readonly<Record<NightTier, readonly NightOutcome[]>> = {
  1: draft(TIER_1),
  2: draft(TIER_2),
  3: draft(TIER_3),
};

/** The 15 creatures, with their art in public/assets/night-events/{id}.jpg. */
export const NIGHT_CREATURES: readonly NightCreature[] = [
  {
    id: 'raccoons',
    tier: 1,
    name: 'Raccoons',
    called: 'the raccoons',
    lines: { stealCaps: 'The raccoons stole {X} cap{s} from {hiker}.' },
    placeholder: true,
  },
  {
    id: 'opossums',
    tier: 1,
    name: 'Opossums',
    called: 'the opossums',
    lines: { loseMorale: 'The opossums hissed at {hiker} all night, then played dead.' },
    placeholder: true,
  },
  {
    id: 'foxes',
    tier: 1,
    name: 'Foxes',
    called: 'a fox',
    lines: { foodOne: 'A fox crept up and nibbled {hiker}’s {item}.' },
    placeholder: true,
  },
  {
    id: 'bats',
    tier: 1,
    name: 'Bats',
    called: 'the bats',
    lines: { loseMorale: 'The bats swooped around {hiker} all night.' },
    placeholder: true,
  },
  {
    id: 'drunk-hiker',
    tier: 1,
    name: 'Drunk Hiker',
    called: 'a drunk hiker',
    lines: {
      'condition:wet': 'A drunk hiker spilled their drink on {hiker}. They’re Wet.',
      swapItemFar:
        'A drunk hiker wandered through camp and mixed up {hiker}’s {item} with {other}’s {item2}.',
    },
    placeholder: true,
  },
  {
    id: 'wolves',
    tier: 2,
    name: 'Wolves',
    called: 'the wolves',
    lines: { chased: 'The wolves chased {hiker} back down the trail.' },
    placeholder: true,
  },
  {
    id: 'coyote',
    tier: 2,
    name: 'Coyotes',
    called: 'the coyotes',
    lines: { loseEnergy: 'The coyotes howled and yipped, and {hiker} hardly slept.' },
    placeholder: true,
  },
  {
    id: 'hyenas',
    tier: 2,
    name: 'Hyenas',
    called: 'the hyenas',
    lines: { allFood: 'The hyenas laughed all night and slobbered on {hiker}’s food.' },
    placeholder: true,
  },
  {
    id: 'robber',
    tier: 2,
    name: 'Robbers',
    called: 'the robbers',
    lines: { stealItem: 'The robbers snuck into camp and took {hiker}’s {item}.' },
    placeholder: true,
  },
  {
    id: 'raccoon-gang',
    tier: 2,
    name: 'Raccoon Gang',
    called: 'the raccoon gang',
    lines: { stealItem: 'The raccoon gang made off with {hiker}’s {item}.' },
    placeholder: true,
  },
  {
    id: 'bears',
    tier: 3,
    name: 'Bears',
    called: 'a bear',
    lines: {
      stealAll: 'A bear tore into {hiker}’s pack and ate every resource.',
      'condition:bleeding': 'A bear attacked {hiker}. They’re Bleeding.',
    },
    placeholder: true,
  },
  {
    id: 'leopard',
    tier: 3,
    name: 'Leopards',
    called: 'a leopard',
    lines: { injuryWeak: 'A leopard pounced on {hiker}, who was too worn out to get away.' },
    placeholder: true,
  },
  {
    id: 'bobcat',
    tier: 3,
    name: 'Bobcats',
    called: 'a bobcat',
    lines: { allClothes: 'A bobcat clawed {hiker}’s clothes to shreds.' },
    placeholder: true,
  },
  {
    id: 'cultists',
    tier: 3,
    name: 'Cultists',
    called: 'the cultists',
    lines: {
      'condition:nightmares':
        'The cultists chanted around {hiker} all night. They’re having Nightmares.',
    },
    placeholder: true,
  },
  {
    id: 'monster',
    tier: 3,
    name: 'Monster',
    called: 'the monster',
    lines: { everyStat: 'Something huge crashed through camp and terrorized {hiker}.' },
    placeholder: true,
  },
];

export const NIGHT_CREATURE_BY_ID: Readonly<Record<string, NightCreature>> = Object.fromEntries(
  NIGHT_CREATURES.map((c) => [c.id, c]),
);
