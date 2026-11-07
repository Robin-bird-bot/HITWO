/**
 * Every condition, with its exact wording from
 * docs/design/02-traits-and-conditions.md ("Conditions").
 *
 * Effects are data and hooks; the engine never checks a condition by name.
 * - `shift`: a stat change while it lasts, given back (or taken back) when it
 *   ends (Wyatt, Nov 6).
 * - `modifyStatMax`: caps on a stat (Dejected, Inappetent, Buzzed, Hangry, Burning).
 * - `stacking`: Shivering and Burning count up instead of down.
 * - The rest plug into the usual hooks (costs, scavenging, actions, the end
 *   of each phase or day).
 *
 * Waiting on later phases: Food Poisoning (eating), Inept (crafting) and
 * Clumsy (tools) in Phase 9; Bleeding's injury in Phase 7.
 */
import { BALANCE } from '../config/balance';
import type { CostKey, EffectContext, Hooks } from '../engine/effects';
import type { Action, StatName, TraitType } from '../engine/types';
import { RESOURCES } from './resources';

export interface ConditionDef {
  id: string;
  name: string;
  kind: 'negative' | 'positive';
  text: string;
  hooks?: Hooks;
  /** A stat change while it lasts, undone when it ends (Sleepy −2 Energy). */
  shift?: Partial<Record<StatName, number>>;
  /** Trait types that don't work while it lasts (Brain Fog: Utility). */
  suppressTraits?: readonly TraitType[];
  /** Counts up in stacks (Shivering, Burning), lasting until its weather ends. */
  stacking?: {
    /** Works like Frozen at this many. */
    frozenAt?: number;
    /** An injury at this many, then back to 0. */
    injuryAt: number;
  };
  /** The hiker's next action doesn't use their action (Motivated), and this ends. */
  freeAction?: true;
  /** Takes a node, like Allergies (Forest). */
  takesNode?: true;
  /** Getting this again turns it into another condition (Wet → Soaked, Wyatt Nov 5). */
  again?: string;
  /** Can't be moved by anything (Frozen, Napping). */
  immovable?: true;
  /** Running out (not being cured) gives the hiker 1 injury (Bleeding, Splinted). */
  onRunOut?: 'injury';
  /** Only an item gives it (Splinted), so random picks never do. */
  fromItemOnly?: true;
  /** Made up to run an opportunity's effect until Wyatt names it. */
  placeholder?: true;
}

const C = BALANCE.conditions;
const isMove = (type: Action['type']) => type === 'move' || type === 'moveAll';

/** A hard cap on one stat while it lasts. */
const capOn = (stat: StatName, cap: number): Hooks => ({
  modifyStatMax: (s) => (s === stat ? { cap } : undefined),
});

/** Costs this hiker pays in a stat (their own move, Tend, the night and end-of-day drains). */
const OWN_COSTS: Record<'energy' | 'appetite', readonly CostKey[]> = {
  energy: ['move.energy', 'tend.energy', 'night.noSleepEnergy'],
  appetite: [
    'move.appetite',
    'move.carry',
    'moveAll.appetite',
    'endOfDay.appetite',
    'scavenge.appetite',
  ],
};

/** Refreshed and Full: no loss of a stat at all, chosen costs included (Wyatt, Nov 6). */
const noLossOf = (stat: 'energy' | 'appetite', source: string): Hooks => ({
  modifyCost: (q, ctx) =>
    OWN_COSTS[stat].includes(q.key) && q.actorId === ctx.self.id
      ? { source, percent: -100 }
      : undefined,
  modifyStatChange: (q) => (q.stat === stat && q.delta < 0 ? { blockLoss: true } : undefined),
});

/** Wet and Soaked: Morale lost without clothes on or a shelter. */
const exposed = (ctx: EffectContext) => ctx.clothesWorn(ctx.self) === 0 && !ctx.sheltered(ctx.self);

const LIST: ConditionDef[] = [
  // Negative
  {
    id: 'sleepy',
    name: 'Sleepy',
    kind: 'negative',
    text: '−2 Energy while it lasts.',
    shift: { energy: C.shift.sleepy },
  },
  {
    id: 'nauseous',
    name: 'Nauseous',
    kind: 'negative',
    text: '−2 Appetite while it lasts.',
    shift: { appetite: C.shift.nauseous },
  },
  {
    id: 'bored',
    name: 'Bored',
    kind: 'negative',
    text: '−2 Morale while it lasts.',
    shift: { morale: C.shift.bored },
  },
  {
    id: 'dejected',
    name: 'Dejected',
    kind: 'negative',
    text: 'Morale can’t go above 5.',
    hooks: capOn('morale', C.caps.dejected),
  },
  {
    id: 'inappetent',
    name: 'Inappetent',
    kind: 'negative',
    text: 'Appetite can’t go above 7.',
    hooks: capOn('appetite', C.caps.inappetent),
  },
  {
    id: 'buzzed',
    name: 'Buzzed',
    kind: 'negative',
    text: 'Energy can’t go above 7.',
    hooks: capOn('energy', C.caps.buzzed),
  },
  {
    id: 'hangry',
    name: 'Hangry',
    kind: 'negative',
    text: 'Maximum Morale drops by 1 for each point of Appetite below 10.',
    hooks: {
      modifyStatMax: (stat, ctx) => {
        const below = BALANCE.stats.max - ctx.self.stats.appetite;
        return stat === 'morale' && below > 0 ? { delta: -below } : undefined;
      },
    },
  },
  {
    id: 'foodPoisoning',
    name: 'Food Poisoning',
    kind: 'negative',
    // TODO(phase 9): food gives 2 less Appetite, when eating arrives.
    text: 'Food gives 2 less Appetite.',
  },
  {
    id: 'blind',
    name: 'Blind',
    kind: 'negative',
    text: 'Can’t move alone; can still be moved with the group.',
    hooks: {
      // TODO(wyatt): read as stopping the Move action; Move All can still bring them.
      canAct: (q) =>
        q.action.type === 'move' && q.role === 'actor'
          ? 'Blind: can’t move alone, but can be moved with the group.'
          : undefined,
    },
  },
  {
    id: 'sluggish',
    name: 'Sluggish',
    kind: 'negative',
    text: 'Moving costs 1 extra Appetite.',
    hooks: {
      modifyCost: (q, ctx) => {
        const own =
          (q.key === 'move.appetite' || q.key === 'moveAll.appetite') && q.actorId === ctx.self.id;
        const brought = q.key === 'moveAll.perHiker' && q.subjectId === ctx.self.id;
        return own || brought ? { source: 'Sluggish', flat: C.sluggishAppetite } : undefined;
      },
    },
  },
  {
    id: 'nightmares',
    name: 'Nightmares',
    kind: 'negative',
    text: 'Can’t sleep.',
    hooks: {
      canAct: (q) => (q.action.type === 'sleep' ? 'Nightmares: can’t sleep.' : undefined),
    },
  },
  {
    id: 'strained',
    name: 'Strained',
    kind: 'negative',
    text: 'Loses 1 extra Energy whenever Energy is lost.',
    hooks: {
      modifyStatChange: (q) =>
        q.stat === 'energy' && q.delta < 0 ? { add: -C.strainedExtra } : undefined,
    },
  },
  {
    id: 'brainFog',
    name: 'Brain Fog',
    kind: 'negative',
    text: 'Utility traits don’t work.',
    suppressTraits: ['U'],
  },
  {
    id: 'allergies',
    name: 'Allergies',
    kind: 'negative',
    text: '−1 Morale each phase on a tile with this node.',
    takesNode: true,
    hooks: {
      onPhaseEnd: (_e, ctx) => {
        const node = ctx.condition(ctx.self, 'allergies')?.node;
        const tile = ctx.state.section.tiles[ctx.self.tileId];
        if (node && tile?.nodes.some((n) => n.type === node)) {
          ctx.changeStat(ctx.self, 'morale', -C.moraleLoss, 'Allergies');
        }
      },
    },
  },
  {
    id: 'unlucky',
    name: 'Unlucky',
    kind: 'negative',
    text: '−1 Luck when scavenging and crafting.',
    hooks: {
      // TODO(phase 9): crafting too.
      modifyScavenge: () => ({
        source: 'Unlucky',
        label: `Unlucky: −${C.luck} Luck`,
        tone: 'warning',
        luck: -C.luck,
      }),
    },
  },
  {
    id: 'wet',
    name: 'Wet',
    kind: 'negative',
    text: '−1 Morale each day without clothes equipped or a shelter. Getting Wet again makes you Soaked.',
    again: 'soaked',
    hooks: {
      onEndOfDay: (ctx) => {
        if (exposed(ctx)) ctx.changeStat(ctx.self, 'morale', -C.moraleLoss, 'Wet');
      },
    },
  },
  {
    id: 'soaked',
    name: 'Soaked',
    kind: 'negative',
    text: '−1 Morale each phase without clothes equipped or a shelter.',
    hooks: {
      onPhaseEnd: (_e, ctx) => {
        if (exposed(ctx)) ctx.changeStat(ctx.self, 'morale', -C.moraleLoss, 'Soaked');
      },
    },
  },
  // TODO(phase 9): Inept and Clumsy stop crafting and using tools.
  { id: 'inept', name: 'Inept', kind: 'negative', text: 'Can’t craft.' },
  { id: 'clumsy', name: 'Clumsy', kind: 'negative', text: 'Can’t use tools.' },
  {
    id: 'weak',
    name: 'Weak',
    kind: 'negative',
    text: '−1 item slot; an item that no longer fits must be given away or dropped.',
    hooks: {
      modifyCapacity: (q) =>
        q.key === 'bag.slots' ? { source: 'Weak', flat: -C.weakSlots } : undefined,
    },
  },
  {
    id: 'butterfingers',
    name: 'Butterfingers',
    kind: 'negative',
    text: 'When scavenging, a chance to get nothing.',
    hooks: {
      modifyScavenge: () => ({
        source: 'Butterfingers',
        label: `Butterfingers: ${Math.round(BALANCE.chance.default * 100)}% chance to drop it`,
        tone: 'warning',
        dropChance: BALANCE.chance.default,
      }),
    },
  },
  {
    id: 'tunnelVision',
    name: 'Tunnel Vision',
    kind: 'negative',
    text: '1 fewer card to choose from when scavenging or crafting.',
    hooks: {
      // TODO(phase 9): crafting too.
      modifyScavenge: () => ({
        source: 'Tunnel Vision',
        label: `Tunnel Vision: ${C.tunnelVisionCards} fewer card`,
        tone: 'warning',
        cards: -C.tunnelVisionCards,
      }),
    },
  },
  {
    id: 'ringingEars',
    name: 'Ringing Ears',
    kind: 'negative',
    text: 'Each phase, a chance to lose 1 Morale (75%), or 1 Energy at night (25%).',
    hooks: {
      onPhaseEnd: (e, ctx) => {
        if (e.phase === 'night') {
          if (ctx.roll(C.ringingEars.nightEnergy)) {
            ctx.changeStat(ctx.self, 'energy', -1, 'Ringing Ears');
          }
        } else if (ctx.roll(C.ringingEars.dayMorale)) {
          ctx.changeStat(ctx.self, 'morale', -1, 'Ringing Ears');
        }
      },
    },
  },
  {
    id: 'frozen',
    name: 'Frozen',
    kind: 'negative',
    text: 'Can’t move or be moved.',
    immovable: true,
    hooks: {
      canAct(q, ctx) {
        if (!isMove(q.action.type)) return undefined;
        const left = ctx.condition(ctx.self, 'frozen')?.remaining ?? 1;
        const unit = left === 1 ? 'phase' : 'phases';
        return q.role === 'brought'
          ? `Frozen: can’t be moved for ${left} more ${unit}.`
          : `Frozen: can’t move for ${left} more ${unit}.`;
      },
    },
  },
  {
    id: 'bleeding',
    name: 'Bleeding',
    kind: 'negative',
    text: 'When it runs out, the hiker gains 1 injury. Curing it first means no injury.',
    onRunOut: 'injury',
    // TODO(wyatt): cured by Bandages and Medkit for now; name the traits and clothes.
  },
  {
    id: 'shivering',
    name: 'Shivering',
    kind: 'negative',
    text: 'At 3 or more, the hiker is Frozen. At 5 or more, they gain 1 injury and Shivering resets to 0.',
    stacking: { frozenAt: C.shivering.frozenAt, injuryAt: C.shivering.injuryAt },
    hooks: {
      canAct(q, ctx) {
        const stacks = ctx.condition(ctx.self, 'shivering')?.stacks ?? 0;
        if (!isMove(q.action.type) || stacks < C.shivering.frozenAt) return undefined;
        return q.role === 'brought'
          ? `Shivering ×${stacks}: Frozen, can’t be moved until it drops below ${C.shivering.frozenAt}.`
          : `Shivering ×${stacks}: Frozen, can’t move until it drops below ${C.shivering.frozenAt}.`;
      },
    },
  },
  {
    id: 'burning',
    name: 'Burning',
    kind: 'negative',
    text: '−1 maximum Energy for each stack. At 5, the hiker gains 1 injury and Burning resets to 0.',
    stacking: { injuryAt: C.burning.injuryAt },
    hooks: {
      modifyStatMax: (stat, ctx) => {
        const stacks = ctx.condition(ctx.self, 'burning')?.stacks ?? 0;
        return stat === 'energy' && stacks > 0 ? { delta: -stacks } : undefined;
      },
      // Cools off in any Night phase where the hiker gained none.
      onPhaseEnd: (e, ctx) => {
        if (e.phase !== 'night') return;
        if (ctx.tally(ctx.self, 'burning:gained', 0, 'phase') > 0) return;
        ctx.addStacks(ctx.self, 'burning', -C.burning.coolPerNight, 'a cool night');
      },
    },
  },
  // Positive
  {
    id: 'refreshed',
    name: 'Refreshed',
    kind: 'positive',
    text: 'Doesn’t lose Energy.',
    hooks: noLossOf('energy', 'Refreshed'),
  },
  {
    id: 'full',
    name: 'Full',
    kind: 'positive',
    text: 'Doesn’t lose Appetite.',
    hooks: noLossOf('appetite', 'Full'),
  },
  {
    id: 'sated',
    name: 'Sated',
    kind: 'positive',
    text: '+1 Appetite while it lasts.',
    shift: { appetite: C.shift.sated },
  },
  {
    id: 'energized',
    name: 'Energized',
    kind: 'positive',
    text: '+1 Energy while it lasts.',
    shift: { energy: C.shift.energized },
  },
  {
    id: 'lucky',
    name: 'Lucky',
    kind: 'positive',
    text: '+1 Luck when scavenging and crafting.',
    hooks: {
      // TODO(phase 9): crafting too.
      modifyScavenge: () => ({
        source: 'Lucky',
        label: `Lucky: +${C.luck} Luck`,
        tone: 'luck',
        luck: C.luck,
      }),
    },
  },
  {
    id: 'inspired',
    name: 'Inspired',
    kind: 'positive',
    text: 'Every Morale gain is 1 larger.',
    hooks: {
      modifyStatChange: (q) =>
        q.stat === 'morale' && q.delta > 0 ? { add: C.inspiredExtra } : undefined,
    },
  },
  {
    id: 'motivated',
    name: 'Motivated',
    kind: 'positive',
    text: 'The hiker’s next action is free.',
    freeAction: true,
  },
  // Medical items (Phase 7).
  {
    // TODO(wyatt): the Splint's "−1 injury for 3 days, then it returns", shown as a condition.
    id: 'splinted',
    name: 'Splinted',
    kind: 'positive',
    text: 'A Splint holds off 1 injury. When it runs out, the injury comes back.',
    onRunOut: 'injury',
    fromItemOnly: true,
  },
  // Opportunity effects (Nov 6 update), named here until Wyatt names them.
  {
    id: 'napping',
    name: 'Napping',
    kind: 'negative',
    text: 'Can’t move, be moved, scavenge, Tend or craft.',
    immovable: true,
    placeholder: true,
    hooks: {
      canAct(q) {
        const blocked = ['move', 'moveAll', 'scavenge', 'tend'];
        if (!blocked.includes(q.action.type)) return undefined;
        return q.role === 'brought'
          ? 'Napping: can’t be moved this phase.'
          : 'Napping: can’t move, scavenge or Tend this phase.';
      },
    },
  },
  {
    id: 'raccoonFriend',
    name: 'Raccoon Friend',
    kind: 'positive',
    text: 'Each night, a 75% chance the raccoon brings a random resource.',
    placeholder: true,
    hooks: {
      // At camp, before nights tick down, so "the next 3 nights" gives 3 chances.
      onEndOfDay(ctx) {
        if (ctx.roll(0.75)) ctx.gain(ctx.self, [ctx.pick(RESOURCES).id], 'Raccoon Friend');
      },
    },
  },
];

export const CONDITIONS: Readonly<Record<string, ConditionDef>> = Object.fromEntries(
  LIST.map((c) => [c.id, c]),
);

/**
 * The negative conditions, for Rocco Raccoon's "a random negative condition".
 * Stacking ones come only from weather.
 */
export const NEGATIVE_CONDITIONS: readonly string[] = LIST.filter(
  (c) => c.kind === 'negative' && !c.placeholder && !c.stacking && !c.fromItemOnly,
).map((c) => c.id);

/** The positive conditions, for Witch's Castle's "a random positive one". */
export const POSITIVE_CONDITIONS: readonly string[] = LIST.filter(
  (c) => c.kind === 'positive' && !c.placeholder && !c.fromItemOnly,
).map((c) => c.id);
