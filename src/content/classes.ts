/**
 * Classes (09-hikers.md, "Names and classes"; Phase 10.7): what a character
 * is good at, in 3 areas. A designed hiker's 3 trees are 3 classes.
 *
 * TRAITS_BY_CLASS is the old system's (07-characters.md): the classes of the
 * old traits, which the locked hikers still have. Family versions (Leash
 * Puller, Human Food, Copydog, Copycat) share their group's classes.
 */
import type { TraitDef } from '../engine/effects';
import type { ClassArea, ClassId } from '../engine/types';

export const CLASS_NAMES: Readonly<Record<ClassId, string>> = {
  leader: 'Leader',
  follower: 'Follower',
  scout: 'Scout',
  trekker: 'Trekker',
  scavenger: 'Scavenger',
  crafter: 'Crafter',
  chef: 'Chef',
  smith: 'Smith',
  tailor: 'Tailor',
  architect: 'Architect',
  packer: 'Packer',
  naturalist: 'Naturalist',
  merchant: 'Merchant',
  support: 'Support',
  entertainer: 'Entertainer',
  hardy: 'Hardy',
  watcher: 'Watcher',
  daredevil: 'Daredevil',
  jack: 'Jack',
};

/**
 * Class colors (09-hikers.md): the class tabs on hiker cards, the Class
 * sort's ribbons and each tree's trail in Skill Trails. Smith, Tailor,
 * Architect and the other new ones are first guesses. TODO(wyatt).
 */
export const CLASS_COLORS: Readonly<Record<ClassId, string>> = {
  leader: '#DC3B44',
  follower: '#E8806A',
  scout: '#3E8FC9',
  trekker: '#B0473A',
  scavenger: '#93A33A',
  crafter: '#3A7752',
  chef: '#6E8F2E',
  smith: '#A0703A',
  tailor: '#2C7C86',
  architect: '#6E7A3E',
  packer: '#8A6A3E',
  naturalist: '#4E9A7A',
  merchant: '#1FA39A',
  support: '#F0AB35',
  entertainer: '#D675EF',
  hardy: '#E27A2B',
  watcher: '#4A5FA8',
  daredevil: '#B23A48',
  jack: '#5F7487',
};

/** Each class's area (09-hikers.md): Movement, Resources or Utility. */
export const CLASS_AREA: Readonly<Record<ClassId, ClassArea>> = {
  leader: 'movement',
  follower: 'movement',
  scout: 'movement',
  trekker: 'movement',
  scavenger: 'resources',
  crafter: 'resources',
  chef: 'resources',
  smith: 'resources',
  tailor: 'resources',
  architect: 'resources',
  packer: 'resources',
  naturalist: 'resources',
  merchant: 'resources',
  support: 'utility',
  entertainer: 'utility',
  hardy: 'utility',
  watcher: 'utility',
  daredevil: 'utility',
  jack: 'utility',
};

/** What each area calls its trees: Leader Trail, Merchant Path, Daredevil Loop. */
export const AREA_WORD: Readonly<Record<ClassArea, string>> = {
  movement: 'Trail',
  resources: 'Path',
  utility: 'Loop',
};

export const AREA_NAMES: Readonly<Record<ClassArea, string>> = {
  movement: 'Movement',
  resources: 'Resources',
  utility: 'Utility',
};

/** "Leader Trail", "Merchant Path", "Daredevil Loop". */
export const treeName = (cls: ClassId): string =>
  `${CLASS_NAMES[cls]} ${AREA_WORD[CLASS_AREA[cls]]}`;

const CRAFTING_TIERS = ['Cook', 'Crafter', 'Architect', 'Tailor'].flatMap((t) => [
  `artisan${t}`,
  `master${t}`,
]);

/** "Existing traits by class (first pass)". A trait can be in two classes. */
export const TRAITS_BY_CLASS: Readonly<Partial<Record<ClassId, readonly string[]>>> = {
  leader: [
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
  merchant: ['charismatic', 'frugal', 'nonNonProfit', 'thrifty', 'mba', 'squirrely'],
  // TODO(wyatt): Follower isn't in the table; Jack is a first guess.
  jack: ['dayNapper', 'closer', 'dreamAlchemist', 'lapPet', 'follower'],
};

/** Open to every class: Strong and Backtracker. */
export const GENERAL_TRAITS: readonly string[] = ['strong', 'backtracker'];

/** Morale traits that aren't open to everyone: they stay with their owners. */
export const SPECIAL_MORALE: readonly string[] = [
  'misophonia',
  'rainLover',
  'moody',
  'showGirl',
  'bahHumbug',
];

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
