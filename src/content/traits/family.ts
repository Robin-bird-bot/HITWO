/**
 * Family traits (02-traits-and-conditions.md, "Families"): only hikers of
 * certain families can have them. "Pets" are Dogs and Cats. Plush hikers
 * aren't real pets, so traits for Dogs or Pets don't count them.
 */
import type { TraitDef } from '../../engine/effects';
import { family, morale, PETS, trail, utility } from './build';
import { COPY_TEXT, copyHooks } from './utility';

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
  // Family Morale traits (checked at the start of the day).
  morale(
    'dogLover',
    'Dog Lover',
    'Start of day: +1 Morale sharing a tile with a Dog, −1 with no Dog on the tile.',
    family('human'),
  ),
  morale(
    'catPerson',
    'Cat Person',
    'Start of day: +1 Morale sharing a tile with a Cat, −1 with no Cat on the tile.',
    family('human'),
  ),
  morale(
    'loyal',
    'Loyal',
    'Start of day: +1 Morale sharing a tile with a Human, −1 with no Human on the tile.',
    family(...PETS),
  ),
  morale(
    'packAnimal',
    'Pack Animal',
    'Start of day: +1 Morale sharing a tile with another Dog, −1 with no other Dog on the tile.',
    family('dog'),
  ),
  morale(
    'aloof',
    'Aloof',
    'Start of day: +1 Morale with no Dog on the tile, −1 sharing a tile with a Dog.',
    family('cat'),
  ),
];
