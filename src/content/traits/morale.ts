/**
 * Morale traits (purple). Traits about where a hiker is are checked at the
 * start of each day; traits about what a hiker does trigger right away, every
 * time. There's no daily limit. Morale traits have no tier, are always on,
 * and are open to every hiker (a few special ones are in special.ts). The
 * table in 02-traits-and-conditions.md, in its order.
 *
 * Each start-of-day trait is a rule (moraleKit.ts) that gives the change and
 * a few words of why; the log shows them ("−1 Morale (Extrinsic: alone
 * right now)").
 */
import { BALANCE } from '../../config/balance';
import type { TraitDef } from '../../engine/effects';
import type { TraitSetting } from '../../engine/types';
import { ACTION_NAME, ACTION_WORD, isTraitAction, NODE_WORD, isNode, morale } from './build';
import { applyRule, atStartOfDay, moraleNow, others, plusMinus } from './moraleKit';

const N = BALANCE.traits;
const ONE = N.morale;

/** "a River node", or "an [X] node" before it's set. */
const nodeWord = (x: string | undefined, fallback: string) =>
  isNode(x) ? `a ${NODE_WORD[x]}` : `an ${fallback}`;
const actionWord = (x: string | undefined, fallback: string) =>
  isTraitAction(x) ? ACTION_WORD[x] : fallback;

/** Weather the Morale traits care about: rain or snow (a storm brings rain). */
const WET_WEATHER = ['rain', 'storm', 'snow'];

export const MORALE_TRAITS: readonly TraitDef[] = [
  morale(
    'extrinsic',
    'Extrinsic',
    'Start of day: +1 Morale when sharing a tile with another hiker, −1 Morale when alone.',
    {
      hooks: atStartOfDay('Extrinsic', (ctx) =>
        ctx.isAlone(ctx.self)
          ? { delta: N.extrinsic.alone, why: 'alone right now' }
          : { delta: N.extrinsic.together, why: 'with company' },
      ),
    },
  ),
  morale(
    'intrinsic',
    'Intrinsic',
    'Start of day: +1 Morale alone, −1 sharing a tile with 2 or more other hikers.',
    {
      hooks: atStartOfDay('Intrinsic', (ctx) =>
        plusMinus(
          { when: others(ctx).length === 0, why: 'alone right now' },
          { when: others(ctx).length >= 2, why: 'with 2 or more others' },
          ONE,
        ),
      ),
    },
  ),
  morale('foody', 'Foody', 'Start of day: +1 Morale at 8 or more Appetite, −1 at 5 or less.', {
    hooks: atStartOfDay('Foody', (ctx) =>
      plusMinus(
        { when: ctx.self.stats.appetite >= N.foody.high, why: 'well fed' },
        { when: ctx.self.stats.appetite <= N.foody.low, why: 'hungry' },
        ONE,
      ),
    ),
  }),
  morale(
    'location',
    'Location',
    'Start of day: +1 Morale on a tile with an [X] node, −1 on a tile with a [Y] node.',
    {
      setting: 'nodes',
      nameWith: (s: TraitSetting) =>
        isNode(s.x) && isNode(s.y)
          ? `Location (${NODE_WORD[s.x]} / ${NODE_WORD[s.y]})`
          : 'Location',
      textWith: (s: TraitSetting) =>
        `Start of day: +1 Morale on a tile with ${nodeWord(s.x, '[X]')} node, −1 on a tile with ${nodeWord(s.y, '[Y]')} node.`,
      hooksWith: (s: TraitSetting) =>
        atStartOfDay('Location', (ctx) => {
          const nodes = ctx.state.section.tiles[ctx.self.tileId]?.nodes ?? [];
          const has = (n: string | undefined) => !!n && nodes.some((x) => x.type === n);
          const word = (n: string | undefined) => (isNode(n) ? NODE_WORD[n] : '');
          return plusMinus(
            { when: has(s.x), why: `on a ${word(s.x)} tile` },
            { when: has(s.y), why: `on a ${word(s.y)} tile` },
            ONE,
          );
        }),
    },
  ),
  morale(
    'fairWeather',
    'Fair-Weather',
    'Start of day: +1 Morale with no weather, −1 in rain or snow.',
    {
      hooks: atStartOfDay('Fair-Weather', (ctx) => {
        const today = ctx.state.weather?.today ?? 'clear';
        return plusMinus(
          { when: today === 'clear', why: 'clear skies' },
          { when: WET_WEATHER.includes(today), why: 'rain or snow' },
          ONE,
        );
      }),
    },
  ),
  morale(
    'dressed',
    'Dressed',
    'Start of day: +1 Morale with 2 or more clothes equipped, −1 with none.',
    {
      hooks: atStartOfDay('Dressed', (ctx) => {
        const worn = ctx.clothesWorn(ctx.self);
        return plusMinus(
          { when: worn >= N.dressed.many, why: 'well dressed' },
          { when: worn === 0, why: 'no clothes on' },
          ONE,
        );
      }),
    },
  ),
  morale(
    'exhibitionist',
    'Exhibitionist',
    'Start of day: +1 Morale with no clothes equipped, −1 with 2 or more.',
    {
      hooks: atStartOfDay('Exhibitionist', (ctx) => {
        const worn = ctx.clothesWorn(ctx.self);
        return plusMinus(
          { when: worn === 0, why: 'no clothes on' },
          { when: worn >= N.dressed.many, why: 'too many clothes on' },
          ONE,
        );
      }),
    },
  ),
  morale('action', 'Action', '+1 Morale each time doing [X], −1 each time doing [Y].', {
    setting: 'actions',
    nameWith: (s: TraitSetting) => (isTraitAction(s.x) ? `Action (${ACTION_WORD[s.x]})` : 'Action'),
    textWith: (s: TraitSetting) =>
      `+1 Morale each time ${actionWord(s.x, 'doing [X]')}, −1 each time ${actionWord(s.y, 'doing [Y]')}.`,
    hooksWith: (s: TraitSetting) => ({
      onAction(e, ctx) {
        // Doing it: not being brought along by someone else.
        if (e.role !== 'actor') return;
        if (e.kind === s.x) moraleNow(ctx, 'Action', ONE, ACTION_WORD[e.kind]);
        else if (e.kind === s.y) moraleNow(ctx, 'Action', -ONE, ACTION_WORD[e.kind]);
      },
    }),
  }),
  morale('traveler', 'Traveler', '+1 Morale each move, −1 each time doing [X].', {
    setting: 'action',
    nameWith: (s: TraitSetting) =>
      isTraitAction(s.x) ? `Traveler (${ACTION_NAME[s.x]})` : 'Traveler',
    textWith: (s: TraitSetting) =>
      `+1 Morale each move, −1 each time ${actionWord(s.x, 'doing [X]')}.`,
    hooksWith: (s: TraitSetting) => ({
      onAction(e, ctx) {
        if (e.kind === 'move') moraleNow(ctx, 'Traveler', ONE, 'on the move');
        else if (e.kind === s.x && e.role === 'actor') {
          moraleNow(ctx, 'Traveler', -ONE, ACTION_WORD[e.kind]);
        }
      },
    }),
  }),
  morale(
    'conservationist',
    'Conservationist',
    '+1 Morale each time Tending on a tile with an [X] node, −1 each time scavenging an [X] node.',
    {
      setting: 'node',
      nameWith: (s: TraitSetting) =>
        isNode(s.x) ? `Conservationist (${NODE_WORD[s.x]})` : 'Conservationist',
      textWith: (s: TraitSetting) =>
        `+1 Morale each time Tending on a tile with ${nodeWord(s.x, '[X]')} node, −1 each time scavenging ${nodeWord(s.x, '[X]')} node.`,
      hooksWith: (s: TraitSetting) => ({
        onAction(e, ctx) {
          if (!isNode(s.x)) return;
          const word = NODE_WORD[s.x];
          if (e.kind === 'tend') {
            const nodes = ctx.state.section.tiles[e.tileId]?.nodes ?? [];
            if (nodes.some((n) => n.type === s.x)) {
              moraleNow(ctx, 'Conservationist', ONE, `tended a ${word} tile`);
            }
          } else if (e.kind === 'scavenge' && e.node === s.x) {
            moraleNow(ctx, 'Conservationist', -ONE, `scavenged a ${word} node`);
          }
        },
      }),
    },
  ),
  morale(
    'thrillSeekerMorale',
    'Thrill-Seeker',
    '+1 Morale each challenge passed. −1 Morale at the start of a day after facing no challenge.',
    {
      hooks: {
        ...atStartOfDay('Thrill-Seeker', (ctx) =>
          ctx.self.lastChallengeDay === ctx.state.day - 1
            ? undefined
            : { delta: -ONE, why: 'no challenge yesterday' },
        ),
        onChallengeResult(e, ctx) {
          if (e.passed && e.hikerIds.includes(ctx.self.id)) {
            moraleNow(ctx, 'Thrill-Seeker', ONE, 'passed a challenge');
          }
        },
      },
    },
  ),
  morale(
    'chatty',
    'Chatty',
    '+1 Morale sitting by the fire with others (they each gain 1 too). Start of day: −1 alone.',
    {
      waitsOn: 'Sit by the Fire (its +1 part)',
      hooks: {
        ...atStartOfDay('Chatty', (ctx) =>
          ctx.isAlone(ctx.self) ? { delta: -ONE, why: 'alone right now' } : undefined,
        ),
        onSitByFire(ctx) {
          const company = others(ctx);
          if (!company.length) return;
          moraleNow(ctx, 'Chatty', ONE, 'chatting by the fire');
          for (const h of company)
            ctx.changeStat(h, 'morale', ONE, 'Chatty', 'chatting by the fire');
        },
      },
    },
  ),
  morale('zen', 'Zen', 'Start of day: +2 Morale alone, −2 sharing a tile with 2 or more others.', {
    hooks: atStartOfDay('Zen', (ctx) =>
      plusMinus(
        { when: others(ctx).length === 0, why: 'alone right now' },
        { when: others(ctx).length >= 2, why: 'with 2 or more others' },
        N.zen,
      ),
    ),
  }),
  morale(
    'caring',
    'Caring',
    'Start of day: Morale is set to match the lowest Morale among the other hikers on the tile (it can go up or down).',
    {
      hooks: atStartOfDay('Caring', (ctx) => {
        const company = others(ctx);
        if (!company.length) return undefined;
        const lowest = Math.min(...company.map((h) => h.stats.morale));
        return { delta: lowest - ctx.self.stats.morale, why: 'sharing the mood here' };
      }),
    },
  ),
  morale(
    'alpha',
    'Alpha',
    'Start of day: +1 Morale on a tile with more Humans than Dogs, −1 on a tile with more Dogs than Humans.',
    {
      hooks: atStartOfDay('Alpha', (ctx) => {
        const here = ctx.hikersOnTile(ctx.self.tileId);
        const humans = here.filter((h) => h.family === 'human').length;
        const dogs = here.filter((h) => h.family === 'dog').length;
        return plusMinus(
          { when: humans > dogs, why: 'more Humans here' },
          { when: dogs > humans, why: 'more Dogs here' },
          ONE,
        );
      }),
    },
  ),
  morale(
    'extrovert',
    'Extrovert',
    'Start of day: +1 Morale sharing a tile with 2 or more other hikers, −1 alone.',
    {
      hooks: atStartOfDay('Extrovert', (ctx) =>
        plusMinus(
          { when: others(ctx).length >= 2, why: 'with 2 or more others' },
          { when: others(ctx).length === 0, why: 'alone right now' },
          ONE,
        ),
      ),
    },
  ),
  morale(
    'closeCompany',
    'Close Company',
    'Start of day: +1 Morale sharing a tile with exactly 1 other hiker, −1 on a tile with 3 or more hikers in total.',
    {
      hooks: atStartOfDay('Close Company', (ctx) =>
        plusMinus(
          { when: others(ctx).length === 1, why: 'with one other hiker' },
          { when: others(ctx).length >= 2, why: 'in a crowd' },
          ONE,
        ),
      ),
    },
  ),
  morale(
    'centerOfAttention',
    'Center of Attention',
    'Start of day: +1 Morale with the highest Morale on the tile, −1 if someone there has more.',
    {
      // TODO(wyatt): alone, there's nobody to compare with, so nothing happens; a tie is the highest.
      hooks: atStartOfDay('Center of Attention', (ctx) => {
        const company = others(ctx);
        if (!company.length) return undefined;
        const most = Math.max(...company.map((h) => h.stats.morale));
        return ctx.self.stats.morale >= most
          ? { delta: ONE, why: 'the highest Morale here' }
          : { delta: -ONE, why: 'someone here has more Morale' };
      }),
    },
  ),
  morale(
    'bossy',
    'Bossy',
    '+1 Morale each time moving the group. −1 Morale each time someone else moves this hiker with the group.',
    {
      hooks: {
        onMove(e, ctx) {
          if (e.via !== 'moveAll') return;
          if (e.role === 'actor') moraleNow(ctx, 'Bossy', ONE, 'led the group');
          else moraleNow(ctx, 'Bossy', -ONE, 'moved by someone else');
        },
      },
    },
  ),
  morale(
    'wanderlust',
    'Wanderlust',
    '+1 Morale each move to an unrevealed tile. −1 Morale at the start of a day after not moving the day before.',
    {
      hooks: {
        ...atStartOfDay('Wanderlust', (ctx) =>
          ctx.self.lastMovedDay === ctx.state.day - 1
            ? undefined
            : { delta: -ONE, why: 'didn’t move yesterday' },
        ),
        onMove(e, ctx) {
          if (e.firstVisit) moraleNow(ctx, 'Wanderlust', ONE, 'a new tile');
        },
      },
    },
  ),
  morale(
    'simplePleasures',
    'Simple Pleasures',
    '+1 Morale each time eating or sleeping. −1 Morale each time crafting.',
    {
      hooks: {
        onAction(e, ctx) {
          if (e.kind === 'eat' || e.kind === 'sleep') {
            moraleNow(ctx, 'Simple Pleasures', ONE, ACTION_WORD[e.kind]);
          } else if (e.kind === 'craft') {
            moraleNow(ctx, 'Simple Pleasures', -ONE, 'crafting is hard');
          }
        },
      },
    },
  ),
  morale(
    'slowAndSteady',
    'Slow and Steady',
    '+1 Morale each phase staying on the same tile. −2 Morale each move forward.',
    {
      hooks: {
        // A phase without moving at all.
        onPhaseEnd(_e, ctx) {
          if (ctx.used(ctx.self, 'moved', 'phase') === 0) {
            applyRule(ctx, 'Slow and Steady', () => ({ delta: ONE, why: 'stayed put' }));
          }
        },
        onMove(e, ctx) {
          const from = ctx.state.section.tiles[e.from];
          const to = ctx.state.section.tiles[e.to];
          if (from && to && to.row > from.row) {
            moraleNow(ctx, 'Slow and Steady', N.slowAndSteady.forward, 'moved forward');
          }
        },
      },
    },
  ),
  morale(
    'soccerMom',
    'Soccer Mom',
    '+1 Morale each time a hiker on the tile passes a challenge. −1 Morale each time one fails.',
    {
      hooks: {
        onChallengeResult(e, ctx) {
          if (e.passed) moraleNow(ctx, 'Soccer Mom', ONE, 'a challenge passed here');
          else moraleNow(ctx, 'Soccer Mom', -ONE, 'a challenge failed here');
        },
      },
    },
  ),
  morale(
    'proudMentor',
    'Proud Mentor',
    '+1 Morale each time a hiker on the tile levels up. Start of day: −1 alone.',
    {
      hooks: {
        ...atStartOfDay('Proud Mentor', (ctx) =>
          ctx.isAlone(ctx.self) ? { delta: -ONE, why: 'alone right now' } : undefined,
        ),
        onTileLevelUp(e, ctx) {
          if (e.hikerId !== ctx.self.id)
            moraleNow(ctx, 'Proud Mentor', ONE, 'someone here levelled up');
        },
      },
    },
  ),
];
