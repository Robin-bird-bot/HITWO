/**
 * Clothes (docs/design/03-items.md, "Clothes"): three slots, Gear, Body and
 * Feet (shoes or socks: one or the other). Anyone can wear anything.
 * Durability is in days, from the tier (BALANCE.items.durability) unless the
 * item says otherwise. Effects arrive in Phase 8 step 4; the Backpack's extra
 * bag slots already work.
 */
import type { ItemDef } from '../../engine/effects';
import { item, q } from './build';

type Input = Omit<Parameters<typeof item>[0], 'type'>;
const gear = (def: Input): ItemDef => item({ ...def, type: 'clothes', slot: 'gear' });
const body = (def: Input): ItemDef => item({ ...def, type: 'clothes', slot: 'body' });
const shoes = (def: Input): ItemDef =>
  item({ ...def, type: 'clothes', slot: 'feet', footwear: 'shoes' });
const socks = (def: Input): ItemDef =>
  item({ ...def, type: 'clothes', slot: 'feet', footwear: 'socks' });

const GEAR: ItemDef[] = [
  gear({
    id: 'umbrella',
    name: 'Umbrella',
    tier: 2,
    text: 'Any durability this hiker’s other clothes would lose comes off the Umbrella instead.',
    recipe: 'Metal 2, Seaweed 2, Wood 1, Oil 1, any 1',
  }),
  gear({
    id: 'hikingStick',
    name: 'Hiking Stick',
    tier: 1,
    values: { cost: q(3, 2, 2, 2, 1) },
    text: 'When Hungry, moving alone costs no Appetite; each time, the stick loses {cost} durability.',
    recipe: 'Wood 3, Fur 1, any 2',
  }),
  gear({
    id: 'glasses',
    name: 'Glasses',
    tier: 1,
    values: { rerolls: q(1, 1, 1, 1, 2) },
    text: 'When scavenging, reroll {rerolls} card{rerolls:s}.',
    recipe: 'Shell 2, Metal 1, any 3',
  }),
  gear({
    id: 'backpack',
    name: 'Backpack',
    tier: 2,
    values: { items: q(1, 2, 2, 2, 3) },
    text: 'Carry {items} more item{items:s}.',
    recipe: 'Fur 2, Moss 2, Metal 1, any 2',
    hooksAt: (v) => ({
      modifyCapacity: (cap) =>
        cap.key === 'bag.slots' ? { source: 'Backpack', flat: v('items') } : undefined,
    }),
  }),
  gear({
    id: 'snackPack',
    name: 'Snack Pack',
    tier: 2,
    values: { pct: q(10, 15, 15, 15, 20) },
    text: 'Each phase, a {pct}% chance to gain 1 Appetite; each time it does, it loses 1 durability.',
    recipe: 'Moss 2, Fur 1, Meat 1, Salt 1, any 2',
  }),
  gear({
    id: 'trooperMask',
    name: 'Trooper Mask',
    tier: 3,
    text: 'Ignores the extra costs of Steep, Muddy and Rough lines; each time it does, it loses 1 durability.',
    recipe: 'Metal 3, Oil 1, Shell 1, Flint 1, any 2',
  }),
  gear({
    id: 'thinkingCap',
    name: 'Thinking Cap',
    tier: 2,
    values: { xp: q(1, 1, 1, 1, 2) },
    text: '+{xp} XP from every source.',
    recipe: 'Fur 2, Moss 1, any 4',
  }),
  gear({
    id: 'vrHeadset',
    name: 'VR Headset',
    tier: 2,
    values: { xp: q(1, 1, 1, 1, 2) },
    text: 'Gains {xp} XP whenever another hiker on this tile gains XP.',
    recipe: 'Metal 2, Oil 1, Shell 1, Flint 1, any 2',
  }),
  gear({
    id: 'hardhat',
    name: 'Hardhat',
    tier: 2,
    text: 'Blocks the next injury, then breaks.',
    recipe: 'Metal 2, Oil 1, Stone 1, any 3',
  }),
  gear({
    id: 'fannyPack',
    name: 'Fanny Pack',
    tier: 1,
    values: { resources: q(1, 2, 3, 4, 5) },
    text: 'Carry {resources} more resource{resources:s}.',
    recipe: 'Fur 2, Oil 1, any 3',
  }),
];

const BODY: ItemDef[] = [
  body({
    id: 'harness',
    name: 'Harness',
    tier: 3,
    values: { cost: q(5, 4, 4, 4, 3) },
    text: 'Turns a failed challenge into a pass, at the cost of {cost} durability.',
    recipe: 'Fur 3, Metal 2, Bones 1, any 3',
  }),
  body({
    id: 'discoHarness',
    name: 'Disco Harness',
    tier: 2,
    values: { pct: q(40, 50, 50, 50, 60) },
    text: 'Hikers on this tile are {pct}% less likely to be hit by night events.',
    recipe: 'Fur 2, Shell 2, Oil 1, any 2',
  }),
  body({
    id: 'pajamas',
    name: 'Pajamas',
    tier: 1,
    values: { energy: q(1, 1, 1, 1, 2) },
    text: '+{energy} Energy from sleeping. Scavenging costs this 1 durability.',
    recipe: 'Fur 2, Moss 2, any 2',
  }),
  body({
    id: 'plainShirt',
    name: 'Plain Shirt',
    tier: 1,
    values: { extra: q(1, 2, 2, 2, 3) },
    // Tier 1's durability (4/5/5/5/6) plus its extra days.
    durability: q(5, 7, 7, 7, 9),
    text: 'No ability, but cheap, and it lasts {extra} day{extra:s} longer than other Tier 1 clothes.',
    recipe: 'Moss 2, Fur 1, any 2',
  }),
  body({
    id: 'heavyJacket',
    name: 'Heavy Jacket',
    tier: 2,
    values: { pct: q(20, 25, 25, 25, 35) },
    text: 'A {pct}% chance not to lose durability, from any source.',
    recipe: 'Fur 3, Oil 1, Metal 1, any 2',
  }),
  body({
    id: 'pufferJacket',
    name: 'Puffer Jacket',
    tier: 3,
    values: { cost: q(3, 2, 2, 2, 1) },
    text: 'Blocks a negative condition, at the cost of {cost} durability.',
    recipe: 'Fur 3, Oil 2, Seaweed 1, Metal 1, any 2',
  }),
  body({
    id: 'jeans',
    name: 'Jeans',
    tier: 1,
    text: 'Scavenging costs 1 less Appetite; each time, it loses 1 durability.',
    recipe: 'Moss 3, Metal 1, any 2',
  }),
  body({
    id: 'flannel',
    name: 'Flannel',
    tier: 2,
    values: { cards: q(1, 1, 1, 1, 2) },
    text: 'When scavenging, see {cards} extra card{cards:s}.',
    recipe: 'Fur 2, Moss 2, any 3',
  }),
  body({
    id: 'engineeringVest',
    name: 'Engineering Vest',
    tier: 2,
    values: { durability: q(1, 1, 1, 2, 2) },
    text: 'Clothes this hiker crafts get +{durability} durability.',
    recipe: 'Fur 2, Metal 1, Oil 1, Moss 1, any 2',
  }),
  body({
    id: 'cozySweater',
    name: 'Cozy Sweater',
    tier: 2,
    values: { morale: q(1, 1, 1, 1, 2) },
    text: '+{morale} to all Morale this hiker gains.',
    recipe: 'Fur 4, Moss 1, any 2',
  }),
  body({
    id: 'fancyAttire',
    name: 'Fancy Attire',
    tier: 3,
    values: { caps: q(1, 1, 1, 1, 2) },
    text: '+{caps} to all caps the party gains.',
    recipe: 'Fur 2, Shell 2, Metal 1, any 4',
  }),
  body({
    id: 'rainJacket',
    name: 'Rain Jacket',
    tier: 1,
    text: 'Can’t become Wet or Soaked.',
    recipe: 'Seaweed 2, Oil 1, Moss 1, any 2',
  }),
];

const SHOES: ItemDef[] = [
  shoes({
    id: 'joggingShoes',
    name: 'Jogging Shoes',
    tier: 3,
    text: 'This hiker’s first move each phase doesn’t use their action.',
    recipe: 'Fur 2, Oil 2, Metal 1, any 4',
  }),
  shoes({
    id: 'lightUpSkechers',
    name: 'Light-Up Skechers',
    tier: 1,
    text: 'Moving at night costs no extra Appetite.',
    recipe: 'Oil 2, Fur 1, Metal 1, any 2',
  }),
  shoes({
    id: 'trailShoes',
    name: 'Trail Shoes',
    tier: 1,
    text: 'When moving, pay with Energy instead of Appetite if Appetite is lower than Energy.',
    recipe: 'Fur 2, Oil 1, any 3',
  }),
  shoes({
    id: 'toeShoes',
    name: 'Toe Shoes',
    tier: 1,
    text: 'Being brought along by another hiker’s Move All costs no extra Appetite.',
    recipe: 'Oil 2, Fur 1, any 3',
  }),
  shoes({
    id: 'hikingCrocs',
    name: 'Hiking Crocs',
    tier: 2,
    text: 'Once a day, after passing a challenge: one free move that doesn’t use an action and costs 1 less Appetite. It uses 1 extra durability.',
    recipe: 'Oil 3, Clay 1, any 3',
  }),
  shoes({
    id: 'workBoots',
    name: 'Work Boots',
    tier: 2,
    text: 'After crafting: one free move that doesn’t use an action and costs 1 less Appetite. It uses 1 extra durability.',
    recipe: 'Fur 2, Oil 1, Metal 1, Stone 1, any 2',
  }),
  shoes({
    id: 'rollerSkates',
    name: 'Roller Skates',
    tier: 2,
    text: 'Moving sideways or backward costs no Appetite.',
    recipe: 'Metal 2, Fur 1, Oil 1, any 3',
  }),
  shoes({
    id: 'birkenstocks',
    name: 'Birkenstocks',
    tier: 1,
    values: { pct: q(60, 75, 75, 75, 90) },
    // TODO(phase 8): the node is picked when they're made (step 7) and shown here.
    text: 'On a tile with its node (picked when made), a {pct}% chance not to lose durability.',
    recipe: 'Wood 2, Fur 1, any 3',
  }),
  shoes({
    id: 'liftedBoots',
    name: 'Lifted Boots',
    tier: 3,
    text: 'When using Move All with exactly 1 other hiker, that hiker gets another action.',
    recipe: 'Fur 2, Oil 2, Metal 1, any 4',
  }),
];

const sock = (id: string, name: string, text: string): ItemDef =>
  socks({
    id,
    name,
    tier: 1,
    values: { pct: q(15, 20, 20, 20, 30) },
    text,
    recipe: 'Fur 2, Moss 1, any 3',
  });

const SOCKS: ItemDef[] = [
  sock(
    'dogSocks',
    'Dog Socks',
    'At the start of each phase, a {pct}% chance for each Dog on this tile to gain 1 Morale (at most 1).',
  ),
  sock(
    'catSocks',
    'Cat Socks',
    'At the start of each phase, a {pct}% chance for each Cat on this tile to gain 1 Morale (at most 1).',
  ),
  sock(
    'soupSocks',
    'Soup Socks',
    'Each time a hiker on this tile eats or crafts food, a {pct}% chance to gain 1 Morale.',
  ),
  sock(
    'sleepySocks',
    'Sleepy Socks',
    'A {pct}% chance to gain 1 Morale when sleeping, or at the start of a phase with 7 or more Energy.',
  ),
  sock('speedySocks', 'Speedy Socks', 'Each move, a {pct}% chance to gain 1 Morale.'),
];

export const CLOTHES: readonly ItemDef[] = [...GEAR, ...BODY, ...SHOES, ...SOCKS];
