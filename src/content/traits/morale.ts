/**
 * Morale traits (purple). Traits about where a hiker is are checked at the
 * start of each day; traits about what a hiker does trigger right away, every
 * time. Morale traits have no tier, are always on, and are open to every
 * hiker (a few special ones are in special.ts). The table in
 * 02-traits-and-conditions.md, in its order.
 */
import { BALANCE } from '../../config/balance';
import type { TraitDef } from '../../engine/effects';
import type { TraitSetting } from '../../engine/types';
import { ACTION_NAME, ACTION_WORD, isTraitAction, NODE_WORD, isNode, morale } from './build';

const N = BALANCE.traits;

/** "a River node", or "an [X] node" before it's set. */
const nodeWord = (x: string | undefined, fallback: string) =>
  isNode(x) ? `a ${NODE_WORD[x]}` : `an ${fallback}`;
const actionWord = (x: string | undefined, fallback: string) =>
  isTraitAction(x) ? ACTION_WORD[x] : fallback;

export const MORALE_TRAITS: readonly TraitDef[] = [
  morale(
    'extrinsic',
    'Extrinsic',
    'Start of day: +1 Morale when sharing a tile with another hiker, −1 Morale when alone.',
    {
      hooks: {
        onStartOfDay(ctx) {
          const delta = ctx.isAlone(ctx.self) ? N.extrinsic.alone : N.extrinsic.together;
          ctx.changeStat(ctx.self, 'morale', delta, 'Extrinsic');
        },
      },
    },
  ),
  morale(
    'intrinsic',
    'Intrinsic',
    'Start of day: +1 Morale alone, −1 sharing a tile with 2 or more other hikers.',
  ),
  morale('foody', 'Foody', 'Start of day: +1 Morale at 8 or more Appetite, −1 at 5 or less.'),
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
    },
  ),
  morale(
    'fairWeather',
    'Fair-Weather',
    'Start of day: +1 Morale with no weather, −1 in rain or snow.',
  ),
  morale(
    'dressed',
    'Dressed',
    'Start of day: +1 Morale with 2 or more clothes equipped, −1 with none.',
  ),
  morale(
    'exhibitionist',
    'Exhibitionist',
    'Start of day: +1 Morale with no clothes equipped, −1 with 2 or more.',
  ),
  morale('action', 'Action', '+1 Morale each time doing [X], −1 each time doing [Y].', {
    setting: 'actions',
    nameWith: (s: TraitSetting) => (isTraitAction(s.x) ? `Action (${ACTION_WORD[s.x]})` : 'Action'),
    textWith: (s: TraitSetting) =>
      `+1 Morale each time ${actionWord(s.x, 'doing [X]')}, −1 each time ${actionWord(s.y, 'doing [Y]')}.`,
  }),
  morale('traveler', 'Traveler', '+1 Morale each move, −1 each time doing [X].', {
    setting: 'action',
    nameWith: (s: TraitSetting) =>
      isTraitAction(s.x) ? `Traveler (${ACTION_NAME[s.x]})` : 'Traveler',
    textWith: (s: TraitSetting) =>
      `+1 Morale each move, −1 each time ${actionWord(s.x, 'doing [X]')}.`,
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
    },
  ),
  morale(
    'thrillSeekerMorale',
    'Thrill-Seeker',
    '+1 Morale each challenge passed. −1 Morale at the start of a day after facing no challenge.',
  ),
  morale(
    'chatty',
    'Chatty',
    '+1 Morale sitting by the fire with others (they each gain 1 too). Start of day: −1 alone.',
    { waitsOn: 'Sit by the Fire (its +1 part)' },
  ),
  morale('zen', 'Zen', 'Start of day: +2 Morale alone, −2 sharing a tile with 2 or more others.'),
  morale(
    'caring',
    'Caring',
    'Start of day: Morale is set to match the lowest Morale among the other hikers on the tile (it can go up or down).',
  ),
  morale(
    'alpha',
    'Alpha',
    'Start of day: +1 Morale on a tile with more Humans than Dogs, −1 on a tile with more Dogs than Humans.',
  ),
  morale(
    'extrovert',
    'Extrovert',
    'Start of day: +1 Morale sharing a tile with 2 or more other hikers, −1 alone.',
  ),
  morale(
    'closeCompany',
    'Close Company',
    'Start of day: +1 Morale sharing a tile with exactly 1 other hiker, −1 on a tile with 3 or more hikers in total.',
  ),
  morale(
    'centerOfAttention',
    'Center of Attention',
    'Start of day: +1 Morale with the highest Morale on the tile, −1 if someone there has more.',
  ),
  morale(
    'bossy',
    'Bossy',
    '+1 Morale each time moving the group. −1 Morale each time someone else moves this hiker with the group.',
  ),
  morale(
    'wanderlust',
    'Wanderlust',
    '+1 Morale each move to an unrevealed tile. −1 Morale at the start of a day after not moving the day before.',
  ),
  morale(
    'simplePleasures',
    'Simple Pleasures',
    '+1 Morale each time eating or sleeping. −1 Morale each time crafting.',
  ),
  morale(
    'slowAndSteady',
    'Slow and Steady',
    '+1 Morale each phase staying on the same tile. −2 Morale each move forward.',
  ),
  morale(
    'soccerMom',
    'Soccer Mom',
    '+1 Morale each time a hiker on the tile passes a challenge. −1 Morale each time one fails.',
  ),
  morale(
    'proudMentor',
    'Proud Mentor',
    '+1 Morale each time a hiker on the tile levels up. Start of day: −1 alone.',
  ),
];
