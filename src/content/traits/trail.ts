/**
 * Trail traits (yellow): movement, carrying, food and managing the party's
 * resources. The table in 02-traits-and-conditions.md, in its order, plus
 * the family names (Leash Puller, Human Food) and Soldier's March.
 */
import { BALANCE } from '../../config/balance';
import type { TraitDef } from '../../engine/effects';
import type { StatName } from '../../engine/types';
import { special, trail, unique } from './build';

const N = BALANCE.traits;

const STOIC_GAINS: readonly StatName[] = ['energy', 'appetite'];

export const TRAIL_TRAITS: readonly TraitDef[] = [
  trail(1, 'leader', 'Leader', 'Moving the group costs 1 less Appetite.', {
    hooks: {
      modifyCost(q, ctx) {
        if (q.key !== 'moveAll.appetite' || q.actorId !== ctx.self.id) return undefined;
        return { source: 'Leader', flat: -N.leader.moveAllDiscount };
      },
    },
  }),
  trail(1, 'follower', 'Follower', 'Being moved with the group doesn’t use this hiker’s action.'),
  trail(
    1,
    'independent',
    'Independent',
    'Once per day, moving alone to a tile with no hikers costs 1 less Appetite.',
  ),
  trail(1, 'scout', 'Scout', 'The nodes of all adjacent tiles are revealed.'),
  trail(1, 'glutton', 'Glutton', 'Food gives this hiker 1 extra Appetite.', { group: 'glutton' }),
  trail(1, 'humanFood', 'Human Food', 'Food gives this hiker 1 extra Appetite.', {
    group: 'glutton',
    who: ['dog'],
  }),
  trail(1, 'strong', 'Strong', '+1 item slot.'),
  trail(1, 'manager', 'Manager', 'Can trade items with hikers on adjacent tiles.'),
  trail(
    1,
    'prepared',
    'Prepared',
    'At the start of each biome, the nodes and challenge of a random tile are revealed for the rest of the biome.',
  ),
  trail(
    1,
    'short',
    'Short',
    'Moving costs 1 less Appetite, whether moving alone or being moved with the group (never below 0). −1 item slot.',
  ),
  trail(1, 'backtracker', 'Backtracker', 'Sideways or backwards moves cost no Appetite.'),
  trail(
    1,
    'neverHungry',
    'Never Hungry',
    'Moves and scavenges have a 25% chance to cost no Appetite. Every food restores 1 less Appetite for this hiker.',
  ),
  trail(
    1,
    'thrillSeeker',
    'Thrill Seeker',
    'Losing 3 or more Energy in a single phase makes this hiker Energized for 1 day.',
    {
      hooks: {
        // Every Energy loss in a phase counts, costs included; it triggers once a phase.
        onStatChange(e, ctx) {
          if (e.stat !== 'energy' || e.to >= e.from) return;
          const lost = ctx.tally(ctx.self, 'energyLost', e.from - e.to, 'phase');
          if (lost < N.thrillSeeker.energyLost) return;
          if (ctx.tally(ctx.self, 'thrillSeeker', 0, 'phase') > 0) return;
          ctx.tally(ctx.self, 'thrillSeeker', 1, 'phase');
          ctx.addCondition(ctx.self, 'energized', N.thrillSeeker.days, 'days', 'Thrill Seeker');
        },
      },
    },
  ),
  trail(2, 'puller', 'Puller', 'Moving the group costs 1 Energy instead of Appetite.', {
    group: 'puller',
  }),
  trail(2, 'leashPuller', 'Leash Puller', 'Moving the group costs 1 Energy instead of Appetite.', {
    group: 'puller',
    who: ['dog'],
  }),
  trail(2, 'prowler', 'Prowler', 'Moving alone at night costs no extra Appetite.'),
  trail(
    2,
    'susceptible',
    'Susceptible',
    'While sharing a tile with other hikers, also has their positive conditions.',
  ),
  trail(
    2,
    'transparent',
    'Transparent',
    'Hikers sharing this hiker’s tile also have this hiker’s positive conditions while they stay.',
  ),
  trail(
    2,
    'supportive',
    'Supportive',
    'Once per day, as a free action, takes one negative condition from a hiker on the same tile, with its remaining time.',
  ),
  trail(
    2,
    'trailer',
    'Trailer',
    'Moving to an adjacent tile with a hiker on it costs no Appetite.',
  ),
  trail(
    2,
    'fast',
    'Fast',
    'The first move each day doesn’t use an action, but costs 1 extra Appetite.',
  ),
  trail(
    2,
    'hardy',
    'Hardy',
    'Once per phase, can spend 2 Morale to shorten one condition by 1 day (or 1 phase, for a phase-based condition).',
  ),
  trail(2, 'mule', 'Mule', '+2 item slots.'),
  trail(2, 'stoic', 'Stoic', 'Once per day, can spend 2 Morale to gain 1 Energy or 1 Appetite.', {
    ability: {
      id: 'stoic',
      label: 'Stoic',
      limit: { per: 'day', uses: 1 },
      choices: [
        { id: 'energy', label: `+${N.stoic.gain} Energy` },
        { id: 'appetite', label: `+${N.stoic.gain} Appetite` },
      ],
      validate(ctx) {
        if (ctx.self.stats.morale < N.stoic.moraleCost) {
          return `Needs ${N.stoic.moraleCost} Morale.`;
        }
        return undefined;
      },
      apply(ctx, choice) {
        const stat = STOIC_GAINS.find((s) => s === choice);
        if (!stat) return;
        ctx.changeStat(ctx.self, 'morale', -N.stoic.moraleCost, 'Stoic');
        ctx.changeStat(ctx.self, stat, N.stoic.gain, 'Stoic');
      },
    },
  }),
  trail(
    2,
    'tactical',
    'Tactical',
    'At the start of each biome, the nodes and challenge of a tile the player chooses are revealed for the rest of the biome.',
  ),
  trail(
    2,
    'shrugOff',
    'Shrug Off',
    'Once per biome, the first injury this hiker would receive is prevented.',
  ),
  trail(2, 'lookout', 'Lookout', 'Keep Watch also protects hikers on adjacent tiles.'),
  trail(
    2,
    'trespasser',
    'Trespasser',
    'Once per biome, can choose to trigger no challenges for the day. When moved with the group, this hiker isn’t part of the challenge.',
  ),
  trail(
    3,
    'stalker',
    'Stalker',
    'Once per day, moving to an adjacent tile with a hiker on it costs no Appetite and doesn’t use an action.',
  ),
  trail(
    3,
    'sneaker',
    'Sneaker',
    'Moving at night costs no Energy, but the extra Appetite is still paid.',
  ),
  trail(3, 'photosynthesis', 'Photosynthesis', 'Each move has a chance to restore 1 Energy.'),
  trail(
    3,
    'splitter',
    'Splitter',
    'When this hiker eats, every other hiker on the tile gains 1 Appetite.',
  ),
  trail(3, 'sherpa', 'Sherpa', 'Moving the group can also bring along hikers on adjacent tiles.'),
  trail(
    3,
    'secondWind',
    'Second Wind',
    'Once per biome, on becoming Exhausted, Energy refills to 10.',
  ),
  trail(
    3,
    'carrierPigeon',
    'Carrier Pigeon',
    'Can send items or resources to any hiker anywhere, but can’t receive them from afar.',
  ),
  // Special and unique Trail traits.
  trail(
    null,
    'rabbitDiet',
    'Rabbit Diet',
    'Scavenging costs no Appetite, but can’t eat food cards. Can eat 1 Forest resource for 1 Appetite.',
    special('leah'),
  ),
  trail(
    null,
    'soldiersMarch',
    'Soldier’s March',
    'Moving alone costs 1 less Appetite.',
    unique('grandpaWink', 'grandpaSherman'),
  ),
];
