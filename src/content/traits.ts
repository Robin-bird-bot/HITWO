/**
 * Traits as data. Each one plugs into engine hooks; the engine never checks
 * for a trait by name. Wording is copied exactly from
 * docs/design/02-traits-and-conditions.md.
 *
 * Phase 1 has the three sample traits that prove the hook system works.
 * Phase 10 adds the rest.
 */
import { BALANCE } from '../config/balance';
import type { TraitDef } from '../engine/effects';
import type { StatName } from '../engine/types';

const N = BALANCE.traits;

const leader: TraitDef = {
  id: 'leader',
  name: 'Leader',
  type: 'T',
  tier: 1,
  text: 'Moving the group costs 1 less Appetite.',
  hooks: {
    modifyCost(q, ctx) {
      if (q.key !== 'moveAll.appetite' || q.actorId !== ctx.self.id) return undefined;
      return { source: 'Leader', flat: -N.leader.moveAllDiscount };
    },
  },
};

const STOIC_GAINS: readonly StatName[] = ['energy', 'appetite'];

const stoic: TraitDef = {
  id: 'stoic',
  name: 'Stoic',
  type: 'T',
  tier: 2,
  text: 'Once per day, can spend 2 Morale to gain 1 Energy or 1 Appetite.',
  ability: {
    id: 'stoic',
    label: 'Stoic',
    limit: { per: 'day', uses: 1 },
    choices: [
      { id: 'energy', label: `+${N.stoic.gain} Energy` },
      { id: 'appetite', label: `+${N.stoic.gain} Appetite` },
    ],
    validate(ctx) {
      if (ctx.self.stats.morale < N.stoic.moraleCost) return `Needs ${N.stoic.moraleCost} Morale.`;
      return undefined;
    },
    apply(ctx, choice) {
      const stat = STOIC_GAINS.find((s) => s === choice);
      if (!stat) return;
      ctx.changeStat(ctx.self, 'morale', -N.stoic.moraleCost, 'Stoic');
      ctx.changeStat(ctx.self, stat, N.stoic.gain, 'Stoic');
    },
  },
};

const extrinsic: TraitDef = {
  id: 'extrinsic',
  name: 'Extrinsic',
  type: 'M',
  tier: null,
  text: 'Start of day: +1 Morale when sharing a tile with another hiker, −1 Morale when alone.',
  hooks: {
    onStartOfDay(ctx) {
      const delta = ctx.isAlone(ctx.self) ? N.extrinsic.alone : N.extrinsic.together;
      ctx.changeStat(ctx.self, 'morale', delta, 'Extrinsic');
    },
  },
};

export const TRAITS: Readonly<Record<string, TraitDef>> = Object.fromEntries(
  [leader, stoic, extrinsic].map((t) => [t.id, t]),
);
