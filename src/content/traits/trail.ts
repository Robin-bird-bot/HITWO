/**
 * Trail traits (yellow): movement, carrying, food and managing the party's
 * resources. The table in 02-traits-and-conditions.md, in its order, plus
 * the family names (Leash Puller, Human Food) and Soldier's March.
 */
import { BALANCE } from '../../config/balance';
import { CONDITIONS } from '../conditions';
import { RESOURCES } from '../resources';
import type { Hooks, QueryContext, TraitDef } from '../../engine/effects';
import type { StatName } from '../../engine/types';
import { special, trail, unique } from './build';

const N = BALANCE.traits;
const T = BALANCE.thresholds;

const STOIC_GAINS: readonly StatName[] = ['energy', 'appetite'];

/** Someone else (still hiking) is on this tile. */
const someoneOn = (ctx: QueryContext, tileId: string | undefined) =>
  !!tileId && ctx.hikersOnTile(tileId).some((h) => h.id !== ctx.self.id);

/** Food gives this hiker more (or less) Appetite. */
const foodAppetite =
  (source: string, flat: number): Hooks['modifyGain'] =>
  (q, ctx) =>
    q.key === 'eat.appetite' && q.subjectId === ctx.self.id ? { source, flat } : undefined;

const bagSlots =
  (source: string, flat: number): Hooks['modifyCapacity'] =>
  (q) =>
    q.key === 'bag.slots' ? { source, flat } : undefined;

const gluttonHooks = (name: string): Hooks => ({
  modifyGain: foodAppetite(name, N.glutton.appetite),
});

const pullerHooks: Hooks = { pullsGroup: () => N.puller.energy };

export const TRAIL_TRAITS: readonly TraitDef[] = [
  trail(1, 'leader', 'Leader', 'Moving the group costs 1 less Appetite.', {
    hooks: {
      modifyCost(q, ctx) {
        if (q.key !== 'moveAll.appetite' || q.actorId !== ctx.self.id) return undefined;
        return { source: 'Leader', flat: -N.leader.moveAllDiscount };
      },
    },
  }),
  trail(1, 'follower', 'Follower', 'Being moved with the group doesn’t use this hiker’s action.', {
    hooks: { keepsActionWhenBrought: () => true },
  }),
  trail(
    1,
    'independent',
    'Independent',
    'Once per day, moving alone to a tile with no hikers costs 1 less Appetite.',
    {
      hooks: {
        workingNow: (ctx) => ctx.used(ctx.self, 'independent', 'day') === 0,
        modifyCost(q, ctx) {
          if (q.key !== 'move.appetite' || q.via !== 'move' || q.subjectId !== ctx.self.id) {
            return undefined;
          }
          if (ctx.used(ctx.self, 'independent', 'day') > 0 || someoneOn(ctx, q.toTileId)) {
            return undefined;
          }
          return { source: 'Independent', flat: -N.independent.discount };
        },
        // Arriving alone on an empty tile used today's discount.
        onMove(e, ctx) {
          if (e.via !== 'move' || e.role !== 'actor' || someoneOn(ctx, e.to)) return;
          if (ctx.used(ctx.self, 'independent', 'day') === 0) {
            ctx.tally(ctx.self, 'independent', 1, 'day');
          }
        },
      },
    },
  ),
  trail(1, 'scout', 'Scout', 'The nodes of all adjacent tiles are revealed.', {
    hooks: { revealsAdjacent: () => true },
  }),
  trail(1, 'glutton', 'Glutton', 'Food gives this hiker 1 extra Appetite.', {
    group: 'glutton',
    hooks: gluttonHooks('Glutton'),
  }),
  trail(1, 'humanFood', 'Human Food', 'Food gives this hiker 1 extra Appetite.', {
    group: 'glutton',
    icon: 'glutton',
    who: ['dog'],
    hooks: gluttonHooks('Human Food'),
  }),
  trail(1, 'strong', 'Strong', '+1 item slot.', {
    hooks: { modifyCapacity: bagSlots('Strong', N.strong.slots) },
  }),
  trail(1, 'manager', 'Manager', 'Can trade items with hikers on adjacent tiles.', {
    hooks: { giveReach: (q) => (q.what === 'item' ? N.manager.reach : 0) },
  }),
  trail(
    1,
    'prepared',
    'Prepared',
    'At the start of each biome, the nodes and challenge of a random tile are revealed for the rest of the biome.',
    {
      hooks: {
        onBiomeStart(ctx) {
          const tiles = ctx.tilesAhead().filter((id) => {
            const card = ctx.state.section.tiles[id]?.revealedCard;
            return !card || card.hidden;
          });
          if (!tiles.length) return;
          ctx.revealAhead(ctx.pick(tiles), 'Prepared');
          ctx.note(ctx.self, 'Prepared', `${ctx.self.name} knows what’s on a tile ahead.`);
        },
      },
    },
  ),
  trail(
    1,
    'short',
    'Short',
    'Moving costs 1 less Appetite, whether moving alone or being moved with the group (never below 0). −1 item slot.',
    {
      hooks: {
        modifyCost(q, ctx) {
          const own = q.key === 'move.appetite' || q.key === 'moveAll.perHiker';
          if (!own || q.subjectId !== ctx.self.id) return undefined;
          return { source: 'Short', flat: -N.short.discount };
        },
        modifyCapacity: bagSlots('Short', N.short.slots),
      },
    },
  ),
  trail(1, 'backtracker', 'Backtracker', 'Sideways or backwards moves cost no Appetite.', {
    hooks: {
      modifyCost(q, ctx) {
        if (q.key !== 'move.appetite' || q.subjectId !== ctx.self.id) return undefined;
        const from = q.fromTileId && ctx.state.section.tiles[q.fromTileId];
        const to = q.toTileId && ctx.state.section.tiles[q.toTileId];
        // Rows count up toward the checkpoint: the same row is sideways, a lower one backward.
        return from && to && to.row <= from.row
          ? { source: 'Backtracker', percent: -100 }
          : undefined;
      },
    },
  }),
  trail(
    1,
    'neverHungry',
    'Never Hungry',
    'Moves have a 25% chance to cost no Appetite. Every food restores 1 less Appetite for this hiker.',
    {
      hooks: {
        // Scavenging costs Energy now (29-core-loop.md, section 1): only moves are left to waive.
        waiveAppetite: (e, ctx) =>
          ['Move', 'Move All'].includes(e.cause) && ctx.roll(N.neverHungry.chance),
        modifyGain: foodAppetite('Never Hungry', N.neverHungry.food),
      },
    },
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
    hooks: pullerHooks,
  }),
  trail(2, 'leashPuller', 'Leash Puller', 'Moving the group costs 1 Energy instead of Appetite.', {
    group: 'puller',
    icon: 'puller',
    who: ['dog'],
    hooks: pullerHooks,
  }),
  trail(2, 'prowler', 'Prowler', 'Moving alone at night costs no extra Appetite.', {
    hooks: {
      modifyCost(q, ctx) {
        if (q.key !== 'move.appetite' || q.via !== 'move' || q.subjectId !== ctx.self.id) {
          return undefined;
        }
        const night = q.parts?.night ?? 0;
        return night > 0 ? { source: 'Prowler', flat: -night } : undefined;
      },
    },
  }),
  trail(
    2,
    'susceptible',
    'Susceptible',
    'While sharing a tile with other hikers, also has their positive conditions.',
    { hooks: { borrowsPositive: () => true } },
  ),
  trail(
    2,
    'transparent',
    'Transparent',
    'Hikers sharing this hiker’s tile also have this hiker’s positive conditions while they stay.',
    { hooks: { lendsPositive: () => true } },
  ),
  trail(
    2,
    'supportive',
    'Supportive',
    'Once per day, as a free action, takes one negative condition from a hiker on the same tile, with its remaining time.',
    {
      ability: {
        id: 'supportive',
        label: 'Supportive',
        limit: { per: 'day', uses: 1 },
        choicesFor: (ctx) =>
          ctx
            .hikersOnTile(ctx.self.tileId)
            .filter((h) => h.id !== ctx.self.id)
            .flatMap((h) =>
              h.conditions
                .filter((c) => CONDITIONS[c.id]?.kind === 'negative')
                .map((c) => ({
                  id: `${h.id}|${c.id}`,
                  label: `${CONDITIONS[c.id]?.name ?? c.id} from ${h.name}`,
                })),
            ),
        apply(ctx, choice) {
          const [hikerId, conditionId] = (choice ?? '').split('|');
          const from = ctx.state.hikers.find((h) => h.id === hikerId);
          if (!from || !conditionId) return;
          ctx.takeCondition(from, ctx.self, conditionId, 'Supportive');
        },
      },
    },
  ),
  trail(
    2,
    'trailer',
    'Trailer',
    'Moving to an adjacent tile with a hiker on it costs no Appetite.',
    {
      hooks: {
        modifyCost(q, ctx) {
          if (q.key !== 'move.appetite' || q.subjectId !== ctx.self.id) return undefined;
          return someoneOn(ctx, q.toTileId) ? { source: 'Trailer', percent: -100 } : undefined;
        },
      },
    },
  ),
  trail(
    2,
    'fast',
    'Fast',
    'The first move each day doesn’t use an action, but costs 1 extra Appetite.',
    {
      hooks: {
        freeMove: () => ({ key: 'fast', per: 'day', extra: N.fast.extraAppetite }),
      },
    },
  ),
  trail(
    2,
    'hardy',
    'Hardy',
    'Once per phase, can spend 2 Morale to shorten one condition by 1 day (or 1 phase, for a phase-based condition).',
    {
      ability: {
        id: 'hardy',
        label: 'Hardy',
        limit: { per: 'phase', uses: 1 },
        // Conditions with time left; ones that last as long as the weather have none to shorten.
        choicesFor: (ctx) =>
          ctx.self.conditions
            .filter((c) => c.unit !== 'weather')
            .map((c) => {
              const unit = c.unit === 'phases' ? 'phase' : 'day';
              const name = CONDITIONS[c.id]?.name ?? c.id;
              return {
                id: c.id,
                label: `${name} (${c.remaining} ${unit}${c.remaining === 1 ? '' : 's'})`,
              };
            }),
        validate(ctx) {
          return ctx.self.stats.morale < N.hardy.moraleCost
            ? `Needs ${N.hardy.moraleCost} Morale.`
            : undefined;
        },
        apply(ctx, choice) {
          if (!choice) return;
          ctx.changeStat(ctx.self, 'morale', -N.hardy.moraleCost, 'Hardy');
          ctx.shortenCondition(ctx.self, choice, N.hardy.shorten, 'Hardy');
        },
      },
    },
  ),
  trail(2, 'mule', 'Mule', '+2 item slots.', {
    hooks: { modifyCapacity: bagSlots('Mule', N.mule.slots) },
  }),
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
    { hooks: { onBiomeStart: (ctx) => ctx.askTilePick(ctx.self) } },
  ),
  trail(
    2,
    'shrugOff',
    'Shrug Off',
    'Once per biome, the first injury this hiker would receive is prevented.',
    {
      hooks: {
        workingNow: (ctx) => ctx.used(ctx.self, 'shrugOff', 'biome') === 0,
        blockInjury(_cause, ctx) {
          if (ctx.used(ctx.self, 'shrugOff', 'biome') > 0) return false;
          ctx.tally(ctx.self, 'shrugOff', 1, 'biome');
          ctx.note(ctx.self, 'Shrug Off', `${ctx.self.name} shrugged off an injury.`);
          return true;
        },
      },
    },
  ),
  trail(2, 'lookout', 'Lookout', 'Keep Watch also protects hikers on adjacent tiles.', {
    hooks: { watchReach: () => N.lookout.reach },
  }),
  trail(
    2,
    'trespasser',
    'Trespasser',
    'Once per biome, can choose to trigger no challenges for the day. When moved with the group, this hiker isn’t part of the challenge.',
    {
      hooks: { skipsChallenges: (ctx) => ctx.used(ctx.self, 'trespassing', 'day') > 0 },
      ability: {
        id: 'trespasser',
        label: 'Trespasser',
        limit: { per: 'biome', uses: 1 },
        validate: (ctx) =>
          ctx.used(ctx.self, 'trespassing', 'day') > 0
            ? `${ctx.self.name} is already trespassing today.`
            : undefined,
        apply(ctx) {
          ctx.tally(ctx.self, 'trespassing', 1, 'day');
          ctx.note(ctx.self, 'Trespasser', `No challenges trigger for ${ctx.self.name} today.`);
        },
      },
    },
  ),
  trail(
    3,
    'stalker',
    'Stalker',
    'Once per day, moving to an adjacent tile with a hiker on it costs no Appetite and doesn’t use an action.',
    {
      hooks: {
        freeMove: (q, ctx) =>
          someoneOn(ctx, q.toTileId) ? { key: 'stalker', per: 'day', discount: 'all' } : undefined,
      },
    },
  ),
  trail(
    3,
    'sneaker',
    'Sneaker',
    'Moving at night costs no Energy, but the extra Appetite is still paid.',
    {
      hooks: {
        modifyCost: (q, ctx) =>
          q.key === 'move.energy' && q.subjectId === ctx.self.id && q.phase === 'night'
            ? { source: 'Sneaker', percent: -100 }
            : undefined,
      },
    },
  ),
  trail(3, 'photosynthesis', 'Photosynthesis', 'Each move has a chance to restore 1 Energy.', {
    hooks: {
      onMove(_e, ctx) {
        if (ctx.roll(N.photosynthesis.chance)) {
          ctx.changeStat(ctx.self, 'energy', N.photosynthesis.energy, 'Photosynthesis');
        }
      },
    },
  }),
  trail(
    3,
    'splitter',
    'Splitter',
    'When this hiker eats, every other hiker on the tile gains 1 Appetite.',
    {
      hooks: {
        onEat(_e, ctx) {
          for (const h of ctx.hikersOnTile(ctx.self.tileId)) {
            if (h.id !== ctx.self.id)
              ctx.changeStat(h, 'appetite', N.splitter.appetite, 'Splitter');
          }
        },
      },
    },
  ),
  trail(3, 'sherpa', 'Sherpa', 'Moving the group can also bring along hikers on adjacent tiles.', {
    hooks: { bringReach: () => N.sherpa.reach },
  }),
  trail(
    3,
    'secondWind',
    'Second Wind',
    'Once per biome, on becoming Exhausted, Energy refills to 10.',
    {
      hooks: {
        onStatChange(e, ctx) {
          const becameExhausted = e.from > T.exhausted && e.to <= T.exhausted;
          if (e.stat !== 'energy' || !becameExhausted) return;
          if (ctx.used(ctx.self, 'secondWind', 'biome') > 0) return;
          ctx.tally(ctx.self, 'secondWind', 1, 'biome');
          // Refills to the maximum (10, or more with a raised maximum).
          ctx.changeStat(ctx.self, 'energy', BALANCE.stats.max * 2, 'Second Wind');
        },
      },
    },
  ),
  trail(
    3,
    'carrierPigeon',
    'Carrier Pigeon',
    'Can send items or resources to any hiker anywhere, but can’t receive them from afar.',
    { hooks: { giveReach: (q) => (q.role === 'sender' ? Infinity : 0) } },
  ),
  // Special and unique Trail traits.
  trail(
    null,
    'rabbitDiet',
    'Rabbit Diet',
    'Scavenging costs no Energy, but can’t eat food cards. Can eat 1 Forest resource for 1 Appetite.',
    {
      ...special('leah'),
      hooks: {
        modifyCost: (q, ctx) =>
          q.key === 'scavenge.energy' && q.subjectId === ctx.self.id
            ? { source: 'Rabbit Diet', percent: -100 }
            : undefined,
        canAct: (q) =>
          q.role === 'actor' && q.action.type === 'eat'
            ? 'Rabbit Diet: can’t eat food cards.'
            : undefined,
      },
      ability: {
        id: 'rabbitDiet',
        label: 'Rabbit Diet',
        limit: { per: 'phase', uses: Infinity },
        choicesFor: (ctx) =>
          RESOURCES.filter(
            (r) => r.node === 'forest' && (ctx.self.inventory.resources[r.id] ?? 0) > 0,
          ).map((r) => ({ id: r.id, label: `Eat 1 ${r.name}` })),
        apply(ctx, choice) {
          const r = RESOURCES.find((x) => x.id === choice && x.node === 'forest');
          if (!r) return;
          ctx.spendResources(ctx.self, [r.id], 'Rabbit Diet');
          ctx.changeStat(ctx.self, 'appetite', N.rabbitDiet.appetite, 'Rabbit Diet');
        },
      },
    },
  ),
  trail(null, 'soldiersMarch', 'Soldier’s March', 'Moving alone costs 1 less Appetite.', {
    ...unique('grandpaWink', 'grandpaSherman'),
    hooks: {
      modifyCost: (q, ctx) =>
        q.key === 'move.appetite' && q.via === 'move' && q.subjectId === ctx.self.id
          ? { source: 'Soldier’s March', flat: -N.soldiersMarch.discount }
          : undefined,
    },
  }),
];
