/**
 * Family traits (02-traits-and-conditions.md, "Families"): only hikers of
 * certain families can have them. "Pets" are Dogs and Cats. Plush hikers
 * aren't real pets, so traits for Dogs or Pets don't count them.
 */
import { BALANCE } from '../../config/balance';
import type { TraitDef } from '../../engine/effects';
import type { Family } from '../../engine/types';
import { atStartOfDay, othersOf } from './moraleKit';
import { family, morale, PETS, trail, utility } from './build';
import { COPY_TEXT, copyHooks } from './utility';

const ONE = BALANCE.traits.morale;

/** Start of day: +1 with someone of this family on the tile, −1 without. */
const withOrWithout = (name: string, who: Family, word: string) =>
  atStartOfDay(name, (ctx) =>
    othersOf(ctx, who).length
      ? { delta: ONE, why: `with ${word}` }
      : { delta: -ONE, why: `no ${word.replace(/^(a|another) /, '')} here` },
  );

export const FAMILY_TRAITS: readonly TraitDef[] = [
  trail(1, 'lapPet', 'Lap Pet', 'Being moved with the group by a Human costs nothing extra.', {
    ...family(...PETS),
  }),
  trail(
    1,
    'petSitter',
    'Pet Sitter',
    'Pets brought along by this hiker’s Move All cost nothing extra.',
    family('human'),
  ),
  trail(
    2,
    'herder',
    'Herder',
    'Humans brought along by this hiker’s Move All cost nothing extra.',
    family('dog'),
  ),
  utility(2, 'copycat', 'Copycat', COPY_TEXT, {
    ...family('cat'),
    group: 'copier',
    hooks: copyHooks('Copycat', 0),
  }),
  utility(
    2,
    'dogWhisperer',
    'Dog Whisperer',
    'Dogs on this hiker’s tile get +1 card to choose from when scavenging.',
    family('human'),
  ),
  utility(
    2,
    'fetch',
    'Fetch',
    'Once per day, as a free action, takes 1 resource from a hiker on an adjacent tile.',
    family('dog'),
  ),
  utility(
    2,
    'mouser',
    'Mouser',
    'Night events that take food or resources skip hikers on this hiker’s tile.',
    family('cat'),
  ),
  utility(1, 'trainer', 'Trainer', 'Pets on this hiker’s tile gain 50% more XP.', family('human')),
  // Family Morale traits (checked at the start of the day). Plush hikers aren't Dogs or Cats.
  morale(
    'dogLover',
    'Dog Lover',
    'Start of day: +1 Morale sharing a tile with a Dog, −1 with no Dog on the tile.',
    { ...family('human'), hooks: withOrWithout('Dog Lover', 'dog', 'a Dog') },
  ),
  morale(
    'catPerson',
    'Cat Person',
    'Start of day: +1 Morale sharing a tile with a Cat, −1 with no Cat on the tile.',
    { ...family('human'), hooks: withOrWithout('Cat Person', 'cat', 'a Cat') },
  ),
  morale(
    'loyal',
    'Loyal',
    'Start of day: +1 Morale sharing a tile with a Human, −1 with no Human on the tile.',
    { ...family(...PETS), hooks: withOrWithout('Loyal', 'human', 'a Human') },
  ),
  morale(
    'packAnimal',
    'Pack Animal',
    'Start of day: +1 Morale sharing a tile with another Dog, −1 with no other Dog on the tile.',
    { ...family('dog'), hooks: withOrWithout('Pack Animal', 'dog', 'another Dog') },
  ),
  morale(
    'aloof',
    'Aloof',
    'Start of day: +1 Morale with no Dog on the tile, −1 sharing a tile with a Dog.',
    {
      ...family('cat'),
      hooks: atStartOfDay('Aloof', (ctx) =>
        othersOf(ctx, 'dog').length
          ? { delta: -ONE, why: 'a Dog is here' }
          : { delta: ONE, why: 'no Dog here' },
      ),
    },
  ),
];
