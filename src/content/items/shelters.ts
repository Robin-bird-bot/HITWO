/**
 * Shelters (docs/design/03-items.md, "Shelters"): placed on a tile and gone
 * after their nights. Every one is a basic shelter (+1 Energy when sleeping,
 * safe from night events, Drizzle and Sheer Cold) plus its own effect, which
 * works for hikers on its tile (src/engine/items/shelters.ts). No Quality.
 * Nights marked [first guess] in the doc are in BALANCE.items.
 */
import { BALANCE } from '../../config/balance';
import type { Hooks, ItemDef, ItemType } from '../../engine/effects';
import { item } from './build';

const N = BALANCE.items.shelterNights;
const S = BALANCE.items.shelter;

/** +1 Quality (up to 5) for these types crafted on this tile (Tailgate, Lodge). */
const craftQuality = (name: string, types: readonly ItemType[]): Hooks => ({
  modifyCraft: (q) =>
    types.includes(q.type)
      ? {
          source: name,
          label: `${name}: +${S.craftQuality} Quality`,
          tone: 'bonus',
          quality: S.craftQuality,
        }
      : undefined,
});

/** More Energy from sleeping here (Cabin, RV). */
const moreSleep = (name: string): Hooks => ({
  modifyGain: (q) => (q.key === 'sleep.energy' ? { source: name, flat: S.sleepEnergy } : undefined),
});

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
    hooks: moreSleep('Cabin'),
  }),
  shelter({
    id: 'tailgate',
    name: 'Tailgate',
    tier: 2,
    text: 'Food crafted on this tile gets +1 Quality (up to 5).',
    recipe: 'Metal 3, Oil 2, any 3',
    hooks: craftQuality('Tailgate', ['food']),
  }),
  shelter({
    id: 'yurt',
    name: 'Yurt',
    tier: 2,
    text: 'Hikers scavenging on this tile see 1 extra card.',
    recipe: 'Fur 3, Wood 2, Grass 1, any 2',
    hooks: {
      modifyScavenge: () => ({
        source: 'Yurt',
        label: `Yurt: +${S.yurtCards} card`,
        tone: 'bonus',
        cards: S.yurtCards,
      }),
    },
  }),
  shelter({
    id: 'hostel',
    name: 'Hostel',
    tier: 2,
    text: '+1 more Energy when sleeping here with 2 or more hikers on the tile, and +1 more again with all 4.',
    recipe: 'Wood 2, Stone 2, Clay 2, any 2',
    hooks: {
      modifyGain: (q, ctx) => {
        if (q.key !== 'sleep.energy') return undefined;
        const here = ctx.hikersOnTile(ctx.self.tileId).length;
        const h = S.hostel;
        const flat =
          (here >= h.company ? h.companyEnergy : 0) + (here >= h.everyone ? h.everyoneEnergy : 0);
        return flat ? { source: 'Hostel', flat } : undefined;
      },
    },
  }),
  shelter({
    id: 'treeHouse',
    name: 'Tree-House',
    tier: 3,
    text: 'Also protects every connected tile from night events.',
    recipe: 'Wood 4, Fur 1, Metal 1, Stone 1, any 2',
    shelterReach: 'guards',
  }),
  shelter({
    id: 'rv',
    name: 'RV',
    tier: 3,
    text: 'Every connected tile also counts as sheltered. Sleeping here gives +1 more Energy.',
    recipe: 'Metal 4, Oil 2, Shell 1, any 2',
    shelterReach: 'shelters',
    hooks: moreSleep('RV'),
  }),
  shelter({
    id: 'medicTent',
    name: 'Medic Tent',
    tier: 3,
    text: 'The first time each hiker sleeps here, they remove 1 injury.',
    recipe: 'Fur 3, Moss 2, Wood 2, Salt 1, any 1',
    // TODO(wyatt): a hiker with no injury to remove keeps their turn for a later night.
    placedHooks: (placed) => ({
      onSleep: (ctx) => {
        if (ctx.self.injuries === 0 || placed.healed?.includes(ctx.self.id)) return;
        placed.healed = [...(placed.healed ?? []), ctx.self.id];
        ctx.heal(ctx.self, S.medicInjuries, 'Medic Tent');
      },
    }),
  }),
  shelter({
    id: 'lodge',
    name: 'Lodge',
    tier: 3,
    text: 'Tools and clothes crafted on this tile get +1 Quality (up to 5).',
    recipe: 'Wood 4, Stone 2, Metal 1, Fur 1, any 1',
    hooks: craftQuality('Lodge', ['tool', 'clothes']),
  }),
];
