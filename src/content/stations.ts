/**
 * The nine ranger station themes (docs/design/06-ranger-stations.md, Nov 13).
 * Rocco runs two of them, so there are eight shopkeepers. Featured item names
 * match 03-items.md; Hot Cocoa and Lemonade aren't built, so they're left out.
 * Every line is a placeholder in the shopkeeper's voice; the first greeting is
 * the doc's quote.
 */
import type { BiomeId } from '../engine/types';
import type { StationTheme, StationThemeId } from '../engine/station/types';

const SOCKS = ['dogSocks', 'catSocks', 'soupSocks', 'sleepySocks', 'speedySocks'] as const;

/** Dr. Sckhunk's medical items, of any type (7-Up; Hot Cocoa and Lemonade if they get built). */
const DOCTOR = [
  'bandaid',
  'helloKittyBandaid',
  'bandages',
  'ointment',
  'healingSpray',
  'crutches',
  'medkit',
  'humidifier',
  'stuffedAnimal',
  'sevenUp',
  'hardhat',
  'pufferJacket',
  'harness',
  'medicTent',
] as const;

/** Bea-R-E-I's hiking gear: shoes, packs, sticks and tents. */
const HIKING_GEAR = [
  'hikingStick',
  'backpack',
  'fannyPack',
  'rainJacket',
  'flannel',
  'trailShoes',
  'joggingShoes',
  'hikingCrocs',
  'workBoots',
  'liftedBoots',
  'toeShoes',
  'tent',
  'hammock',
  'binoculars',
  'supplyMap',
  'campingLamp',
  'trailMix',
  'jerky',
  'bearSpray',
] as const;

/** Bearnes and Nobles: socks, XP items and scouting tools. */
const BOOKS = [
  ...SOCKS,
  'thinkingCap',
  'vrHeadset',
  'glasses',
  'scanner',
  'securityCamera',
  'minesweeper',
  'linescan',
  'radarScanner',
  'binoculars',
  'telescope',
] as const;

export const STATION_THEMES: readonly StationTheme[] = [
  {
    id: 'finn',
    name: 'Fancy Finn’s Fashion Franchise',
    shopkeeper: { name: 'Finn', portrait: 'fancy-finn' },
    focus: { type: 'clothes' },
    blueprints: { type: 'clothes' },
    featured: [
      'fancyAttire',
      'cozySweater',
      'flannel',
      'pufferJacket',
      'rainJacket',
      'heavyJacket',
      'lightUpSkechers',
      'hikingCrocs',
      'discoHarness',
      'fannyPack',
      ...SOCKS,
      'clothingPatch',
    ],
    lines: {
      greet: [
        'You came to MY shop?! *wiggle wiggle* Pets first, then shopping!',
        'Oh! Oh! Customers! *wiggle* Do you like my outfit? Do you like ME?',
        'Everything here is so fancy. Almost as fancy as me! *wiggle wiggle wiggle*',
      ],
      selling: 'Here’s what folks are paying this week! *wiggle* Pet me and I’ll tell you more!',
      ahead: 'Out there? Dress warm! And cute! Mostly cute. *wiggle*',
      bye: 'Come back soon! I’ll miss you SO much! *sad wiggle*',
    },
    placeholder: true,
  },
  {
    id: 'chefBear',
    name: 'Chef Bear’s Garbage Grill',
    shopkeeper: { name: 'Ellie', portrait: 'chef-bear-ellie' },
    focus: { type: 'food' },
    blueprints: { type: 'food' },
    featured: [
      'hotlipsPizzaStick',
      'dominosPizza',
      'rotisserieChicken',
      'mysteryMeat',
      'meatballSoup',
      'fishAndChips',
      'costcoSample',
      'oldSpaghettiFactory',
      'dogFood',
      'pukedNuggets',
    ],
    lines: {
      greet: [
        'WELCOME!!! TRY THE DIRT!!! IT’S FRESH TODAY!!!',
        'HUNGRY?!? I GOT PLASTIC!!! I GOT NUGGETS!!! ONE OF THOSE IS FOOD!!!',
        'EAT SOMETHING!!! YOU LOOK SKINNY!!! HAVE A BOTTLE CAP!!!',
      ],
      selling: 'THIS IS WHAT’S HOT THIS WEEK!!! NOT AS HOT AS MY GRILL!!!',
      ahead: 'PACK SNACKS!!! LOTS OF SNACKS!!! DIRT COUNTS AS A SNACK!!!',
      bye: 'BYE!!! COME BACK HUNGRY!!!',
    },
    placeholder: true,
  },
  {
    id: 'wink',
    name: 'Sleepy Wink’s Pillow Fort',
    shopkeeper: { name: 'Wink', portrait: 'sleepy-wink' },
    focus: { type: 'shelter' },
    blueprints: { type: 'shelter' },
    featured: [
      'hammock',
      'tent',
      'cabin',
      'hostel',
      'yurt',
      'pajamas',
      'sleepySocks',
      'campingLamp',
      'coffee',
    ],
    favoredTrinkets: ['energySerum'],
    lines: {
      greet: [
        'Zzz... welcome... zzz... tents in the back... zzzhonk...',
        'Zzz... mmh... pillows... are free... zzz... no they’re not... zzz...',
        'Zzzhonk... just... take what you need... zzz... leave caps... zzz...',
      ],
      selling: 'Zzz... prices... somewhere... zzz... on the... zzzhonk...',
      ahead: 'Zzz... sleep before you go... zzz... sleep after... zzz...',
      bye: 'Zzz... g’night... zzz...',
    },
    placeholder: true,
  },
  {
    id: 'businessman',
    name: 'Serious Businessman’s Sophisticated Selection',
    shopkeeper: {
      name: 'The Businessman',
      portrait: 'serious-businessman',
      arm: 'serious-businessman-arm',
    },
    focus: { type: 'tool' },
    blueprints: { type: 'tool' },
    featured: [
      'swissArmyKnife',
      'telescope',
      'droneCamera',
      'securityCamera',
      'radarScanner',
      'walkieTalkie',
      'paver',
      'wheelbarrow',
      'industrialFertilizer',
      'planter',
    ],
    lines: {
      greet: [
        'I’m a businessman. This is serious business. I am being extremely serious right now.',
        'Welcome to my place of business. I do business here. Seriously.',
        'Please keep your voices down. Business is happening.',
      ],
      selling: 'These are the market figures. I calculated them seriously.',
      ahead: 'The trail ahead is a serious matter. I would know. I’m a businessman.',
      bye: 'This concludes our business. It was serious. Goodbye.',
    },
    placeholder: true,
  },
  {
    id: 'roccoBoutique',
    name: 'Rocco Raccoon’s “Borrowed” Boutique',
    shopkeeper: { name: 'Rocco', portrait: 'rocco-raccoon' },
    focus: { usedOrLost: true },
    blueprints: { any: true },
    featured: [],
    lines: {
      greet: [
        'It fell off a backpack. Totally legal.',
        'Don’t ask where I got it. I found it. Everything here was found.',
        'Hey, that looks just like the one you lost! What a coincidence.',
      ],
      selling: 'Here’s what’s moving this week. Don’t tell anyone where you heard it.',
      ahead: 'Lots of backpacks out there. Keep an eye on yours. Heh.',
      bye: 'Pleasure doing business. Check your pockets on the way out. Kidding!',
    },
    placeholder: true,
  },
  {
    id: 'roccoResale',
    name: 'Rocco Raccoon’s Random Resale',
    shopkeeper: { name: 'Rocco', portrait: 'rocco-raccoon' },
    focus: { any: true },
    blueprints: { any: true },
    featured: [],
    mystery: true,
    bundles: { count: 4, packs: true },
    lines: {
      greet: [
        'Step right up! What’s in the box? Even I don’t know, and I put it there!',
        'Mystery deals! Every card a surprise. Some of them good surprises.',
        'No peeking. Peeking costs extra.',
      ],
      selling: 'Here’s what folks are paying. That part’s not a mystery.',
      ahead: 'What’s ahead? A mystery! Like everything else here. Heh.',
      bye: 'No refunds! Come again!',
    },
    placeholder: true,
  },
  {
    id: 'drSckhunk',
    name: 'Doctor Sckhunk’s Support Service',
    shopkeeper: { name: 'Dr. Sckhunk', portrait: 'doctor-sckhunk' },
    focus: { items: DOCTOR },
    blueprints: { items: DOCTOR },
    featured: DOCTOR,
    lines: {
      greet: [
        'Okay, kiddo, say ‘ahh.’ Brave hiker! You get a sticker.',
        'Come in, come in. Nothing scary here. Just a quick checkup, kiddo.',
        'Oh! You startled me. So sorry about the smell. Sticker?',
      ],
      selling: 'Here’s what folks are paying this week, kiddo. Nice and calm.',
      ahead: 'Stay warm, drink water, and wear your helmet. Doctor’s orders, kiddo.',
      bye: 'All done! You were very brave. Take two stickers.',
    },
    placeholder: true,
  },
  {
    id: 'bearEI',
    name: 'Bea-R-E-I',
    shopkeeper: { name: 'Hoomhen Bean', portrait: 'bear-e-i' },
    focus: { items: HIKING_GEAR },
    blueprints: { items: HIKING_GEAR },
    featured: HIKING_GEAR,
    lines: {
      greet: [
        'Be careful out there, fellow hoomhens. Lotta bears around. Big ones. Not me, though.',
        'Welcome, fellow hoomhen. I am also a hoomhen. Look at my nametag.',
        'Need bear spray? Not for me. For the other bears. The real ones.',
      ],
      selling: 'Here’s what hoomhens are paying this week. Normal hoomhen prices.',
      ahead: 'Bears up ahead, probably. Watch out. Not me. Other ones.',
      bye: 'Stay safe, hoomhen. Roar. I mean, goodbye.',
    },
    placeholder: true,
  },
  {
    id: 'bearnes',
    name: 'Bearnes and Nobles',
    shopkeeper: { name: 'Bearry', portrait: 'bearnes-and-nobles' },
    focus: { items: BOOKS },
    blueprints: { items: BOOKS },
    featured: BOOKS,
    favoredTrinkets: ['diploma', 'textbook', 'instructionManual'],
    lines: {
      greet: [
        'Shh. Socks are in Fiction. Wisdom is in Nonfiction.',
        'Shh. Welcome. Please whisper. There’s a book for that, you know.',
        'Shh. Lost? I recommend a map. Or a memoir about being lost.',
      ],
      selling: 'Shh. Here are this week’s prices. Read them quietly.',
      ahead: 'Shh. The next chapter is wilder. Bring a good book.',
      bye: 'Shh. Return your books on time. And your socks.',
    },
    placeholder: true,
  },
];

export const STATION_THEME_BY_ID: Readonly<Record<StationThemeId, StationTheme>> =
  Object.fromEntries(STATION_THEMES.map((t) => [t.id, t])) as Record<StationThemeId, StationTheme>;

/** A chip in the shopkeeper's "What's ahead?" talk. */
export interface AheadChip {
  icon: 'rain' | 'snowflake' | 'sun' | 'droplet' | 'road' | 'cloud';
  text: string;
  tone: 'info' | 'good' | 'bad';
}

/**
 * "What's ahead?" for each biome, beside the tier and common nodes the game
 * reads from the next section. Placeholders until the biomes are final
 * (Phase 11).
 */
export const BIOME_AHEAD: Readonly<
  Record<BiomeId, { chips: readonly AheadChip[]; placeholder: true }>
> = {
  meadow: {
    chips: [
      { icon: 'sun', text: 'MILD WEATHER', tone: 'info' },
      { icon: 'rain', text: 'LIGHT RAIN NOW AND THEN', tone: 'info' },
    ],
    placeholder: true,
  },
  temperateRainforest: {
    chips: [
      { icon: 'rain', text: 'RAIN MOST DAYS', tone: 'info' },
      { icon: 'droplet', text: 'WET MORE LIKELY', tone: 'bad' },
      { icon: 'road', text: 'MORE MUDDY LINES', tone: 'bad' },
    ],
    placeholder: true,
  },
  alpine: {
    chips: [
      { icon: 'snowflake', text: 'SNOW AND WHITEOUTS', tone: 'info' },
      { icon: 'snowflake', text: 'COLD MORE LIKELY', tone: 'bad' },
      { icon: 'road', text: 'MORE STEEP LINES', tone: 'bad' },
    ],
    placeholder: true,
  },
};
