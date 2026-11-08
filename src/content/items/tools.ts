/**
 * Tools (docs/design/03-items.md, "Tools"). Uses come from Quality; a tool is
 * gone when they run out. Effects arrive in Phase 8's later steps (3 and 8);
 * the medical ones already work (Phase 7). * marks the scouting tools built
 * for hidden challenges.
 */
import { BALANCE } from '../../config/balance';
import type { ItemDef } from '../../engine/effects';
import { item, q } from './build';

const M = BALANCE.medical;
const tool = (def: Omit<Parameters<typeof item>[0], 'type'>): ItemDef =>
  item({ ...def, type: 'tool' });

/** Moving and scouting. */
const MOVING: ItemDef[] = [
  tool({
    id: 'paver',
    name: 'Paver',
    tier: 2,
    uses: q(1, 2, 2, 2, 3),
    text: 'Make a line from this tile 1 step better: Steep, Muddy or Rough becomes normal, and normal becomes Paved.',
    recipe: 'Stone 3, Clay 2, Metal 1, any 1',
  }),
  tool({
    id: 'scanner',
    name: 'Scanner',
    tier: 1,
    uses: q(2, 3, 3, 3, 4),
    text: 'Scan 1 adjacent tile. If it has a challenge, a red ! appears on it.',
    recipe: 'Metal 2, Flint 1, Oil 1, any 2',
  }),
  tool({
    id: 'securityCamera',
    name: 'Security Camera',
    tier: 2,
    uses: q(1, 2, 2, 3, 3),
    text: 'Scan 1 adjacent tile: shows whether it has a challenge, an opportunity or a Trial, and its tier.',
    recipe: 'Metal 2, Shell 1, Oil 1, Flint 1, any 2',
  }),
  tool({
    id: 'minesweeper',
    name: 'Minesweeper',
    tier: 2,
    uses: q(1, 2, 2, 2, 3),
    text: 'Shows how many challenges, opportunities and Trials are on the tiles around you, as colored numbers that fade away.',
    recipe: 'Metal 2, Stone 1, Flint 1, Salt 1, any 2',
  }),
  tool({
    id: 'linescan',
    name: 'Linescan',
    tier: 3,
    uses: q(1, 1, 1, 2, 2),
    text: 'Pick a row: shows how many challenges, opportunities and Trials are on it.',
    recipe: 'Metal 3, Flint 2, Shell 1, Oil 1, any 2',
  }),
  tool({
    id: 'radarScanner',
    name: 'Radar Scanner',
    tier: 3,
    uses: q(1, 1, 1, 2, 2),
    text: 'Scan every unrevealed tile around you. A red ! appears on each one with a challenge.',
    recipe: 'Metal 3, Oil 2, Flint 1, Shell 1, any 2',
  }),
  tool({
    id: 'binoculars',
    name: 'Binoculars',
    tier: 1,
    uses: q(2, 3, 3, 3, 4),
    text: 'Look at the challenge on an adjacent tile.',
    recipe: 'Shell 2, Metal 1, Fur 1, any 2',
  }),
  tool({
    id: 'telescope',
    name: 'Telescope',
    tier: 3,
    uses: q(1, 2, 2, 2, 3),
    text: 'Look at the challenge on any tile.',
    recipe: 'Shell 2, Metal 2, Wood 2, Flint 1, any 2',
  }),
  tool({
    id: 'camera',
    name: 'Camera',
    tier: 2,
    uses: q(1, 2, 2, 2, 3),
    text: 'Reveal the challenge on an adjacent tile.',
    recipe: 'Metal 2, Shell 1, Oil 1, Salt 1, any 2',
  }),
  tool({
    id: 'droneCamera',
    name: 'Drone Camera',
    tier: 3,
    uses: q(1, 1, 1, 2, 2),
    text: 'Reveal the challenge on any tile.',
    recipe: 'Metal 3, Oil 2, Shell 1, Flint 1, any 2',
  }),
  tool({
    id: 'trampoline',
    name: 'Trampoline',
    tier: 2,
    uses: q(1, 1, 1, 2, 2),
    text: 'Move to any tile next to you, even without a line, at no Appetite cost.',
    recipe: 'Metal 2, Fur 2, Oil 1, any 2',
  }),
];

/** One node's resources, more likely (the Woodcutting Axe and its cousins). */
const nodeTool = (id: string, name: string, node: string, recipe: string): ItemDef =>
  tool({
    id,
    name,
    tier: 1,
    uses: q(2, 3, 3, 3, 4),
    values: { mult: q(2, 3, 3, 3, 4) },
    text: `When scavenging this phase on a tile with a ${node} node, ${node} resources are ×{mult} as likely.`,
    recipe,
  });

/** A resource pack: crafted from 5 of a node's resources, it gives some back at random. */
const pack = (id: string, name: string, what: string, recipe: string): ItemDef =>
  tool({
    id,
    name,
    tier: 1,
    uses: 1,
    values: { n: q(3, 3, 4, 4, 5) },
    text: `Gives {n} random ${what}.`,
    recipe,
  });

const SCAVENGING: ItemDef[] = [
  tool({
    id: 'sack',
    name: 'Sack',
    tier: 1,
    uses: q(1, 2, 2, 2, 3),
    values: { cards: q(1, 1, 1, 1, 2) },
    text: 'When scavenging this phase, keep {cards} extra card{cards:s}.',
    recipe: 'Grass 3, Fur 1, any 2',
  }),
  tool({
    id: 'shovel',
    name: 'Shovel',
    tier: 1,
    uses: q(2, 3, 3, 3, 4),
    text: 'Scavenging this phase costs no Appetite.',
    recipe: 'Metal 2, Wood 2, any 2',
  }),
  tool({
    id: 'trowel',
    name: 'Trowel',
    tier: 1,
    uses: q(2, 3, 3, 3, 4),
    values: { cards: q(1, 1, 1, 1, 2) },
    text: 'When scavenging this phase, see {cards} extra card{cards:s}.',
    recipe: 'Metal 1, Wood 2, Stone 1, any 2',
  }),
  tool({
    id: 'wheelbarrow',
    name: 'Wheelbarrow',
    tier: 2,
    uses: q(1, 2, 2, 2, 3),
    values: { cards: q(1, 1, 1, 1, 2) },
    text: 'Every hiker who scavenges on this tile this phase sees {cards} extra card{cards:s}.',
    recipe: 'Metal 2, Wood 2, Oil 1, any 2',
  }),
  tool({
    id: 'supplyMap',
    name: 'Supply Map',
    tier: 1,
    uses: q(1, 1, 2, 2, 2),
    text: 'Your next scavenge on this tile includes a Choice card for a random node on this tile.',
    recipe: 'Grass 2, Oil 1, any 3',
  }),
  tool({
    id: 'treasureMap',
    name: 'Treasure Map',
    tier: 2,
    uses: q(1, 1, 2, 2, 2),
    values: { luck: q(1, 2, 2, 2, 3) },
    text: '+{luck} Luck when scavenging this phase.',
    recipe: 'Grass 2, Oil 1, Bones 1, Salt 1, any 2',
  }),
  nodeTool('woodcuttingAxe', 'Woodcutting Axe', 'Forest', 'Metal 2, Wood 2, Flint 1, any 1'),
  nodeTool('fishingRod', 'Fishing Rod', 'River', 'Wood 2, Fur 1, Shell 1, Metal 1, any 1'),
  nodeTool('shears', 'Shears', 'Wildlife', 'Metal 2, Flint 1, Wood 1, Fur 1, any 1'),
  nodeTool('pickaxe', 'Pickaxe', 'Mountain', 'Metal 2, Wood 2, Stone 1, any 1'),
  tool({
    id: 'swissArmyKnife',
    name: 'Swiss Army Knife',
    tier: 3,
    uses: q(2, 2, 3, 3, 3),
    values: { mult: q(2, 3, 3, 3, 4) },
    text: 'Pick a resource: this phase it’s ×{mult} as likely when scavenging (the tile needs its node).',
    recipe: 'Metal 3, Flint 1, Bones 1, Oil 1, Wood 1, any 2',
  }),
  tool({
    id: 'fertilizer',
    name: 'Fertilizer',
    tier: 1,
    uses: q(1, 1, 1, 2, 2),
    values: { abundance: q(1, 2, 2, 2, 3) },
    text: 'A random node on this tile gains {abundance} Abundance.',
    recipe: 'Moss 2, Bones 1, Mushroom 1, any 2',
  }),
  tool({
    id: 'industrialFertilizer',
    name: 'Industrial Fertilizer',
    tier: 2,
    uses: q(1, 1, 1, 1, 2),
    values: { abundance: q(1, 2, 2, 2, 3) },
    text: 'Every node on this tile gains {abundance} Abundance.',
    recipe: 'Moss 2, Bones 2, Oil 1, Mushroom 1, any 1',
  }),
  tool({
    id: 'planter',
    name: 'Planter',
    tier: 3,
    uses: 1,
    text: 'Add a node of your choice (Forest, River, Wildlife or Mountain) to this tile.',
    recipe: 'Clay 3, Moss 2, Stone 1, any 3',
  }),
  pack('forestPack', 'Forest Pack', 'Forest resources', '5 forest'),
  pack('wildlifePack', 'Wildlife Pack', 'Wildlife resources', '5 wildlife'),
  pack('riverPack', 'River Pack', 'River resources', '5 river'),
  pack('mountainPack', 'Mountain Pack', 'Mountain resources', '5 mountain'),
  pack('resourcePack', 'Resource Pack', 'resources of any kind', '5 any'),
];

const CHALLENGES: ItemDef[] = [
  tool({
    id: 'fireFlower',
    name: 'Fire Flower',
    tier: 3,
    uses: 1,
    text: 'Remove the challenge on an adjacent tile.',
    recipe: 'Oil 2, Flint 2, Grass 2, Moss 1, any 2',
  }),
  tool({
    id: 'pooBag',
    name: 'Poo Bag',
    tier: 1,
    uses: q(1, 1, 1, 1, 2),
    text: 'Lower the challenge on an adjacent tile by 1 tier.',
    recipe: 'Grass 2, Bones 1, Mushroom 1, any 2',
  }),
  tool({
    id: 'star',
    name: 'Star',
    tier: 3,
    uses: 1,
    values: { phases: q(1, 1, 1, 1, 2) },
    text: 'For {phases} phase{phases:s}, this hiker is immune to conditions, injuries and stat losses.',
    recipe: 'Salt 2, Flint 2, Shell 2, Metal 1, any 2',
  }),
  tool({
    id: 'campingLamp',
    name: 'Camping Lamp',
    tier: 2,
    uses: q(1, 2, 2, 2, 3),
    text: 'Tonight, keeps watch over this tile and every tile next to it.',
    recipe: 'Oil 2, Metal 2, Salt 1, any 2',
  }),
];

const CONDITIONS: ItemDef[] = [
  tool({
    id: 'bandaid',
    name: 'Bandaid',
    tier: 1,
    uses: q(1, 1, 1, 1, 2),
    text: 'Remove 1 negative condition.',
    recipe: 'Grass 2, Moss 2, any 2',
    use: { pickCondition: true },
  }),
  tool({
    id: 'helloKittyBandaid',
    name: 'Hello Kitty Bandaid',
    tier: 2,
    uses: q(1, 1, 1, 1, 2),
    values: { morale: q(1, 2, 2, 2, 3) },
    text: 'Remove 1 negative condition and gain {morale} Morale.',
    recipe: 'Grass 2, Moss 2, Shell 1, any 2',
  }),
  tool({
    id: 'ointment',
    name: 'Ointment',
    tier: 2,
    uses: q(1, 1, 1, 2, 2),
    text: 'Remove every negative condition from this hiker.',
    recipe: 'Oil 2, Moss 2, Salt 1, any 2',
  }),
  tool({
    id: 'healingSpray',
    name: 'Healing Spray',
    tier: 3,
    uses: q(1, 1, 1, 1, 2),
    text: 'Remove every negative condition from every hiker on this tile.',
    recipe: 'Oil 2, Moss 2, Salt 1, Clay 1, Metal 1, any 2',
  }),
  tool({
    id: 'bandages',
    name: 'Bandages',
    tier: 2,
    uses: q(1, 1, 1, 1, 2),
    // Wyatt, Nov 7: Bandages cure Bleeding too, on top of 03-items.md.
    text: 'Remove 1 injury, and Bleeding.',
    recipe: 'Fur 2, Moss 2, Salt 1, any 2',
    use: { injuries: M.bandagesInjuries, cures: ['bleeding'] },
  }),
  tool({
    id: 'crutches',
    name: 'Crutches',
    tier: 1,
    uses: 1,
    values: { days: q(2, 3, 3, 3, 4) },
    text: 'Remove 1 injury for {days} days; then it comes back.',
    recipe: 'Metal 2, Fur 1, Wood 1, any 2',
    use: { injuries: 1, gives: { id: 'splinted', duration: q(2, 3, 3, 3, 4), unit: 'days' } },
  }),
  tool({
    id: 'medkit',
    name: 'Medkit',
    tier: 3,
    uses: 1,
    text: 'Remove 1 injury and every negative condition.',
    recipe: 'Fur 2, Moss 2, Oil 1, Salt 1, Metal 1, any 2',
    use: { injuries: M.medkitInjuries, allNegative: true },
  }),
  tool({
    id: 'survivalKit',
    name: 'Survival Kit',
    tier: 2,
    uses: 1,
    text: 'Fill Appetite, Energy or Morale (your choice) to full.',
    recipe: 'Fur 2, Meat 1, Salt 1, Metal 1, any 2',
  }),
  tool({
    id: 'humidifier',
    name: 'Humidifier',
    tier: 3,
    uses: 1,
    text: 'Every hiker on this tile removes 1 injury and every negative condition.',
    recipe: 'Metal 2, Clay 2, Seaweed 2, Moss 1, Oil 1, any 2',
  }),
  tool({
    id: 'stuffedAnimal',
    name: 'Stuffed Animal',
    tier: 1,
    uses: q(1, 2, 2, 2, 3),
    values: { morale: q(1, 2, 2, 2, 3) },
    text: '+{morale} Morale.',
    recipe: 'Fur 3, Grass 1, any 2',
  }),
  tool({
    id: 'ukulele',
    name: 'Ukulele',
    tier: 2,
    uses: q(1, 2, 2, 2, 3),
    values: { morale: q(1, 1, 2, 2, 2) },
    text: 'Every hiker on this tile gains {morale} Morale.',
    recipe: 'Wood 3, Fur 1, Oil 1, any 2',
  }),
  tool({
    id: 'liberalPolicy',
    name: 'Liberal Policy',
    tier: 2,
    uses: 1,
    text: 'Even out Appetite, Energy and Morale across every hiker on this tile (each stat averaged separately, rounded down).',
    recipe: 'Grass 2, Oil 1, any 4',
  }),
  tool({
    id: 'clothingPatch',
    name: 'Clothing Patch',
    tier: 1,
    uses: 1,
    values: { durability: q(1, 2, 2, 2, 3) },
    text: 'One clothing item gains {durability} durability.',
    recipe: 'Fur 2, Grass 1, any 3',
  }),
  tool({
    id: 'dryCleanCoupon',
    name: 'Dry Clean Coupon',
    tier: 2,
    uses: 1,
    values: { durability: q(1, 1, 2, 2, 2) },
    text: 'Every clothing item this hiker wears gains {durability} durability.',
    notCrafted: true,
  }),
];

const PARTY: ItemDef[] = [
  tool({
    id: 'walkieTalkie',
    name: 'Walkie-Talkie',
    tier: 2,
    uses: q(1, 2, 2, 2, 3),
    text: 'For this phase, this hiker can trade items and resources with any hiker on any tile.',
    recipe: 'Metal 2, Oil 1, Shell 1, Flint 1, any 2',
  }),
  tool({
    id: 'bearSpray',
    name: 'Bear Spray',
    tier: 2,
    uses: 1,
    values: { nights: q(1, 2, 2, 2, 3) },
    text: 'This hiker can’t be hit by night events for {nights} night{nights:s}.',
    recipe: 'Oil 2, Salt 2, Metal 1, any 2',
  }),
];

export const TOOLS: readonly ItemDef[] = [
  ...MOVING,
  ...SCAVENGING,
  ...CHALLENGES,
  ...CONDITIONS,
  ...PARTY,
];
