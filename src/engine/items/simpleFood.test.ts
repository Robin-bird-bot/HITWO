/**
 * Food in Phase 10.6 (docs/design/08-overhaul-plan.md, "Food"): only 9 foods
 * are switched on, with new numbers, and Rotisserie Chicken is a camp meal.
 */
import { BALANCE } from '../../config/balance';
import { describe, expect, it } from 'vitest';
import {
  ITEMS,
  OFFERED_ITEMS,
  TIER_3_ITEMS,
  craftableItems,
  findableItems,
} from '../../content/items';
import { FOODS_ON } from '../../content/items/food';
import { STARTING_PARTY } from '../../content/characters';
import { validateAction } from '../applyAction';
import { createGame } from '../newGame';
import { openStation } from '../station/stock';
import { fixtureGame, hiker, place, run } from '../test/fixtures';
import type { Action, GameState } from '../types';
import { foodAppetiteEstimate } from './foodValue';
import { makeItem } from './make';
import { presentPool } from './presents';
import { valueAt, type Quality } from './quality';

const ON = new Set(FOODS_ON);
const isFood = (id: string) => ITEMS[id]?.type === 'food';

function give(s: GameState, who: string, itemId: string, quality: Quality = 3): string {
  const item = makeItem(s, itemId, { prefix: 'test', quality });
  hiker(s, who).inventory.bag.push(item);
  return item.uid;
}
const eat = (hikerId: string, itemUid: string, fromHikerId?: string): Action => ({
  type: 'eat',
  hikerId,
  itemUid,
  ...(fromHikerId ? { fromHikerId } : {}),
});

describe('only 9 foods and 6 drinks are switched on', () => {
  it('every other food is switched off (Puked Nuggets stay, but are never found)', () => {
    const foods = Object.values(ITEMS).filter((d) => d.type === 'food');
    for (const d of foods) {
      if (ON.has(d.id) || d.id === 'pukedNuggets') expect(d.enabled, d.id).toBeUndefined();
      else expect(d.enabled, d.id).toBe(false);
    }
    expect(FOODS_ON).toHaveLength(15);
  });

  it('only those 9 come from scavenging, crafting, Presents and Tier III rewards', () => {
    const offeredFood = [
      ...[1, 2, 3].flatMap((t) => findableItems('food', t)),
      ...[1, 2, 3].flatMap((t) => craftableItems('food', t)),
      ...[1, 2, 3].flatMap((t) => presentPool(t)).filter((d) => d.type === 'food'),
      ...TIER_3_ITEMS.map((id) => ITEMS[id]!).filter((d) => d.type === 'food'),
      ...OFFERED_ITEMS.filter((d) => d.type === 'food'),
    ];
    expect(offeredFood.length).toBeGreaterThan(0);
    for (const d of offeredFood) expect(ON.has(d.id) || d.id === 'pukedNuggets', d.id).toBe(true);
  });

  it('only those 9 are sold at stations, over many runs', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = createGame({ seed, hikers: STARTING_PARTY });
      const visit = openStation(s);
      const sold = JSON.stringify(visit)
        .match(/"itemId":"(\w+)"/g)
        ?.map((m) => m.slice(10, -1));
      for (const id of sold ?? [])
        if (isFood(id)) expect(ON.has(id) || id === 'pukedNuggets', id).toBe(true);
    }
  });

  it('starting food blueprints and starting bags hold only those 9', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = createGame({ seed, hikers: STARTING_PARTY });
      for (const h of s.hikers) {
        for (const id of h.blueprints ?? []) if (isFood(id)) expect(ON.has(id), id).toBe(true);
        for (const i of h.inventory.bag)
          if (isFood(i.itemId)) expect(ON.has(i.itemId), i.itemId).toBe(true);
      }
    }
  });

  it('a switched-off food already in a pack still works', () => {
    let s = fixtureGame();
    place(s, 'ash', 'T', { appetite: 2 });
    const uid = give(s, 'ash', 'pelmeni');
    s = run(s, eat('ash', uid));
    expect(hiker(s, 'ash').stats.appetite).toBeGreaterThan(2);
  });
});

describe('drinks restore Energy (29-core-loop.md, section 3)', () => {
  const DRINKS = ['coffee', 'sevenUp', 'citroDrink', 'wine', 'pinaColada', 'venteCoffeeMisto'];

  it('the six are on, Energy Drink is off, and exactly those seven are drinks', () => {
    for (const id of DRINKS) expect(ITEMS[id]?.enabled, id).toBeUndefined();
    expect(ITEMS.energyDrink?.enabled).toBe(false);
    const drinks = Object.values(ITEMS).filter((d) => d.drink);
    expect(drinks.map((d) => d.id).sort()).toEqual([...DRINKS, 'energyDrink'].sort());
    for (const d of drinks) expect(d.type, d.id).toBe('food');
  });

  it('each gives Energy and no Appetite', () => {
    for (const id of DRINKS) {
      for (let seed = 1; seed <= 3; seed++) {
        let s = fixtureGame({ seed });
        place(s, 'ash', 'T', { appetite: 2, energy: 2 });
        s = run(s, eat('ash', give(s, 'ash', id)));
        expect(hiker(s, 'ash').stats.appetite, id).toBe(2);
        expect(hiker(s, 'ash').stats.energy, id).toBeGreaterThan(2);
      }
    }
  });

  it('Coffee, 7-Up and Citro Drink give their plain Energy', () => {
    for (const [id, n] of Object.entries(BALANCE.items.drinkEnergy)) {
      let s = fixtureGame();
      place(s, 'ash', 'T', { energy: 2 });
      // Quality 1: no Energized extra (Energized itself gives Energy).
      s = run(s, eat('ash', give(s, 'ash', id, 1)));
      expect(hiker(s, 'ash').stats.energy, id).toBe(2 + n);
    }
    expect(BALANCE.items.drinkEnergy).toEqual({ coffee: 2, sevenUp: 1, citroDrink: 2 });
  });
});

describe('the 9 foods match the table', () => {
  const bites = (id: string) =>
    ([1, 2, 3, 4, 5] as Quality[]).map((q) => valueAt(ITEMS[id]!.bites ?? 1, q));
  it('bites at Quality 1–5', () => {
    expect(bites('trailMix')).toEqual([2, 3, 3, 3, 4]);
    expect(bites('costcoSample')).toEqual([2, 3, 3, 3, 4]);
    expect(bites('dogFood')).toEqual([2, 2, 2, 2, 2]);
    expect(bites('mysteryMeat')).toEqual([1, 1, 1, 1, 1]);
    expect(bites('smores')).toEqual([2, 2, 2, 2, 2]);
    expect(bites('jerky')).toEqual([3, 3, 4, 4, 5]);
    expect(bites('fishAndChips')).toEqual([2, 2, 2, 2, 2]);
    expect(bites('rotisserieChicken')).toEqual([3, 4, 4, 4, 5]);
    expect(bites('dinTaiFung')).toEqual([4, 5, 5, 5, 6]);
  });

  it('Appetite per bite (a human, by day)', () => {
    const perBite = (id: string, q: Quality) =>
      foodAppetiteEstimate(ITEMS[id]!, q) / bites(id)[q - 1]!;
    expect(perBite('trailMix', 3)).toBe(2);
    expect(perBite('costcoSample', 3)).toBe(2);
    expect(perBite('dogFood', 3)).toBe(2);
    expect(perBite('smores', 3)).toBe(2);
    expect(perBite('jerky', 3)).toBe(2);
    expect(perBite('fishAndChips', 1)).toBe(2);
    expect(perBite('fishAndChips', 5)).toBe(4);
    expect(perBite('rotisserieChicken', 3)).toBe(3);
    expect(perBite('mysteryMeat', 3)).toBe(6); // 2–10, its middle
    // Din Tai Fung at Quality 3: 5 + 4 + 3 + 2 + 1.
    expect(foodAppetiteEstimate(ITEMS.dinTaiFung!, 3)).toBe(15);
  });

  it('Fish and Chips: +1 Morale on the first bite only', () => {
    let s = fixtureGame();
    place(s, 'ash', 'T', { appetite: 2, morale: 5 });
    const uid = give(s, 'ash', 'fishAndChips');
    s = run(s, eat('ash', uid));
    expect(hiker(s, 'ash').stats.morale).toBe(6);
    s = run(s, eat('ash', uid));
    expect(hiker(s, 'ash').stats.morale).toBe(6);
  });

  it('Mystery Meat gives 2 to 10 Appetite', () => {
    for (let seed = 1; seed <= 30; seed++) {
      let s = fixtureGame({ seed });
      place(s, 'ash', 'T', { appetite: 0 });
      s = run(s, eat('ash', give(s, 'ash', 'mysteryMeat')));
      const a = hiker(s, 'ash').stats.appetite;
      expect(a).toBeGreaterThanOrEqual(2);
      expect(a).toBeLessThanOrEqual(10);
    }
  });
});

describe('the camp meal', () => {
  it('another hiker on the tile eats a bite of Rotisserie Chicken without trading; it stays in the owner’s pack', () => {
    let s = fixtureGame();
    place(s, 'ash', 'T', { appetite: 2 });
    place(s, 'birch', 'T', { appetite: 2 });
    const uid = give(s, 'ash', 'rotisserieChicken');
    s = run(s, eat('birch', uid, 'ash'));
    expect(hiker(s, 'birch').stats.appetite).toBe(5);
    expect(hiker(s, 'ash').stats.appetite).toBe(2);
    const chicken = hiker(s, 'ash').inventory.bag.find((i) => i.uid === uid);
    expect(chicken?.bitesLeft).toBe(3);
    expect(hiker(s, 'birch').inventory.bag.some((i) => i.uid === uid)).toBe(false);
  });

  it('not from another tile, and not any other food', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T');
    place(s, 'birch', 'L');
    const chicken = give(s, 'ash', 'rotisserieChicken');
    expect(validateAction(s, eat('birch', chicken, 'ash'))).toMatch(/isn’t on Ash’s tile/);
    place(s, 'birch', 'T');
    const mix = give(s, 'ash', 'trailMix');
    expect(validateAction(s, eat('birch', mix, 'ash'))).toMatch(/isn’t a camp meal/);
  });
});
