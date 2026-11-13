/**
 * Tools (docs/design/03-items.md, "Tools"). Uses come from Quality; a tool is
 * gone when they run out. `use` says who a tool is for and what it does
 * (src/engine/actions/useItem.ts); `boostHooks` are what it does while it
 * lasts (src/engine/items/boosts.ts). The moving and scouting tools, Fire
 * Flower and Poo Bag pick a tile on the map (src/engine/items/scout.ts).
 */
import { BALANCE } from '../../config/balance';
import type { Hooks, ItemDef, ItemUse, ScavengeModifier } from '../../engine/effects';
import type { NodeType, ResourceId } from '../../engine/types';
import { RESOURCES } from '../resources';
import { item, q } from './build';

const M = BALANCE.medical;
const tool = (def: Omit<Parameters<typeof item>[0], 'type'>): ItemDef =>
  item({ ...def, type: 'tool' });

const NODE_NAME: Record<NodeType, string> = {
  forest: 'Forest',
  river: 'River',
  wildlife: 'Wildlife',
  mountain: 'Mountain',
};
const cards = (n: number) => `${n} card${n === 1 ? '' : 's'}`;

/** For the user, working through this phase, while they can still scavenge. */
const SCAVENGE_THIS_PHASE: ItemUse = {
  target: 'self',
  boost: { lasts: { unit: 'phases', n: 1 }, scavenging: true },
};

/** A scavenging boost: what it changes, and its line in the bonuses pop-over. */
const onScavenge =
  (m: Omit<ScavengeModifier, 'source' | 'tone'> & { source: string }): Hooks['modifyScavenge'] =>
  () => ({ tone: 'bonus', ...m });

/** Moving and scouting. */
const MOVING: ItemDef[] = [
  tool({
    id: 'paver',
    name: 'Paver',
    tier: 2,
    uses: q(1, 2, 2, 2, 3),
    text: 'Make a line from this tile 1 step better: Steep, Muddy or Rough becomes normal, and normal becomes Paved.',
    recipe: 'Stone 3, Clay 2, Metal 1, any 1',
    use: { target: 'self', map: { does: 'pave', pick: 'adjacent' } },
  }),
  tool({
    id: 'scanner',
    name: 'Scanner',
    tier: 1,
    uses: q(2, 3, 3, 3, 4),
    text: 'Scan 1 adjacent tile. If it has a challenge, a red ! appears on it.',
    recipe: 'Metal 2, Flint 1, Oil 1, any 2',
    use: { target: 'self', map: { does: 'scan', pick: 'adjacent' } },
  }),
  tool({
    id: 'securityCamera',
    name: 'Security Camera',
    tier: 2,
    uses: q(1, 2, 2, 3, 3),
    text: 'Scan 1 adjacent tile: shows whether it has a challenge, an opportunity or a Trial, and its tier.',
    recipe: 'Metal 2, Shell 1, Oil 1, Flint 1, any 2',
    use: { target: 'self', map: { does: 'kind', pick: 'adjacent' } },
  }),
  tool({
    id: 'minesweeper',
    name: 'Minesweeper',
    tier: 2,
    uses: q(1, 2, 2, 2, 3),
    text: 'Shows how many challenges, opportunities and Trials are on the tiles around you, as colored numbers that fade away.',
    recipe: 'Metal 2, Stone 1, Flint 1, Salt 1, any 2',
    use: { target: 'self', map: { does: 'countAround' } },
  }),
  tool({
    id: 'linescan',
    name: 'Linescan',
    tier: 3,
    uses: q(1, 1, 1, 2, 2),
    text: 'Pick a row: shows how many challenges, opportunities and Trials are on it.',
    recipe: 'Metal 3, Flint 2, Shell 1, Oil 1, any 2',
    use: { target: 'self', map: { does: 'countRow', pick: 'row' } },
  }),
  tool({
    id: 'radarScanner',
    name: 'Radar Scanner',
    tier: 3,
    uses: q(1, 1, 1, 2, 2),
    text: 'Scan every unrevealed tile around you. A red ! appears on each one with a challenge.',
    recipe: 'Metal 3, Oil 2, Flint 1, Shell 1, any 2',
    use: { target: 'self', map: { does: 'scanAround' } },
  }),
  tool({
    id: 'binoculars',
    name: 'Binoculars',
    tier: 1,
    uses: q(2, 3, 3, 3, 4),
    text: 'Look at the challenge on an adjacent tile.',
    recipe: 'Shell 2, Metal 1, Fur 1, any 2',
    use: { target: 'self', map: { does: 'look', pick: 'adjacent' } },
  }),
  tool({
    id: 'telescope',
    name: 'Telescope',
    tier: 3,
    uses: q(1, 2, 2, 2, 3),
    text: 'Look at the challenge on any tile.',
    recipe: 'Shell 2, Metal 2, Wood 2, Flint 1, any 2',
    use: { target: 'self', map: { does: 'look', pick: 'any' } },
  }),
  tool({
    id: 'camera',
    name: 'Camera',
    tier: 2,
    uses: q(1, 2, 2, 2, 3),
    text: 'Reveal the challenge on an adjacent tile.',
    recipe: 'Metal 2, Shell 1, Oil 1, Salt 1, any 2',
    use: { target: 'self', map: { does: 'reveal', pick: 'adjacent' } },
  }),
  tool({
    id: 'droneCamera',
    name: 'Drone Camera',
    tier: 3,
    uses: q(1, 1, 1, 2, 2),
    text: 'Reveal the challenge on any tile.',
    recipe: 'Metal 3, Oil 2, Shell 1, Flint 1, any 2',
    use: { target: 'self', map: { does: 'reveal', pick: 'any' } },
  }),
  tool({
    id: 'trampoline',
    name: 'Trampoline',
    tier: 2,
    uses: q(1, 1, 1, 2, 2),
    text: 'Move to any tile next to you, even without a line, at no Appetite cost.',
    recipe: 'Metal 2, Fur 2, Oil 1, any 2',
    use: { target: 'self', map: { does: 'hop', pick: 'beside' } },
  }),
];

/** One node's resources, more likely (the Woodcutting Axe and its cousins). */
const nodeTool = (id: string, name: string, node: NodeType, recipe: string): ItemDef =>
  tool({
    id,
    name,
    tier: 1,
    uses: q(2, 3, 3, 3, 4),
    values: { mult: q(2, 3, 3, 3, 4) },
    text: `When scavenging this phase on a tile with a ${NODE_NAME[node]} node, ${NODE_NAME[node]} resources are ×{mult} as likely.`,
    recipe,
    use: { ...SCAVENGE_THIS_PHASE, boost: { ...SCAVENGE_THIS_PHASE.boost!, needsNode: node } },
    boostHooks: (v) => ({
      modifyScavenge: onScavenge({
        source: name,
        label: `${name}: ${NODE_NAME[node]} ×${v('mult')} as likely`,
        nodeWeight: { [node]: v('mult') },
      }),
    }),
  });

/** A resource pack: crafted from 5 of a node's resources, it gives some back at random. */
const pack = (id: string, name: string, what: string, recipe: string, node?: NodeType): ItemDef =>
  tool({
    id,
    name,
    tier: 1,
    uses: 1,
    values: { n: q(3, 3, 4, 4, 5) },
    text: `Gives {n} random ${what}.`,
    recipe,
    use: { target: 'self', resources: { value: 'n', ...(node ? { node } : {}) } },
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
    use: SCAVENGE_THIS_PHASE,
    boostHooks: (v) => ({
      modifyScavenge: onScavenge({
        source: 'Sack',
        label: `Sack: keep ${cards(v('cards'))} more`,
        keep: v('cards'),
      }),
    }),
  }),
  tool({
    id: 'shovel',
    name: 'Shovel',
    tier: 1,
    uses: q(2, 3, 3, 3, 4),
    text: 'Scavenging this phase costs no Appetite.',
    recipe: 'Metal 2, Wood 2, any 2',
    use: SCAVENGE_THIS_PHASE,
    boostHooks: () => ({
      modifyCost: (q) =>
        q.key === 'scavenge.appetite' ? { source: 'Shovel', percent: -100 } : undefined,
      modifyScavenge: onScavenge({ source: 'Shovel', label: 'Shovel: no Appetite cost' }),
    }),
  }),
  tool({
    id: 'trowel',
    name: 'Trowel',
    tier: 1,
    uses: q(2, 3, 3, 3, 4),
    values: { cards: q(1, 1, 1, 1, 2) },
    text: 'When scavenging this phase, see {cards} extra card{cards:s}.',
    recipe: 'Metal 1, Wood 2, Stone 1, any 2',
    use: SCAVENGE_THIS_PHASE,
    boostHooks: (v) => ({
      modifyScavenge: onScavenge({
        source: 'Trowel',
        label: `Trowel: +${cards(v('cards'))}`,
        cards: v('cards'),
      }),
    }),
  }),
  tool({
    id: 'wheelbarrow',
    name: 'Wheelbarrow',
    tier: 2,
    uses: q(1, 2, 2, 2, 3),
    values: { cards: q(1, 1, 1, 1, 2) },
    text: 'Every hiker who scavenges on this tile this phase sees {cards} extra card{cards:s}.',
    recipe: 'Metal 2, Wood 2, Oil 1, any 2',
    use: {
      target: 'self',
      boost: { lasts: { unit: 'phases', n: 1 }, tile: true, scavenging: true },
    },
    boostHooks: (v) => ({
      modifyScavenge: onScavenge({
        source: 'Wheelbarrow',
        label: `Wheelbarrow: +${cards(v('cards'))}`,
        cards: v('cards'),
      }),
    }),
  }),
  tool({
    id: 'supplyMap',
    name: 'Supply Map',
    tier: 1,
    uses: q(1, 1, 2, 2, 2),
    text: 'Your next scavenge on this tile includes a Choice card for a random node on this tile.',
    recipe: 'Grass 2, Oil 1, any 3',
    // The node is picked when it's used; the boost waits for the next scavenge here.
    use: { target: 'self', boost: { lasts: { unit: 'phases', n: 1 }, once: true } },
    boostHooks: (_v, node) =>
      node
        ? {
            modifyScavenge: onScavenge({
              source: 'Supply Map',
              label: `Supply Map: a ${NODE_NAME[node as NodeType]} Choice card`,
              addCards: [{ type: 'choice', node: node as NodeType }],
            }),
          }
        : {},
  }),
  tool({
    id: 'treasureMap',
    name: 'Treasure Map',
    tier: 2,
    uses: q(1, 1, 2, 2, 2),
    values: { luck: q(1, 2, 2, 2, 3) },
    text: '+{luck} Luck when scavenging this phase.',
    recipe: 'Grass 2, Oil 1, Bones 1, Salt 1, any 2',
    use: SCAVENGE_THIS_PHASE,
    boostHooks: (v) => ({
      modifyScavenge: () => ({
        source: 'Treasure Map',
        label: `Treasure Map: +${v('luck')} Luck`,
        tone: 'luck',
        luck: v('luck'),
      }),
    }),
  }),
  nodeTool('woodcuttingAxe', 'Woodcutting Axe', 'forest', 'Metal 2, Wood 2, Flint 1, any 1'),
  nodeTool('fishingRod', 'Fishing Rod', 'river', 'Wood 2, Fur 1, Shell 1, Metal 1, any 1'),
  nodeTool('shears', 'Shears', 'wildlife', 'Metal 2, Flint 1, Wood 1, Fur 1, any 1'),
  nodeTool('pickaxe', 'Pickaxe', 'mountain', 'Metal 2, Wood 2, Stone 1, any 1'),
  tool({
    id: 'swissArmyKnife',
    name: 'Swiss Army Knife',
    tier: 3,
    uses: q(2, 2, 3, 3, 3),
    values: { mult: q(2, 3, 3, 3, 4) },
    text: 'Pick a resource: this phase it’s ×{mult} as likely when scavenging (the tile needs its node).',
    recipe: 'Metal 3, Flint 1, Bones 1, Oil 1, Wood 1, any 2',
    use: {
      target: 'self',
      boost: { lasts: { unit: 'phases', n: 1 }, scavenging: true, chooseResource: true },
    },
    boostHooks: (v, resource) => {
      const name = RESOURCES.find((r) => r.id === resource)?.name ?? 'It';
      return {
        modifyScavenge: onScavenge({
          source: 'Swiss Army Knife',
          label: `Swiss Army Knife: ${name} ×${v('mult')} as likely`,
          resourceWeight: { [resource as ResourceId]: v('mult') },
        }),
      };
    },
  }),
  tool({
    id: 'fertilizer',
    name: 'Fertilizer',
    tier: 1,
    uses: q(1, 1, 1, 2, 2),
    values: { abundance: q(1, 2, 2, 2, 3) },
    text: 'A random node on this tile gains {abundance} Abundance.',
    recipe: 'Moss 2, Bones 1, Mushroom 1, any 2',
    use: { target: 'self', abundance: { value: 'abundance', which: 'random' } },
  }),
  tool({
    id: 'industrialFertilizer',
    name: 'Industrial Fertilizer',
    tier: 2,
    uses: q(1, 1, 1, 1, 2),
    values: { abundance: q(1, 2, 2, 2, 3) },
    text: 'Every node on this tile gains {abundance} Abundance.',
    recipe: 'Moss 2, Bones 2, Oil 1, Mushroom 1, any 1',
    use: { target: 'self', abundance: { value: 'abundance', which: 'all' } },
  }),
  tool({
    id: 'planter',
    name: 'Planter',
    tier: 3,
    uses: 1,
    text: 'Add a node of your choice (Forest, River, Wildlife or Mountain) to this tile.',
    recipe: 'Clay 3, Moss 2, Stone 1, any 3',
    use: { target: 'self', addNode: true },
  }),
  pack('forestPack', 'Forest Pack', 'Forest resources', '5 forest', 'forest'),
  pack('wildlifePack', 'Wildlife Pack', 'Wildlife resources', '5 wildlife', 'wildlife'),
  pack('riverPack', 'River Pack', 'River resources', '5 river', 'river'),
  pack('mountainPack', 'Mountain Pack', 'Mountain resources', '5 mountain', 'mountain'),
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
    use: { target: 'self', map: { does: 'remove', pick: 'adjacent' } },
  }),
  tool({
    id: 'pooBag',
    name: 'Poo Bag',
    tier: 1,
    uses: q(1, 1, 1, 1, 2),
    text: 'Lower the challenge on an adjacent tile by 1 tier.',
    recipe: 'Grass 2, Bones 1, Mushroom 1, any 2',
    use: { target: 'self', map: { does: 'lower', pick: 'adjacent' } },
  }),
  tool({
    id: 'star',
    name: 'Star',
    tier: 3,
    uses: 1,
    values: { phases: q(1, 1, 1, 1, 2) },
    text: 'For {phases} phase{phases:s}, this hiker is immune to conditions, injuries and stat losses.',
    recipe: 'Salt 2, Flint 2, Shell 2, Metal 1, any 2',
    use: { target: 'self', boost: { lasts: { unit: 'phases', n: 'phases' } } },
    // TODO(wyatt): "immune to conditions" read as negative ones; good ones still land.
    boostHooks: () => ({
      blockCondition: () => true,
      blockInjury: () => true,
      modifyStatChange: (q) => (q.delta < 0 ? { blockLoss: true } : undefined),
    }),
  }),
  tool({
    id: 'campingLamp',
    name: 'Camping Lamp',
    tier: 2,
    uses: q(1, 2, 2, 2, 3),
    text: 'Tonight, keeps watch over this tile and every tile next to it.',
    recipe: 'Oil 2, Metal 2, Salt 1, any 2',
    use: { target: 'self', lampTonight: true },
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
    use: { pickCondition: true, morale: 'morale' },
  }),
  tool({
    id: 'ointment',
    name: 'Ointment',
    tier: 2,
    uses: q(1, 1, 1, 2, 2),
    text: 'Remove every negative condition from this hiker.',
    recipe: 'Oil 2, Moss 2, Salt 1, any 2',
    use: { allNegative: true },
  }),
  tool({
    id: 'healingSpray',
    name: 'Healing Spray',
    tier: 3,
    uses: q(1, 1, 1, 1, 2),
    text: 'Remove every negative condition from every hiker on this tile.',
    recipe: 'Oil 2, Moss 2, Salt 1, Clay 1, Metal 1, any 2',
    use: { target: 'tile', allNegative: true },
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
    use: { fillStat: true },
  }),
  tool({
    id: 'humidifier',
    name: 'Humidifier',
    tier: 3,
    uses: 1,
    text: 'Every hiker on this tile removes 1 injury and every negative condition.',
    recipe: 'Metal 2, Clay 2, Seaweed 2, Moss 1, Oil 1, any 2',
    use: { target: 'tile', injuries: 1, allNegative: true },
  }),
  tool({
    id: 'stuffedAnimal',
    name: 'Stuffed Animal',
    tier: 1,
    uses: q(1, 2, 2, 2, 3),
    values: { morale: q(1, 2, 2, 2, 3) },
    text: '+{morale} Morale.',
    recipe: 'Fur 3, Grass 1, any 2',
    use: { morale: 'morale' },
  }),
  tool({
    id: 'ukulele',
    name: 'Ukulele',
    tier: 2,
    uses: q(1, 2, 2, 2, 3),
    values: { morale: q(1, 1, 2, 2, 2) },
    text: 'Every hiker on this tile gains {morale} Morale.',
    recipe: 'Wood 3, Fur 1, Oil 1, any 2',
    use: { target: 'tile', morale: 'morale' },
  }),
  tool({
    id: 'liberalPolicy',
    name: 'Liberal Policy',
    tier: 2,
    uses: 1,
    text: 'Even out Appetite, Energy and Morale across every hiker on this tile (each stat averaged separately, rounded down).',
    recipe: 'Grass 2, Oil 1, any 4',
    use: { target: 'tile', averageStats: true },
  }),
  tool({
    id: 'clothingPatch',
    name: 'Clothing Patch',
    tier: 1,
    uses: 1,
    values: { durability: q(1, 2, 2, 2, 3) },
    text: 'One clothing item gains {durability} durability.',
    recipe: 'Fur 2, Grass 1, any 3',
    // TODO(wyatt): mended clothes go no higher than their full durability.
    use: { repair: { value: 'durability', which: 'one' } },
  }),
  tool({
    id: 'dryCleanCoupon',
    name: 'Dry Clean Coupon',
    tier: 2,
    uses: 1,
    values: { durability: q(1, 1, 2, 2, 2) },
    text: 'Every clothing item this hiker wears gains {durability} durability.',
    notCrafted: true,
    use: { repair: { value: 'durability', which: 'worn' } },
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
    use: { target: 'self', boost: { lasts: { unit: 'phases', n: 1 } } },
    boostHooks: () => ({ tradeAnywhere: () => true }),
  }),
  tool({
    id: 'bearSpray',
    name: 'Bear Spray',
    tier: 2,
    uses: 1,
    values: { nights: q(1, 2, 2, 2, 3) },
    text: 'This hiker can’t be hit by night events for {nights} night{nights:s}.',
    recipe: 'Oil 2, Salt 2, Metal 1, any 2',
    use: { target: 'self', boost: { lasts: { unit: 'nights', n: 'nights' } } },
    boostHooks: () => ({ nightSafe: () => true }),
  }),
];

export const TOOLS: readonly ItemDef[] = [
  ...MOVING,
  ...SCAVENGING,
  ...CHALLENGES,
  ...CONDITIONS,
  ...PARTY,
];
