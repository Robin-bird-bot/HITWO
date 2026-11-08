import { describe, expect, it } from 'vitest';
import { deserialize } from '../../engine/save';
import { itemText } from '../../engine/items/text';
import { fullCounters, makeItem, qualityOdds, rollQuality } from '../../engine/items/make';
import { seedRng } from '../../engine/rng';
import { fixtureGame } from '../../engine/test/fixtures';
import type { Quality } from '../../engine/items/quality';
import { ITEMS, RENAMED_ITEMS, TABLE_ITEMS, findableItems } from '.';

const def = (id: string) => {
  const d = ITEMS[id];
  if (!d) throw new Error(`No item ${id}`);
  return d;
};
const at = (id: string, q: Quality) => itemText(def(id), q);

describe('the item list (03-items.md)', () => {
  it('has every row of the tables, and no Suggested items', () => {
    const count = (type: string) => TABLE_ITEMS.filter((i) => i.type === type).length;
    expect(count('tool')).toBe(50);
    expect(count('clothes')).toBe(36);
    expect(count('food')).toBe(36);
    expect(count('shelter')).toBe(10);
    expect(count('trinket')).toBe(12);
    for (const suggested of ['flashlight', 'rope', 'woolBeanie', 'hotCocoa', 'igloo']) {
      expect(ITEMS[suggested]).toBeUndefined();
    }
  });

  it('gives every item a unique id and the right counter for its type', () => {
    expect(new Set(TABLE_ITEMS.map((i) => i.id)).size).toBe(TABLE_ITEMS.length);
    for (const i of TABLE_ITEMS) {
      if (i.type === 'tool') expect(i.uses, i.id).toBeDefined();
      if (i.type === 'food') expect(i.bites, i.id).toBeDefined();
      if (i.type === 'clothes') expect(i.slot, i.id).toBeDefined();
      if (i.type === 'shelter') expect(i.nights, i.id).toBeGreaterThan(0);
      if (i.type === 'trinket') expect(i.trinket, i.id).toBeDefined();
      if (i.slot === 'feet') expect(i.footwear, i.id).toBeDefined();
    }
  });

  it('has art for every item but the three marked "none yet"', () => {
    const missing = TABLE_ITEMS.filter((i) => !i.art).map((i) => i.id);
    expect(missing.sort()).toEqual(['energyDrink', 'pumpkinPie', 'ring']);
    // The game's copies of the art (public/assets/items).
    const files = new Set(
      Object.keys(import.meta.glob('/public/assets/items/*.png')).map((p) =>
        p.replace('/public/assets/items/', '').replace('.png', ''),
      ),
    );
    expect(files.size).toBe(141);
    for (const i of TABLE_ITEMS) if (i.art) expect(files.has(i.art), i.art).toBe(true);
  });

  it('has a recipe for every crafted item but trinkets (generic only)', () => {
    for (const i of TABLE_ITEMS) {
      if (i.notCrafted || i.type === 'trinket') continue;
      expect(i.recipe, i.id).toBeDefined();
    }
    expect(def('paver').recipe).toEqual([
      { n: 3, ids: ['stone'] },
      { n: 2, ids: ['clay'] },
      { n: 1, ids: ['metal'] },
      { n: 1, any: true },
    ]);
    expect(def('forestPack').recipe).toEqual([{ n: 5, nodes: ['forest'] }]);
  });

  it('finds items at a tier, never ones only from events or still to place', () => {
    const tools = findableItems('tool', 1);
    expect(tools.every((i) => i.tier === 1)).toBe(true);
    expect(findableItems('food', 1).some((i) => i.id === 'pukedNuggets')).toBe(false);
    expect(findableItems('tool', 1).some((i) => i.id === 'phone')).toBe(false);
    expect(findableItems('shelter', 3).map((i) => i.id)).toContain('lodge');
  });
});

describe('card text at each Quality', () => {
  it('fills in the Quality values', () => {
    expect(at('backpack', 1)).toBe('Carry 1 more item.');
    expect(at('backpack', 5)).toBe('Carry 3 more items.');
    expect(at('woodcuttingAxe', 5)).toMatch(/×4 as likely/);
  });

  it('drops an extra that Quality 1 loses, and shows its downside', () => {
    expect(at('popcorn', 1)).toBe('+1 Appetite.');
    expect(at('popcorn', 3)).toBe('+1 Appetite, +1 Morale.');
    expect(at('pelmeni', 1)).toBe('+1 Appetite. A 25% chance of Food Poisoning.');
    expect(at('pelmeni', 2)).toBe('+1 Appetite.');
    expect(at('trailMix', 1)).toBe('+1 Appetite.');
    expect(at('trailMix', 3)).toBe('+1 Appetite and Lucky for this phase.');
    expect(at('wine', 1)).toBe('+1 Appetite, then Unlucky for 1 day.');
    expect(at('wine', 3)).toBe('+2 Appetite, then Lucky or Unlucky (50/50) for 1 day.');
    expect(at('energyDrink', 1)).toBe('Buzzed for 2 days.');
    expect(at('energyDrink', 5)).toBe('Energized for 2 days, then Buzzed for 1 day.');
    expect(at('butterfinger', 2)).toBe(
      '+1 Appetite, Lucky for 1 phase. Also Butterfingers for 1 phase.',
    );
  });
});

describe('Quality', () => {
  it('starts at 10/20/40/20/10, and Luck moves 5 points per point', () => {
    expect(qualityOdds(0)).toEqual([10, 20, 40, 20, 10]);
    expect(qualityOdds(2)).toEqual([5, 15, 40, 25, 15]);
    expect(qualityOdds(-2)).toEqual([15, 25, 40, 15, 5]);
    // Never below 0: the rest stops moving.
    expect(qualityOdds(10)).toEqual([0, 0, 40, 35, 25]);
  });

  it('rolls the bell curve', () => {
    const rng = seedRng(4);
    const counts = [0, 0, 0, 0, 0];
    const n = 5000;
    for (let i = 0; i < n; i++) counts[rollQuality(rng) - 1]! += 1;
    expect(counts.map((c) => Math.round((c / n) * 10) / 10)).toEqual([0.1, 0.2, 0.4, 0.2, 0.1]);
  });

  it('makes items with full uses, bites or durability for their Quality', () => {
    const s = fixtureGame();
    expect(makeItem(s, 'scanner', { quality: 5 })).toMatchObject({ quality: 5, usesLeft: 4 });
    expect(makeItem(s, 'pelmeni', { quality: 1 })).toMatchObject({ bitesLeft: 2 });
    expect(makeItem(s, 'cozySweater', { quality: 3 })).toMatchObject({ durability: 7 });
    expect(makeItem(s, 'plainShirt', { quality: 5 })).toMatchObject({ durability: 9 });
    expect(makeItem(s, 'pukedNuggets', { quality: 5 })).toMatchObject({ quality: 1 });
    expect(makeItem(s, 'tent')).not.toHaveProperty('quality');
    const a = makeItem(s, 'tent');
    const b = makeItem(s, 'tent');
    expect(a.uid).not.toBe(b.uid);
    expect(fullCounters(def('medkit'), 3)).toEqual({ usesLeft: 1 });
  });
});

describe('saves', () => {
  it('upgrades a version 7 save: old items become their replacements, filled in', () => {
    const v7 = structuredClone(fixtureGame()) as unknown as Record<string, unknown>;
    const hikers = v7.hikers as { inventory: Record<string, unknown> }[];
    hikers[0]!.inventory = {
      bag: [
        { uid: 'a', itemId: 'medicine' },
        { uid: 'b', itemId: 'splint' },
      ],
      equipped: { gear: { uid: 'c', itemId: 'camera' } },
      resources: {},
    };
    const loaded = deserialize(JSON.stringify({ ...v7, saveVersion: 7 }));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const inv = loaded.state.hikers[0]!.inventory;
    expect(inv.bag).toEqual([
      { uid: 'a', itemId: 'bandaid', quality: 3, usesLeft: 1 },
      { uid: 'b', itemId: 'crutches', quality: 3, usesLeft: 1 },
    ]);
    expect(inv.equipped.gear).toMatchObject({ itemId: 'vrHeadset', quality: 3, durability: 7 });
  });

  it('knows every renamed item’s replacement', () => {
    for (const to of Object.values(RENAMED_ITEMS)) expect(ITEMS[to], to).toBeDefined();
  });
});
