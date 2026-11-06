/**
 * Every condition, with its exact wording from
 * docs/design/02-traits-and-conditions.md ("Conditions").
 *
 * Phase 5 gives conditions their timing (they tick down and end) and makes
 * Frozen block moving. TODO(phase 6): every other condition's effect.
 */
import { RESOURCES } from './resources';
import type { Hooks } from '../engine/effects';

export interface ConditionDef {
  id: string;
  name: string;
  kind: 'negative' | 'positive';
  text: string;
  hooks?: Hooks;
  /** Takes a node, like Allergies (Forest). */
  takesNode?: true;
  /** Getting this again turns it into another condition (Wet → Soaked, Wyatt Nov 5). */
  again?: string;
  /** Can't be moved by anything (Frozen, Napping). */
  immovable?: true;
  /** Made up to run an opportunity's effect until Wyatt names it. */
  placeholder?: true;
}

const isMove = (type: string) => type === 'move' || type === 'moveAll';

const LIST: ConditionDef[] = [
  // Negative
  { id: 'sleepy', name: 'Sleepy', kind: 'negative', text: '−2 Energy while it lasts.' },
  { id: 'nauseous', name: 'Nauseous', kind: 'negative', text: '−2 Appetite while it lasts.' },
  { id: 'bored', name: 'Bored', kind: 'negative', text: '−2 Morale while it lasts.' },
  { id: 'dejected', name: 'Dejected', kind: 'negative', text: 'Morale can’t go above 5.' },
  { id: 'inappetent', name: 'Inappetent', kind: 'negative', text: 'Appetite can’t go above 7.' },
  { id: 'buzzed', name: 'Buzzed', kind: 'negative', text: 'Energy can’t go above 7.' },
  {
    id: 'hangry',
    name: 'Hangry',
    kind: 'negative',
    text: 'Maximum Morale drops by 1 for each point of Appetite below 10.',
  },
  {
    id: 'foodPoisoning',
    name: 'Food Poisoning',
    kind: 'negative',
    text: 'Food gives 2 less Appetite.',
  },
  {
    id: 'blind',
    name: 'Blind',
    kind: 'negative',
    text: 'Can’t move alone; can still be moved with the group.',
  },
  { id: 'sluggish', name: 'Sluggish', kind: 'negative', text: 'Moving costs 1 extra Appetite.' },
  { id: 'nightmares', name: 'Nightmares', kind: 'negative', text: 'Can’t sleep.' },
  {
    id: 'strained',
    name: 'Strained',
    kind: 'negative',
    text: 'Loses 1 extra Energy whenever Energy is lost.',
  },
  { id: 'brainFog', name: 'Brain Fog', kind: 'negative', text: 'Utility traits don’t work.' },
  {
    id: 'allergies',
    name: 'Allergies',
    kind: 'negative',
    text: '−1 Morale each phase on a tile with this node.',
    takesNode: true,
  },
  {
    id: 'unlucky',
    name: 'Unlucky',
    kind: 'negative',
    text: '−1 Luck when scavenging and crafting.',
  },
  {
    id: 'wet',
    name: 'Wet',
    kind: 'negative',
    text: '−1 Morale each day without clothes equipped or a shelter. Getting Wet again makes you Soaked.',
    again: 'soaked',
  },
  {
    id: 'soaked',
    name: 'Soaked',
    kind: 'negative',
    text: '−1 Morale each phase without clothes equipped or a shelter.',
  },
  { id: 'inept', name: 'Inept', kind: 'negative', text: 'Can’t craft.' },
  { id: 'clumsy', name: 'Clumsy', kind: 'negative', text: 'Can’t use tools.' },
  {
    id: 'weak',
    name: 'Weak',
    kind: 'negative',
    text: '−1 item slot; an item that no longer fits must be given away or dropped.',
  },
  {
    id: 'butterfingers',
    name: 'Butterfingers',
    kind: 'negative',
    text: 'When scavenging, a chance to get nothing.',
  },
  {
    id: 'tunnelVision',
    name: 'Tunnel Vision',
    kind: 'negative',
    text: '1 fewer card to choose from when scavenging or crafting.',
  },
  {
    id: 'ringingEars',
    name: 'Ringing Ears',
    kind: 'negative',
    text: 'Each phase, a chance to lose 1 Morale (75%), or 1 Energy at night (25%).',
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
        const left = ctx.self.conditions.find((c) => c.id === 'frozen')?.remaining ?? 1;
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
    // TODO(phase 7): when it runs out, the hiker gains 1 injury.
    text: 'When it runs out, the hiker gains 1 injury. Curing it first means no injury.',
  },
  // Positive
  { id: 'refreshed', name: 'Refreshed', kind: 'positive', text: 'Doesn’t lose Energy.' },
  { id: 'full', name: 'Full', kind: 'positive', text: 'Doesn’t lose Appetite.' },
  { id: 'sated', name: 'Sated', kind: 'positive', text: '+1 Appetite while it lasts.' },
  { id: 'energized', name: 'Energized', kind: 'positive', text: '+1 Energy while it lasts.' },
  { id: 'lucky', name: 'Lucky', kind: 'positive', text: '+1 Luck when scavenging and crafting.' },
  { id: 'inspired', name: 'Inspired', kind: 'positive', text: 'Every Morale gain is 1 larger.' },
  {
    id: 'motivated',
    name: 'Motivated',
    kind: 'positive',
    text: 'The hiker’s next action is free.',
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

/** The negative conditions, for Rocco Raccoon's "a random negative condition". */
export const NEGATIVE_CONDITIONS: readonly string[] = LIST.filter(
  (c) => c.kind === 'negative' && !c.placeholder,
).map((c) => c.id);

/** The positive conditions, for Witch's Castle's "a random positive one". */
export const POSITIVE_CONDITIONS: readonly string[] = LIST.filter(
  (c) => c.kind === 'positive' && !c.placeholder,
).map((c) => c.id);
