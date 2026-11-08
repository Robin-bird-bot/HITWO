/**
 * Shelters (docs/design/03-items.md, "Shelters"): placed on a tile and gone
 * after their nights. Every one is a basic shelter (+1 Energy when sleeping,
 * safe from night events, Drizzle and Sheer Cold) plus its own effect. No
 * Quality. Nights marked [first guess] in the doc are in BALANCE.items.
 * Placing and their effects arrive in Phase 8 step 5.
 */
import { BALANCE } from '../../config/balance';
import type { ItemDef } from '../../engine/effects';
import { item } from './build';

const N = BALANCE.items.shelterNights;

const shelter = (def: Omit<Parameters<typeof item>[0], 'type' | 'nights'>): ItemDef =>
  item({ ...def, type: 'shelter', nights: N[def.id] ?? 1 });

export const SHELTERS: readonly ItemDef[] = [
  shelter({
    id: 'hammock',
    name: 'Hammock',
    tier: 1,
    text: 'A basic shelter.',
    recipe: 'Fur 2, Moss 1, Wood 2, any 1',
  }),
  shelter({
    id: 'tent',
    name: 'Tent',
    tier: 1,
    text: 'A basic shelter.',
    recipe: 'Fur 2, Wood 2, Moss 1, any 2',
  }),
  shelter({
    id: 'cabin',
    name: 'Cabin',
    tier: 2,
    text: 'Sleeping here gives +1 more Energy.',
    recipe: 'Wood 4, Stone 2, Metal 1, any 1',
  }),
  shelter({
    id: 'tailgate',
    name: 'Tailgate',
    tier: 2,
    text: 'Food crafted on this tile gets +1 Quality (up to 5).',
    recipe: 'Metal 3, Oil 2, any 3',
  }),
  shelter({
    id: 'yurt',
    name: 'Yurt',
    tier: 2,
    text: 'Hikers scavenging on this tile see 1 extra card.',
    recipe: 'Fur 3, Wood 2, Grass 1, any 2',
  }),
  shelter({
    id: 'hostel',
    name: 'Hostel',
    tier: 2,
    text: '+1 more Energy when sleeping here with 2 or more hikers on the tile, and +1 more again with all 4.',
    recipe: 'Wood 2, Stone 2, Clay 2, any 2',
  }),
  shelter({
    id: 'treeHouse',
    name: 'Tree-House',
    tier: 3,
    text: 'Also protects every connected tile from night events.',
    recipe: 'Wood 4, Fur 1, Metal 1, Stone 1, any 2',
  }),
  shelter({
    id: 'rv',
    name: 'RV',
    tier: 3,
    text: 'Every connected tile also counts as sheltered. Sleeping here gives +1 more Energy.',
    recipe: 'Metal 4, Oil 2, Shell 1, any 2',
  }),
  shelter({
    id: 'medicTent',
    name: 'Medic Tent',
    tier: 3,
    text: 'The first time each hiker sleeps here, they remove 1 injury.',
    recipe: 'Fur 3, Moss 2, Wood 2, Salt 1, any 1',
  }),
  shelter({
    id: 'lodge',
    name: 'Lodge',
    tier: 3,
    text: 'Tools and clothes crafted on this tile get +1 Quality (up to 5).',
    recipe: 'Wood 4, Stone 2, Metal 1, Fur 1, any 1',
  }),
];
