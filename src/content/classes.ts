/**
 * Classes (07-characters.md, "Classes"): what a character is good at. A
 * level-up's Trail and Utility options come from the hiker's classes, from
 * Jack traits and from general traits. Morale traits have no class and are
 * open to everyone (except the special ones). Family versions (Leash Puller,
 * Human Food, Copydog, Copycat) share their group's classes.
 */
import type { TraitDef } from '../engine/effects';
import type { ClassId } from '../engine/types';

export const CLASS_NAMES: Readonly<Record<ClassId, string>> = {
  tank: 'Tank',
  hardy: 'Hardy',
  scavenger: 'Scavenger',
  crafter: 'Crafter',
  scout: 'Scout',
  support: 'Support',
  jack: 'Jack',
  entertainer: 'Entertainer',
  moneymaker: 'Moneymaker',
};

const CRAFTING_TIERS = ['Cook', 'Crafter', 'Architect', 'Tailor'].flatMap((t) => [
  `artisan${t}`,
  `master${t}`,
]);

/** "Existing traits by class (first pass)". A trait can be in two classes. */
export const TRAITS_BY_CLASS: Readonly<Record<ClassId, readonly string[]>> = {
  tank: [
    'leader',
    'puller',
    'mule',
    'sherpa',
    'supportive',
    'shrugOff',
    'trespasser',
    'herder',
    'petSitter',
  ],
  hardy: [
    'hardy',
    'stoic',
    'secondWind',
    'glutton',
    'neverHungry',
    'thrillSeeker',
    'photosynthesis',
    'nocturnal',
    'leadStomach',
    'destroyer',
  ],
  scavenger: [
    'forager',
    'copier',
    'copydog',
    'copycat',
    'finder',
    'hound',
    'pockets',
    'thumb',
    'gambler',
    'fortunate',
    'eagleEye',
    'pirate',
    'archaeologist',
    'ecoConscious',
    'fetch',
    'generous',
  ],
  crafter: [
    'collaborative',
    'focused',
    'chef',
    'carefulHands',
    ...CRAFTING_TIERS,
    'savvy',
    'handy',
    'talented',
    'lovinglyMade',
    'proficient',
    'germanEfficiency',
    'alchemist',
  ],
  scout: [
    'scout',
    'independent',
    'prepared',
    'tactical',
    'fast',
    'short',
    'prowler',
    'sneaker',
    'stalker',
    'trailer',
    'lookout',
  ],
  support: [
    'supportive',
    'therapist',
    'transparent',
    'susceptible',
    'splitter',
    'wise',
    'manager',
    'carrierPigeon',
    'dogWhisperer',
    'trainer',
    'mouser',
    'teacher',
  ],
  entertainer: ['singer', 'liberal', 'wise'],
  moneymaker: ['charismatic', 'frugal', 'nonNonProfit', 'thrifty', 'mba', 'squirrely'],
  // TODO(wyatt): Follower isn't in the table; Jack is a first guess.
  jack: ['dayNapper', 'closer', 'dreamAlchemist', 'lapPet', 'follower'],
};

/** Open to every class: Strong and Backtracker. */
export const GENERAL_TRAITS: readonly string[] = ['strong', 'backtracker'];

/** Morale traits that aren't open to everyone: they stay with their owners. */
export const SPECIAL_MORALE: readonly string[] = ['misophonia', 'rainLover', 'moody', 'showGirl'];

const CLASSES_OF = new Map<string, ClassId[]>();
for (const [cls, ids] of Object.entries(TRAITS_BY_CLASS) as [ClassId, readonly string[]][]) {
  for (const id of ids) CLASSES_OF.set(id, [...(CLASSES_OF.get(id) ?? []), cls]);
}

/** A trait's classes; a family version shares its group's (Leash Puller is Puller's). */
export function classesOf(def: Pick<TraitDef, 'id' | 'group'>): readonly ClassId[] {
  return CLASSES_OF.get(def.id) ?? (def.group ? (CLASSES_OF.get(def.group) ?? []) : []);
}

/** Open to every class (Strong, Backtracker). */
export const isGeneral = (def: Pick<TraitDef, 'id'>): boolean => GENERAL_TRAITS.includes(def.id);
