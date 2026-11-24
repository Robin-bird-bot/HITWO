/**
 * The real roster (docs/design/07-characters.md, Phase 10b): every character
 * and variant, all unlocked for now. Each one is a HikerSetup the engine can
 * start a run with, plus what the screens need: title, roles (classes, main
 * first), the hidden difficulty, the real-life households for the Family
 * sort, the portrait and the starting bag.
 *
 * Ids are the 07-characters.md ids that special and unique traits name as
 * their owners (src/content/traits/special.ts).
 */
import type { HikerSetup, StartingBag } from '../engine/newGame';
import type { ClassId, Family, SlotType, TraitSetting } from '../engine/types';
import { DESIGNED_HIKERS } from './trails/trees';

/** Real-life families, for the selection screen's Family sort ("household" in code). */
export type HouseholdId = 'elmers' | 'brooks' | 'sherman' | 'leichty' | 'holiday' | 'other';

export interface RosterHiker extends HikerSetup {
  characterId: string;
  /** Shown under the name in capitals and quotes; none yet for Ben, Mindy and most variants. */
  title?: string;
  /** One of the 10 available from the start. */
  starter?: true;
  /**
   * Locked (Phase 10.7): only the hikers with Skill Trails can be picked. A
   * locked hiker keeps their data as it is until their trees come (10.7b).
   */
  locked?: true;
  /** A variant: the hiker it's a version of. */
  variantOf?: string;
  /** How hard they are to play well, 1–10. Never shown in the game. */
  difficulty: number;
  /**
   * Their real-life families, in the order the Family sort lists them. A
   * variant is Other unless it's given one (the holiday hikers: Holiday).
   */
  households: readonly HouseholdId[];
  /** The file in public/assets/portraits/, or none yet. */
  portrait?: string;
  startingBag: StartingBag;
}

/** "T leader", "M location:river/mountain", "T/U -" (open). */
function slots(...specs: string[]): HikerSetup['slots'] {
  return specs.map((spec) => {
    const [type = 'W', written = '-'] = spec.split(' ');
    if (written === '-') return { type: type as SlotType, traitId: null };
    const [traitId = '', set] = written.split(':');
    const [x, y] = set ? set.split('/') : [];
    const setting: TraitSetting | undefined = x ? { x, ...(y ? { y } : {}) } : undefined;
    return { type: type as SlotType, traitId, ...(setting ? { setting } : {}) };
  });
}

type Entry = Omit<RosterHiker, 'id' | 'characterId' | 'households'> & {
  households?: readonly HouseholdId[];
};

function hiker(
  id: string,
  name: string,
  family: Family,
  classes: ClassId[],
  rest: Omit<Entry, 'name' | 'family' | 'classes'>,
): RosterHiker {
  return { id, characterId: id, name, family, classes, households: [], ...rest } as RosterHiker;
}

const items = (...ids: string[]): StartingBag => ({ items: ids });

/** In the roster's order: the 10 starters first, then families, then the variants. */
const ENTRIES: RosterHiker[] = [
  // ── Starters (07-characters.md, "Roster") ──
  hiker('wyatt', 'Wyatt', 'human', ['naturalist', 'daredevil', 'smith'], {
    title: 'Rain Hiker',
    starter: true,
    // Phase 10.7: Skill Trails (src/content/trails/trees.ts) in place of slots.
    slots: [],
    difficulty: 7,
    portrait: 'wyatt',
    startingBag: items('rainJacket'),
  }),
  hiker('mom', 'Mom', 'human', ['support', 'merchant', 'trekker'], {
    title: 'Doesn’t Like Photos',
    starter: true,
    // Phase 10.7: Skill Trails (src/content/trails/trees.ts) in place of slots.
    slots: [],
    difficulty: 3,
    portrait: 'mom',
    startingBag: { items: ['dogFood'], blueprints: { count: 1, tier: 1 } },
  }),
  hiker('ellie', 'Ellie', 'dog', ['chef', 'scavenger', 'entertainer'], {
    title: 'Fluffy Not Fat',
    starter: true,
    // Phase 10.7: Skill Trails (src/content/trails/trees.ts) in place of slots.
    slots: [],
    difficulty: 5,
    portrait: 'ellie',
    startingBag: items('mysteryMeat'),
  }),
  hiker('finn', 'Finn', 'dog', ['leader', 'follower', 'scavenger'], {
    title: 'The Follower',
    starter: true,
    // Phase 10.7: Skill Trails (src/content/trails/trees.ts) in place of slots.
    slots: [],
    difficulty: 2,
    portrait: 'finn',
    startingBag: items('leash'),
  }),
  hiker('gdog', 'Gdog', 'human', ['chef', 'tailor', 'trekker'], {
    title: 'The Tiny',
    starter: true,
    // Phase 10.7: Skill Trails (src/content/trails/trees.ts) in place of slots.
    slots: [],
    difficulty: 4,
    portrait: 'gdog',
    startingBag: { blueprints: { count: 2, tier: 1, type: 'food' } },
  }),
  hiker('grandpaWink', 'Grandpa Wink', 'human', ['leader', 'architect', 'packer'], {
    title: 'Always Prepared',
    starter: true,
    // Phase 10.7: Skill Trails (src/content/trails/trees.ts) in place of slots.
    slots: [],
    difficulty: 5,
    portrait: 'wink',
    startingBag: items('hikingStick'),
  }),
  hiker('cody', 'Cody', 'dog', ['leader'], {
    title: 'The King Red',
    starter: true,
    slots: slots('T alphaDog', 'T humanFood', 'M alpha'),
    difficulty: 4,
    portrait: 'cody',
    // Phase 10.6: dillRolls is switched off, so Trail Mix (Quality rolls as before).
    startingBag: items('trailMix'),
  }),
  hiker('grandpaSherman', 'Grandpa Sherman', 'human', ['leader', 'jack'], {
    title: 'Probably Trespassing',
    starter: true,
    // Location (Beach): +1 on a River node, −1 on a Mountain node.
    slots: slots('T tankButt', 'T trespasser', 'U zany', 'M location:river/mountain'),
    difficulty: 7,
    portrait: 'sherman',
    startingBag: items('hardhat'),
  }),
  hiker('pearl', 'Pearl', 'dog', ['scout', 'scavenger'], {
    title: 'The Pirate',
    starter: true,
    slots: slots('T wanderer', 'U pirate', 'M wanderlust'),
    difficulty: 4,
    portrait: 'pearl',
    startingBag: items('binoculars'),
  }),
  hiker('brutus', 'Brutus', 'dog', ['hardy'], {
    title: 'Doesn’t Know Where He Is',
    starter: true,
    slots: slots('T forgetful', 'U snores', 'T/U -', 'M simplePleasures'),
    difficulty: 3,
    portrait: 'brutus',
    startingBag: items('pajamas'),
  }),

  // ── Dogs ──
  hiker('duke', 'Duke', 'dog', ['support'], {
    title: 'The Middle Red',
    slots: slots('T lanky', 'U goodBoy', 'M closeCompany'),
    difficulty: 5,
    portrait: 'duke',
    startingBag: items('stuffedAnimal'),
  }),
  hiker('scarlet', 'Scarlet', 'dog', ['hardy'], {
    title: 'The Bossy Red',
    slots: slots('T strong', 'U spoiled', 'M centerOfAttention'),
    difficulty: 3,
    portrait: 'scarlet',
    startingBag: items('snackPack'),
  }),
  hiker('hershal', 'Hershal', 'dog', ['support'], {
    title: 'The Wise Old Man',
    slots: slots('U mentor', 'U storyteller', 'M proudMentor'),
    difficulty: 3,
    portrait: 'hershal',
    startingBag: items('postcard'),
  }),
  hiker('sinjon', 'Sinjon', 'dog', ['leader'], {
    title: 'Tough and Fluff',
    slots: slots('T fluffArmor', 'U wise', 'M alpha'),
    difficulty: 2,
    portrait: 'sinjon',
    startingBag: items('heavyJacket'),
  }),
  hiker('kai', 'Kai', 'dog', ['support'], {
    title: 'Crazy Like His Dad',
    slots: slots('T trailer', 'U hypeDog', 'M loyal'),
    difficulty: 4,
    portrait: 'kai',
    // Phase 10.6: citroDrink is switched off, so Trail Mix (Quality rolls as before).
    startingBag: items('trailMix'),
  }),
  hiker('bossGracie', 'Boss & Gracie', 'dog', ['support', 'scavenger'], {
    title: 'Danger Duo',
    duo: ['Boss', 'Gracie'],
    slots: slots('T herder', 'U fetch', 'tag bossGracie', 'M loyal'),
    difficulty: 8,
    portrait: 'boss-and-gracie',
    startingBag: items('fannyPack'),
  }),

  // ── Plush ──
  hiker('pepper', 'Pepper', 'plush', ['scout'], {
    title: 'The Troublemaker',
    slots: slots('T shifty', 'T nightShifty', 'M intrinsic'),
    difficulty: 9,
    portrait: 'pepper',
    startingBag: items('lightUpSkechers'),
  }),
  hiker('goldie', 'Goldie', 'plush', ['support'], {
    title: 'The Good One',
    slots: slots('U luckyCharm', 'U cuddleBuddy', 'M extrinsic'),
    difficulty: 6,
    portrait: 'goldie',
    startingBag: items('cozySweater'),
  }),

  // ── Cats ──
  hiker('loki', 'Loki', 'cat', ['leader'], {
    title: 'The Mean',
    slots: slots('T leader', 'T stoic', 'M bossy'),
    difficulty: 5,
    portrait: 'loki',
    startingBag: items('backpack'),
  }),
  hiker('coco', 'Coco', 'cat', ['scout'], {
    title: 'The Cat',
    slots: slots('U nocturnal', 'U mouser', 'M aloof'),
    difficulty: 4,
    portrait: 'coco',
    startingBag: items('campingLamp'),
  }),
  hiker('muffin', 'Muffin', 'cat', ['crafter'], {
    title: 'The Cat',
    slots: slots('U focused', 'U savvy', 'M zen'),
    difficulty: 3,
    portrait: 'muffin',
    startingBag: { blueprints: { count: 1, tier: 1, type: 'tool' } },
  }),

  // ── Humans ──
  hiker('catie', 'Catie', 'human', ['crafter', 'entertainer'], {
    title: 'The Artist',
    // Action (crafting): +1 crafting, −1 scavenging.
    slots: slots('U nuggetPuker', 'U artist', 'T/U linguist', 'M action:craft/scavenge'),
    difficulty: 4,
    portrait: 'catie',
    startingBag: { blueprints: { count: 1, tier: 1 } },
  }),
  hiker('melissa', 'Melissa', 'human', ['support', 'scout'], {
    title: 'The Bossy',
    slots: slots('T coach', 'T fast', 'M soccerMom', 'M bossy'),
    difficulty: 6,
    portrait: 'melissa',
    startingBag: items('trailShoes'),
  }),
  hiker('leah', 'Leah', 'human', ['support'], {
    title: 'The Short One',
    slots: slots('T rabbitDiet', 'T short', 'T/U supportive', 'M chatty'),
    difficulty: 6,
    portrait: 'leah',
    startingBag: items('bandaid'),
  }),
  hiker('erin', 'Erin', 'human', ['crafter', 'support'], {
    title: 'Modern Art',
    slots: slots('U artisanArchitect', 'U collaborative', 'U teacher', 'M chatty'),
    difficulty: 4,
    portrait: 'erin',
    startingBag: { blueprints: { count: 1, tier: 1, type: 'shelter' } },
  }),
  hiker('jackson', 'Jackson', 'human', ['scavenger'], {
    title: 'The Homebody',
    slots: slots('U archaeologist', 'U thumb:forest', 'M conservationist:forest'),
    difficulty: 3,
    portrait: 'jackson',
    startingBag: items('trowel'),
  }),
  hiker('anni', 'Anni', 'human', ['scout'], {
    title: 'The Traveler',
    slots: slots('T independent', 'T scout', 'M traveler:tend'),
    difficulty: 2,
    portrait: 'anni',
    startingBag: items('supplyMap'),
  }),
  hiker('mitchell', 'Mitchell', 'human', ['crafter'], {
    title: 'Cat Lover',
    slots: slots('U stylish', 'U carefulHands', 'M extrinsic', 'M catPerson'),
    difficulty: 5,
    portrait: 'mitchell',
    startingBag: items('flannel'),
  }),
  hiker('nathan', 'Nathan', 'human', ['entertainer'], {
    title: 'The Singer',
    slots: slots('U singer', 'U liberal', 'M dressed'),
    difficulty: 4,
    portrait: 'nathan',
    startingBag: items('ukulele'),
  }),
  hiker('ben', 'Ben', 'human', ['hardy'], {
    slots: slots('T thrillSeeker', 'T shrugOff', 'M thrillSeekerMorale'),
    difficulty: 3,
    startingBag: items('survivalKit'),
  }),
  hiker('mindy', 'Mindy', 'human', ['support', 'entertainer'], {
    slots: slots('T transparent', 'U therapist', 'M chatty'),
    difficulty: 5,
    startingBag: items('helloKittyBandaid'),
  }),
  hiker('madeline', 'Madeline', 'human', ['support', 'entertainer'], {
    title: 'The Crazy Therapist',
    slots: slots('U therapist', 'U comedian', 'M extrovert'),
    difficulty: 4,
    portrait: 'madeline',
    // Phase 10.6: wine is switched off, so Trail Mix (Quality rolls as before).
    startingBag: items('trailMix'),
  }),

  // ── Variants (07-characters.md, "Variants") ──
  // The costume portraits fit the whole costume, so they aren't on the others' head scale
  // (holiday-hikers-2): drawn as they are, never rescaled.
  hiker('followerFinn', 'Follower Finn', 'dog', ['scavenger'], {
    variantOf: 'finn',
    slots: slots('T follower', 'U copydog', 'U forager', 'M extrinsic'),
    difficulty: 3,
    portrait: 'follower-finn',
    startingBag: items('sack'),
  }),
  hiker('agilityFinn', 'Agility Finn', 'dog', ['scout'], {
    variantOf: 'finn',
    slots: slots('T fast', 'T scout', 'T backtracker', 'M extrovert'),
    difficulty: 4,
    portrait: 'agility-finn',
    startingBag: items('joggingShoes'),
  }),
  hiker('ellieDevourer', 'Ellie the Devourer', 'dog', ['hardy'], {
    variantOf: 'ellie',
    // TODO(wyatt): the table says Glutton; a Dog gets its Dog name, Human Food (like Cody).
    slots: slots('T humanFood', 'U leadStomach', 'U garbageGut', 'M foody'),
    difficulty: 4,
    portrait: 'devourer-ellie',
    startingBag: items('dogFood', 'dogFood'),
  }),
  hiker('noseworkEllie', 'Nosework Ellie', 'dog', ['scavenger'], {
    variantOf: 'ellie',
    slots: slots('U nosework', 'U fetch', 'M bossy'),
    difficulty: 6,
    portrait: 'nosework-ellie',
    startingBag: items('treasureMap'),
  }),
  hiker('preparedWink', 'Prepared Wink', 'human', ['scout'], {
    variantOf: 'grandpaWink',
    // TODO(wyatt): Traveler needs an action and the doc doesn't give one; Tend, like Anni's.
    slots: slots('T prepared', 'T scout', 'M traveler:tend'),
    difficulty: 3,
    portrait: 'prepared-wink',
    startingBag: items('tent', 'binoculars', 'scanner'),
  }),
  hiker('graduateMom', 'Graduate Mom', 'human', ['merchant'], {
    variantOf: 'mom',
    slots: slots('U mba', 'U nonNonProfit', 'U frugal', 'M wanderlust'),
    difficulty: 5,
    portrait: 'graduate-mom',
    startingBag: items('diploma', 'wallet'),
  }),
  hiker('showqueenGdog', 'Showqueen Gdog', 'human', ['entertainer'], {
    variantOf: 'gdog',
    slots: slots('U singer', 'U liberal', 'M showGirl', 'M caring'),
    difficulty: 7,
    portrait: 'showqueen-gdog',
    startingBag: items('fancyAttire'),
  }),
  hiker('wywee', 'Wywee', 'human', ['leader', 'support'], {
    variantOf: 'wyatt',
    slots: slots('T easyMode', 'T supportive', 'M rainLover'),
    difficulty: 2,
    portrait: 'wywee',
    startingBag: items('trooperMask'),
  }),

  // ── Holiday hikers (07-characters.md, "Holiday hikers"): variants in their own Holiday group ──
  hiker('grammyClause', 'Grammy Clause', 'human', ['crafter', 'support'], {
    title: 'The Festive',
    variantOf: 'gdog',
    households: ['holiday'],
    slots: slots('U giftWrapper', 'U downTheChimney', 'U checkingItTwice', 'M seasonOfGiving'),
    difficulty: 6,
    portrait: 'grammy-clause',
    startingBag: { presents: 2 },
  }),
  hiker('lelf', 'Lelf', 'human', ['crafter', 'support'], {
    title: 'The Little Helper',
    variantOf: 'leah',
    households: ['holiday'],
    slots: slots('T short', 'U toyMaker', 'U spareParts', 'M holidaySpirit'),
    difficulty: 4,
    portrait: 'lelf',
    startingBag: { blueprints: { count: 1, tier: 1, type: 'tool' } },
  }),
  hiker('grinch', 'Grinch', 'dog', ['scavenger', 'jack'], {
    title: 'The Grumpy',
    variantOf: 'ellie',
    households: ['holiday'],
    slots: slots('U choosy', 'U twoSizesTooSmall', 'T/U wreckTheHalls', 'M bahHumbug'),
    difficulty: 5,
    portrait: 'grinch',
    startingBag: { presents: 1 },
  }),
  hiker('redolf', 'Redolf', 'dog', ['leader', 'scout'], {
    title: 'The Rednose Retriever',
    variantOf: 'cody',
    households: ['holiday'],
    slots: slots('T rednose', 'U treatSniffer', 'U presentMuncher', 'M holidaySpirit'),
    difficulty: 4,
    portrait: 'redolf',
    startingBag: items('campingLamp'),
  }),
];

/**
 * The Family sort's groups (07-characters.md, "Sorting the hiker selection
 * screen"; holiday-hikers-2): each household's ribbon color and its hikers in
 * order. A variant is Other unless it's given a household (the holiday
 * hikers' Holiday); everyone else not listed is Other too.
 */
export const HOUSEHOLDS: readonly {
  id: HouseholdId;
  name: string;
  color: string;
  members: readonly string[];
}[] = [
  {
    id: 'elmers',
    name: 'Elmers',
    color: '#B5543A',
    members: [
      'wyatt',
      'mom',
      'ellie',
      'finn',
      'cody',
      'duke',
      'scarlet',
      'hershal',
      'sinjon',
      'brutus',
    ],
  },
  {
    id: 'brooks',
    name: 'Brooks',
    color: '#3D7EA6',
    members: ['mom', 'gdog', 'grandpaWink', 'pepper', 'melissa', 'muffin', 'coco'],
  },
  {
    id: 'sherman',
    name: 'Sherman',
    color: '#D08A2E',
    members: ['grandpaSherman', 'pearl', 'kai', 'catie', 'mitchell', 'nathan', 'madeline'],
  },
  {
    id: 'leichty',
    name: 'Leichty',
    color: '#4E8F5A',
    members: ['erin', 'jackson', 'anni', 'bossGracie'],
  },
  {
    id: 'holiday',
    name: 'Holiday',
    color: '#A8233A',
    members: ['grammyClause', 'lelf', 'grinch', 'redolf'],
  },
  { id: 'other', name: 'Other', color: '#6B6F78', members: [] },
];

/**
 * A hiker's households: the ones they're given (the holiday hikers), or the
 * ones listing them. A variant only has the households it's given, so the
 * family groups stay the real family; anyone in none is Other.
 */
function householdsOf(h: RosterHiker): HouseholdId[] {
  if (h.households.length) return [...h.households];
  if (h.variantOf) return ['other'];
  const found = HOUSEHOLDS.filter((g) => g.members.includes(h.id)).map((g) => g.id);
  return found.length ? found : ['other'];
}

export const ROSTER: readonly RosterHiker[] = ENTRIES.map((h) => ({
  ...h,
  households: householdsOf(h),
  ...(DESIGNED_HIKERS.includes(h.id) ? {} : { locked: true as const }),
}));

/** Can this hiker be picked? Only the hikers with Skill Trails, for now. */
export const isPlayable = (id: string): boolean => {
  const h = ROSTER_BY_ID.get(id);
  return !!h && !h.locked;
};

export const ROSTER_BY_ID: ReadonlyMap<string, RosterHiker> = new Map(ROSTER.map((h) => [h.id, h]));

/** The hiker a variant is based on, or the hiker itself. */
export const baseOf = (id: string): string => ROSTER_BY_ID.get(id)?.variantOf ?? id;

/**
 * No cloning (07-characters.md, "Variants"): a hiker can't join if they, their
 * base hiker or another of their variants is already in the party. Returns
 * who's in the way, or undefined when they can join.
 */
export function blockedBy(party: readonly string[], id: string): string | undefined {
  const base = baseOf(id);
  return party.find((other) => other !== id && baseOf(other) === base);
}

export const canJoin = (party: readonly string[], id: string): boolean =>
  isPlayable(id) && !party.includes(id) && !blockedBy(party, id);

/**
 * A new hike's party until the player picks one (the debug panel's "new
 * game"): the first four starters. TODO(wyatt): first guess.
 */
export const DEFAULT_PARTY: readonly RosterHiker[] = ROSTER.filter(
  (h) => h.starter && !h.locked,
).slice(0, 4);
