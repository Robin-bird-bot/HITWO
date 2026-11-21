/**
 * Special and unique traits: special ones belong to certain characters (or
 * come through trinkets), unique ones to a single character. Only their
 * owners can start with them or be offered them. The table in
 * 02-traits-and-conditions.md, then every trait marked New in
 * 07-characters.md, by character. Owners are the 07-characters.md ids.
 */
import { BALANCE } from '../../config/balance';
import type { QueryContext, TraitDef } from '../../engine/effects';
import type { Hiker, NodeType } from '../../engine/types';
import { CONDITIONS } from '../conditions';
import { RESOURCES } from '../resources';
import { morale, special, trail, unique, utility } from './build';
import { moraleNow, others } from './moraleKit';

const N = BALANCE.traits;

const FIRE = 'Sit by the Fire';

/** Hikers within `reach` lines of this one, them included (Yodeler, Hype Dog). */
const within = (ctx: QueryContext, reach: number): Hiker[] =>
  ctx.state.hikers.filter(
    (h) => h.status === 'active' && ctx.distance(h.tileId, ctx.self.tileId) <= reach,
  );

/** Whose day it is for a Duo's Tag Team: the first on odd days, the second on even. */
export function tagTeamSide(day: number, sides: readonly [string, string]): string {
  return day % 2 === 1 ? sides[0] : sides[1];
}
/** Boss & Gracie: Boss's days are odd, Gracie's even (TODO(wyatt)). */
const BOSS_GRACIE = ['Boss', 'Gracie'] as const;
const bossDay = (ctx: QueryContext) => tagTeamSide(ctx.state.day, BOSS_GRACIE) === 'Boss';

/** Luck on a tile with a node (Nosework, with today's node). */
const noseworkLuck = (node: NodeType | undefined) => (ctx: QueryContext) =>
  !!node && !!ctx.state.section.tiles[ctx.self.tileId]?.nodes.some((n) => n.type === node);

export const SPECIAL_TRAITS: readonly TraitDef[] = [
  // ── 02-traits-and-conditions.md ──
  utility(null, 'fluffy', 'Fluffy', 'When crafting with Fur, get 1 Fur back.', {
    ...special('ellie'),
    hooks: {
      onCraft(e, ctx) {
        if (e.paid?.includes('fur')) ctx.gain(ctx.self, ['fur'], 'Fluffy');
      },
    },
  }),
  utility(null, 'quirky', 'Quirky', 'Each day, this trait becomes a random Tier I Utility trait.', {
    ...special('wyatt'),
    daily: 'trait',
    dailyTiers: [1],
  }),
  utility(
    null,
    'zany',
    'Zany',
    'Each day, this trait becomes a random Utility trait of any tier.',
    {
      ...special('grandpaSherman'),
      daily: 'trait',
    },
  ),
  utility(
    null,
    'nosework',
    'Nosework',
    'Each morning a random node type is picked and shown on the hiker’s card. On a tile with that node: +3 Luck when scavenging and crafting.',
    {
      ...special('noseworkEllie'),
      daily: 'node',
      hooksWith(setting) {
        const node = setting.x as NodeType | undefined;
        const here = noseworkLuck(node);
        const label = `Nosework: +${N.nosework.luck} Luck on today’s node`;
        return {
          workingNow: here,
          modifyScavenge: (_q, ctx) =>
            here(ctx)
              ? { source: 'Nosework', label, tone: 'luck', luck: N.nosework.luck }
              : undefined,
          modifyCraft: (_q, ctx) =>
            here(ctx)
              ? { source: 'Nosework', label, tone: 'luck', luck: N.nosework.luck }
              : undefined,
        };
      },
    },
  ),
  morale(
    'misophonia',
    'Misophonia',
    'Right away: −1 Morale when another hiker eats on this tile; +2 Morale when crafting food.',
    {
      ...special('gdog'),
      hooks: {
        onTileEat(e, ctx) {
          if (e.eaterId !== ctx.self.id) {
            moraleNow(ctx, 'Misophonia', N.misophonia.otherEats, 'someone ate here');
          }
        },
        onCraft(e, ctx) {
          if (e.type === 'food') moraleNow(ctx, 'Misophonia', N.misophonia.craftsFood, 'made food');
        },
      },
    },
  ),
  morale('rainLover', 'Rain Lover', 'During rain or snow, every Morale gain is 1 larger.', {
    ...special('wyatt', 'wywee'),
    hooks: {
      modifyStatChange: (q, ctx) =>
        q.stat === 'morale' &&
        q.delta > 0 &&
        ['rain', 'storm', 'snow'].includes(ctx.state.weather?.today ?? 'clear')
          ? { add: N.rainLover.extra }
          : undefined,
    },
  }),
  morale(
    'moody',
    'Moody',
    'Each morning, gains 1 random condition for the day from a set of 3 positive and 3 negative conditions.',
    // The condition is given when the day's pick is rolled (src/engine/traits/daily.ts).
    { ...special(), daily: 'condition' },
  ),
  utility(
    null,
    'yodeler',
    'Yodeler',
    'Once per day, as a free daytime action: every hiker within 2 tiles gains 1 Morale, or 2 if they’re on a tile with a Mountain node.',
    {
      ...unique(),
      ability: {
        id: 'yodeler',
        label: 'Yodeler',
        limit: { per: 'day', uses: 1 },
        validate: (ctx) => (ctx.state.phase === 'night' ? 'Yodeling is for the day.' : undefined),
        apply(ctx) {
          for (const h of within(ctx, N.yodeler.reach)) {
            const mountain = ctx.state.section.tiles[h.tileId]?.nodes.some(
              (n) => n.type === 'mountain',
            );
            const gain = mountain ? N.yodeler.mountain : N.yodeler.morale;
            ctx.changeStat(h, 'morale', gain, 'Yodeler', 'a yodel');
          }
        },
      },
    },
  ),
  utility(
    null,
    'dogMom',
    'Dog Mom',
    'When a Dog on the same tile scavenges, this hiker also gains a resource from that node.',
    {
      ...unique('mom'),
      hooks: {
        onTileScavenged(e, ctx) {
          const dog = ctx.state.hikers.find((h) => h.id === e.scavengerId)?.family === 'dog';
          if (!dog || !e.node) return;
          const pool = RESOURCES.filter((r) => r.node === e.node).map((r) => r.id);
          ctx.gain(ctx.self, [ctx.pick(pool)], 'Dog Mom');
        },
      },
    },
  ),
  utility(
    null,
    'artist',
    'Artist',
    'When this hiker crafts an item, every hiker on the tile gains 1 Morale.',
    {
      ...unique('catie'),
      hooks: {
        onCraft(_e, ctx) {
          for (const h of ctx.hikersOnTile(ctx.self.tileId)) {
            ctx.changeStat(h, 'morale', N.morale, 'Artist', 'admiring the craft');
          }
        },
      },
    },
  ),
  utility(
    null,
    'stylish',
    'Stylish',
    'With all 3 equipment slots filled: +1 Luck when scavenging and crafting. Clothes last 3 extra days when this hiker equips them (once per item).',
    {
      ...unique('mitchell'),
      hooks: (() => {
        const full = (ctx: QueryContext) =>
          ['body', 'feet', 'gear'].every(
            (slot) => !!ctx.self.inventory.equipped[slot as 'body' | 'feet' | 'gear'],
          );
        const label = `Stylish: +${N.stylish.luck} Luck, all dressed up`;
        return {
          workingNow: full,
          modifyScavenge: (_q, ctx) =>
            full(ctx)
              ? { source: 'Stylish', label, tone: 'luck', luck: N.stylish.luck }
              : undefined,
          modifyCraft: (_q, ctx) =>
            full(ctx)
              ? { source: 'Stylish', label, tone: 'luck', luck: N.stylish.luck }
              : undefined,
          onEquip(e, ctx) {
            if (e.item.styled || e.item.durability === undefined) return;
            e.item.styled = true;
            e.item.durability += N.stylish.days;
            e.item.maxDurability = Math.max(e.item.maxDurability ?? 0, e.item.durability);
            ctx.note(ctx.self, 'Stylish', `The clothes last ${N.stylish.days} more days.`);
          },
        };
      })(),
    },
  ),
  morale('showGirl', 'Show Girl', 'Humans on this hiker’s tile get +1 from every Morale gain.', {
    ...unique('showgirlGdog'),
    // TODO(wyatt): every Human on the tile, Show Girl herself included.
    hooks: {
      modifyTileStatChange: (q) =>
        q.stat === 'morale' && q.delta > 0 && q.target.family === 'human'
          ? { add: N.showGirl.extra }
          : undefined,
    },
  }),
  utility(
    null,
    'nuggetPuker',
    'Nugget Puker',
    'After eating food, gains a Puked Nuggets food card (+1 Appetite, 1 use).',
    {
      ...special('catie'),
      hooks: {
        // TODO(wyatt): eating Puked Nuggets doesn't make more (or they'd never run out).
        onEat(e, ctx) {
          if (e.itemId !== 'pukedNuggets') ctx.giveItem(ctx.self, 'pukedNuggets', 'Nugget Puker');
        },
      },
    },
  ),
  utility(
    null,
    'loud',
    'Loud',
    'Can trade and Keep Watch from 1 tile away. At night, gives Ringing Ears to every hiker on its tile.',
    {
      ...special('ellie'),
      hooks: {
        giveReach: () => N.loud.reach,
        watchReach: () => N.loud.reach,
        onPhaseStart(e, ctx) {
          if (e.phase !== 'night') return;
          for (const h of others(ctx)) {
            ctx.addCondition(h, 'ringingEars', N.loud.ringingEarsPhases, 'phases', 'Loud');
          }
        },
      },
    },
  ),
  // Rabbit Diet and Soldier's March are with the Trail traits (trail.ts).

  // ── New in 07-characters.md ──
  trail(
    null,
    'wanderer',
    'Wanderer',
    'Once per daytime phase, moving alone to an unrevealed tile doesn’t use this hiker’s action.',
    {
      ...special('pearl'),
      hooks: {
        workingNow: (ctx) =>
          ctx.state.phase !== 'night' && ctx.used(ctx.self, 'wanderer', 'phase') === 0,
        freeMove: (q, ctx) =>
          ctx.state.phase !== 'night' && !ctx.state.section.tiles[q.toTileId]?.visited
            ? { key: 'wanderer', per: 'phase' }
            : undefined,
      },
    },
  ),
  trail(
    null,
    'forgetful',
    'Forgetful',
    'Each morning, a 50% chance to forget one random negative condition (it’s removed).',
    {
      ...special('brutus'),
      hooks: {
        onStartOfDay(ctx) {
          const bad = ctx.self.conditions.filter((c) => CONDITIONS[c.id]?.kind === 'negative');
          if (!bad.length || !ctx.roll(N.forgetful.chance)) return;
          ctx.cure(ctx.self, ctx.pick(bad).id, 'Forgetful');
        },
      },
    },
  ),
  utility(
    null,
    'snores',
    'Snores',
    'Night events are 50% less likely to hit hikers on this hiker’s tile. Other hikers sleeping on this tile get 1 less Energy from sleep.',
    {
      ...special('brutus'),
      hooks: {
        nightShield: () => N.snores.shield,
        modifyTileGain: (q) =>
          q.key === 'sleep.energy' ? { source: 'Snores', flat: N.snores.sleep } : undefined,
      },
    },
  ),
  trail(
    null,
    'alphaDog',
    'Alpha Dog',
    'When this hiker moves the group onto a tile with a challenge, any negative conditions or injuries it gives go to this hiker instead of the others.',
    { ...unique('cody'), hooks: { takesGroupHarm: () => true } },
  ),
  trail(null, 'lanky', 'Lanky', 'Each move has a 25% chance not to use this hiker’s action.', {
    ...special('duke'),
    hooks: {
      onMove(e, ctx) {
        if (e.role === 'actor' && ctx.self.acted && ctx.roll(N.lanky.chance)) {
          ctx.refundAction(ctx.self, 'Lanky');
        }
      },
    },
  }),
  utility(
    null,
    'goodBoy',
    'Good Boy',
    'Instead of acting, can give this hiker’s action to a hiker on the same tile, who gets an extra action this phase.',
    {
      ...special('duke'),
      ability: {
        id: 'goodBoy',
        label: 'Good Boy',
        limit: { per: 'phase', uses: 1 },
        choicesFor: (ctx) => others(ctx).map((h) => ({ id: h.id, label: `Give it to ${h.name}` })),
        validate: (ctx) => (ctx.self.acted ? `${ctx.self.name} has already acted.` : undefined),
        // TODO(wyatt): the extra action is Motivated (their next action is free) for this phase.
        apply(ctx, choice) {
          const to = ctx.state.hikers.find((h) => h.id === choice);
          if (!to) return;
          ctx.useAction(ctx.self);
          ctx.addCondition(to, 'motivated', 1, 'phases', 'Good Boy');
        },
      },
    },
  ),
  utility(
    null,
    'spoiled',
    'Spoiled',
    'When another hiker on this tile eats, this hiker gains 1 Appetite too.',
    {
      ...special('scarlet'),
      hooks: {
        onTileEat(e, ctx) {
          if (e.eaterId !== ctx.self.id)
            ctx.changeStat(ctx.self, 'appetite', N.spoiled.appetite, 'Spoiled');
        },
      },
    },
  ),
  trail(
    null,
    'fluffArmor',
    'Fluff Armor',
    'Each negative condition this hiker would get has a 50% chance to be blocked, at most once per day.',
    {
      ...special('sinjon'),
      hooks: {
        workingNow: (ctx) => ctx.used(ctx.self, 'fluffArmor', 'day') === 0,
        blockCondition(id, ctx) {
          if (ctx.used(ctx.self, 'fluffArmor', 'day') > 0 || !ctx.roll(N.fluffArmor.chance)) {
            return false;
          }
          ctx.tally(ctx.self, 'fluffArmor', 1, 'day');
          ctx.note(
            ctx.self,
            'Fluff Armor',
            `${CONDITIONS[id]?.name ?? id} didn’t get through the fluff.`,
          );
          return true;
        },
      },
    },
  ),
  utility(
    null,
    'mentor',
    'Mentor',
    'Every other hiker on this tile gains 1 extra XP each time they gain XP.',
    {
      ...special('hershal'),
      hooks: {
        workingNow: (ctx) => others(ctx).length > 0,
        modifyTileXp: () => ({ source: 'Mentor', flat: N.mentor.extra }),
      },
    },
  ),
  utility(
    null,
    'storyteller',
    'Storyteller',
    'When this hiker Sits by the Fire, every other hiker on the tile gains 2 XP.',
    {
      ...special('hershal'),
      waitsOn: FIRE,
      hooks: {
        onSitByFire(ctx) {
          for (const h of others(ctx)) ctx.gainXp(h, N.storyteller.xp, 'Storyteller');
        },
      },
    },
  ),
  utility(
    null,
    'hypeDog',
    'Hype Dog',
    'Once per day, as a free action, makes a hiker on this tile or an adjacent tile Energized for 1 day.',
    {
      ...special('kai'),
      ability: {
        id: 'hypeDog',
        label: 'Hype Dog',
        limit: { per: 'day', uses: 1 },
        choicesFor: (ctx) =>
          within(ctx, N.hypeDog.reach).map((h) => ({ id: h.id, label: `Hype up ${h.name}` })),
        apply(ctx, choice) {
          const to = ctx.state.hikers.find((h) => h.id === choice);
          if (to) ctx.addCondition(to, 'energized', N.hypeDog.days, 'days', 'Hype Dog');
        },
      },
    },
  ),
  utility(
    null,
    'bossGracie',
    'Boss & Gracie',
    'Boss’s days: Fetch can take an item too, and can reach 2 tiles away. Gracie’s days: once per day, as a free action, gives 1 resource or item to a hiker up to 2 tiles away.',
    {
      ...unique('bossGracie'),
      tagTeam: BOSS_GRACIE,
      hooks: {
        // Boss's days: Fetch reaches farther and takes items too.
        abilityBoost: (id, ctx) =>
          id === 'fetch' && bossDay(ctx) ? { reach: N.tagTeam.reach, items: true } : undefined,
        // Gracie's days: one give, up to 2 tiles away.
        giveReach: (q, ctx) =>
          q.role === 'sender' && !bossDay(ctx) && ctx.used(ctx.self, 'gracieGive', 'day') === 0
            ? N.tagTeam.reach
            : 0,
        onGive(e, ctx) {
          if (e.distance > 0 && !bossDay(ctx)) ctx.tally(ctx.self, 'gracieGive', 1, 'day');
        },
      },
    },
  ),
  trail(
    null,
    'shifty',
    'Shifty',
    'Can move alone, but only when no other hiker is on this tile. Once per phase, that move doesn’t use the action. It still costs the normal amount.',
    {
      ...unique('pepper'),
      hooks: {
        workingNow: (ctx) => ctx.isAlone(ctx.self),
        movesAlone: (ctx) => ctx.isAlone(ctx.self),
        freeMove: (_q, ctx) =>
          ctx.isAlone(ctx.self) ? { key: 'shifty', per: 'phase' } : undefined,
      },
    },
  ),
  trail(
    null,
    'nightShifty',
    'Night Shifty',
    'Once per night, can move to an adjacent tile for free.',
    {
      ...unique('pepper'),
      hooks: {
        workingNow: (ctx) =>
          ctx.state.phase === 'night' && ctx.used(ctx.self, 'nightShifty', 'day') === 0,
        movesAlone: (ctx) =>
          ctx.state.phase === 'night' && ctx.used(ctx.self, 'nightShifty', 'day') === 0,
        freeMove: (_q, ctx) =>
          ctx.state.phase === 'night'
            ? { key: 'nightShifty', per: 'day', discount: 'all' }
            : undefined,
      },
    },
  ),
  utility(
    null,
    'luckyCharm',
    'Lucky Charm',
    'Every other hiker on this tile gets +1 Luck when scavenging and crafting.',
    {
      ...unique('goldie'),
      hooks: {
        workingNow: (ctx) => others(ctx).length > 0,
        modifyTileScavenge: (_q, _target, ctx) => ({
          source: 'Lucky Charm',
          label: `Lucky Charm: +${N.luckyCharm.luck} Luck (${ctx.self.name} is here)`,
          tone: 'luck',
          luck: N.luckyCharm.luck,
        }),
        modifyTileCraft: (_q, _target, ctx) => ({
          source: 'Lucky Charm',
          label: `Lucky Charm: +${N.luckyCharm.luck} Luck (${ctx.self.name} is here)`,
          tone: 'luck',
          luck: N.luckyCharm.luck,
        }),
      },
    },
  ),
  utility(
    null,
    'cuddleBuddy',
    'Cuddle Buddy',
    'Hikers who sleep on this tile can’t get Nightmares, and gain 1 Morale.',
    {
      ...unique('goldie'),
      hooks: {
        blockTileCondition: (id) => id === 'nightmares',
        blockCondition: (id) => id === 'nightmares',
        onTileSleep(e, ctx) {
          const sleeper = ctx.state.hikers.find((h) => h.id === e.sleeperId);
          if (sleeper)
            ctx.changeStat(sleeper, 'morale', N.cuddleBuddy.morale, 'Cuddle Buddy', 'a cosy sleep');
        },
        onSleep: (ctx) => moraleNow(ctx, 'Cuddle Buddy', N.cuddleBuddy.morale, 'a cosy sleep'),
      },
    },
  ),
  utility(
    null,
    'ruleChanger',
    'Rule Changer',
    'Once per biome, reroll the challenge on an adjacent revealed tile.',
    {
      ...unique('wyatt'),
      ability: {
        id: 'ruleChanger',
        label: 'Rule Changer',
        limit: { per: 'biome', uses: 1 },
        // TODO(wyatt): a "revealed" tile is one whose card shows on the map (Prepared, a scout).
        choicesFor: (ctx) =>
          Object.values(ctx.state.section.tiles)
            .filter(
              (t) =>
                ctx.distance(t.id, ctx.self.tileId) === 1 &&
                !!t.revealedCard &&
                !t.revealedCard.hidden,
            )
            .map((t) => ({ id: t.id, label: `Reroll the card at row ${t.row + 1}` })),
        apply(ctx, choice) {
          if (choice) ctx.rerollCard(choice, 'Rule Changer');
        },
      },
    },
  ),
  trail(
    null,
    'strongWalker',
    'Strong Walker',
    'Hikers this hiker moves with the group don’t use their action.',
    { ...special('grandpaWink'), hooks: { broughtKeepAction: () => true } },
  ),
  trail(
    null,
    'justAroundTheNextCorner',
    'Just Around the Next Corner',
    'Moving to a tile 3 or fewer tiles from the checkpoint: moving alone has a 75% chance to cost no Appetite, and when this hiker moves the group, each hiker has a 25% chance to pay no Appetite.',
    {
      ...special('grandpaWink'),
      hooks: (() => {
        // Paid once the hiker has arrived, so their tile is where they moved to.
        const near = (ctx: QueryContext, hikerId: string) => {
          const h = ctx.state.hikers.find((x) => x.id === hikerId);
          const checkpoint = ctx.state.section.checkpointId;
          return !!h && ctx.distance(h.tileId, checkpoint) <= N.justAroundTheNextCorner.tiles;
        };
        return {
          waiveAppetite: (e, ctx) =>
            e.cause === 'Move' &&
            near(ctx, ctx.self.id) &&
            ctx.roll(N.justAroundTheNextCorner.alone),
          waiveForGroup: (e, ctx) =>
            near(ctx, e.payerId) && ctx.roll(N.justAroundTheNextCorner.group),
        };
      })(),
    },
  ),
  trail(
    null,
    'tankButt',
    'Tank Butt',
    'When this hiker moves the group, it can bring hikers who’ve already acted this phase.',
    { ...unique('grandpaSherman'), hooks: { bringsActed: () => true } },
  ),
  utility(
    null,
    'linguist',
    'Linguist',
    'Each time this hiker gains XP, they gain 1 extra XP for each other hiker on the tile.',
    {
      ...unique('catie'),
      hooks: {
        workingNow: (ctx) => others(ctx).length > 0,
        modifyXp: (_q, ctx) => {
          const n = others(ctx).length * N.linguist.perOther;
          return n ? { source: 'Linguist', flat: n } : undefined;
        },
      },
    },
  ),
  trail(
    null,
    'coach',
    'Coach',
    'Once per day, as a free action, gives a hiker on this tile Motivated (their next action is free).',
    {
      ...special('melissa'),
      ability: {
        id: 'coach',
        label: 'Coach',
        limit: { per: 'day', uses: 1 },
        choicesFor: (ctx) => others(ctx).map((h) => ({ id: h.id, label: `Coach ${h.name}` })),
        apply(ctx, choice) {
          const to = ctx.state.hikers.find((h) => h.id === choice);
          if (to) ctx.addCondition(to, 'motivated', N.coach.days, 'days', 'Coach');
        },
      },
    },
  ),
  utility(
    null,
    'comedian',
    'Comedian',
    'When this hiker Sits by the Fire, every hiker on the tile gains 1 Morale and loses Bored.',
    {
      ...special('madeline'),
      waitsOn: FIRE,
      hooks: {
        onSitByFire(ctx) {
          for (const h of ctx.hikersOnTile(ctx.self.tileId)) {
            ctx.changeStat(h, 'morale', N.comedian.morale, 'Comedian', 'a good laugh');
            ctx.cure(h, 'bored', 'Comedian');
          }
        },
      },
    },
  ),
  trail(
    null,
    'easyMode',
    'Easy Mode',
    'Hikers facing a challenge on this hiker’s tile pay 1 less of its cost (never below 0).',
    { ...unique('wywee'), hooks: { easesChallenges: () => N.easyMode.less } },
  ),
  utility(
    null,
    'garbageGut',
    'Garbage Gut',
    'Quality 1 food never gives this hiker a bad condition.',
    { ...special('ellieDevourer'), hooks: { ignoresBadFood: () => true } },
  ),
];
