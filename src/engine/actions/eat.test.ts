import { describe, expect, it } from 'vitest';
import { validateAction } from '../applyAction';
import { addCondition, hasCondition } from '../conditions';
import { makeItem } from '../items/make';
import type { Quality } from '../items/quality';
import { END, fixtureGame, hiker, place, run, toNight } from '../test/fixtures';
import type { Action, GameState } from '../types';

/** Puts a food in a hiker's bag at a Quality; returns its uid. */
function food(s: GameState, id: string, itemId: string, quality: Quality = 3): string {
  const item = makeItem(s, itemId, { quality });
  hiker(s, id).inventory.bag.push(item);
  return item.uid;
}

const eat = (hikerId: string, itemUid: string): Action => ({ type: 'eat', hikerId, itemUid });
const bag = (s: GameState, id: string) => hiker(s, id).inventory.bag;

describe('eating', () => {
  it('a bite gives its Appetite, as a free action, and the last bite finishes it', () => {
    let s = fixtureGame();
    place(s, 'ash', 'T', { appetite: 5 });
    const uid = food(s, 'ash', 'pelmeni'); // 3 bites at Quality 3
    s = run(s, eat('ash', uid));
    expect(hiker(s, 'ash').stats.appetite).toBe(6);
    expect(hiker(s, 'ash').acted).toBe(false);
    expect(bag(s, 'ash')[0]?.bitesLeft).toBe(2);
    s = run(s, eat('ash', uid), eat('ash', uid));
    expect(hiker(s, 'ash').stats.appetite).toBe(8);
    expect(bag(s, 'ash')).toEqual([]);
    expect(s.log.at(-1)).toMatchObject({ kind: 'itemGone', why: 'eaten', itemId: 'pelmeni' });
  });

  it('is only for food, and only for active hikers', () => {
    const s = fixtureGame();
    const shovel = makeItem(s, 'shovel');
    bag(s, 'ash').push(shovel);
    expect(validateAction(s, eat('ash', shovel.uid))).toBe('Shovel isn’t food.');
  });

  it('Food Poisoning takes 2 off, never below 0', () => {
    let s = fixtureGame();
    place(s, 'ash', 'T', { appetite: 2 });
    addCondition(s, hiker(s, 'ash'), 'foodPoisoning', 1, 'days', 'test');
    s = run(s, eat('ash', food(s, 'ash', 'hotlipsPizzaStick'))); // +3 at Quality 3
    expect(hiker(s, 'ash').stats.appetite).toBe(3);
    s = run(s, eat('ash', food(s, 'ash', 'pelmeni'))); // +1 − 2
    expect(hiker(s, 'ash').stats.appetite).toBe(3);
  });

  it('adds the Appetite a challenge recorded on the card, except on Jerky', () => {
    let s = fixtureGame();
    place(s, 'ash', 'T', { appetite: 2 });
    const k = food(s, 'ash', 'khachapuri');
    const j = food(s, 'ash', 'jerky');
    for (const item of bag(s, 'ash')) item.appetiteMod = -1;
    s = run(s, eat('ash', k));
    expect(hiker(s, 'ash').stats.appetite).toBe(3); // 2 − 1
    s = run(s, eat('ash', j));
    expect(hiker(s, 'ash').stats.appetite).toBe(5); // Jerky never loses value
  });

  it('Din Tai Fung gives Appetite equal to the bites left', () => {
    let s = fixtureGame();
    place(s, 'ash', 'T', { appetite: 0 });
    const uid = food(s, 'ash', 'dinTaiFung'); // 4 bites at Quality 3
    s = run(s, eat('ash', uid));
    expect(hiker(s, 'ash').stats.appetite).toBe(4);
    s = run(s, eat('ash', uid));
    expect(hiker(s, 'ash').stats.appetite).toBe(7);
  });

  it('Advent Calendar: only 1 bite a day', () => {
    let s = fixtureGame();
    place(s, 'ash', 'T', { appetite: 3 });
    const uid = food(s, 'ash', 'adventCalendar');
    s = run(s, eat('ash', uid));
    expect(validateAction(s, eat('ash', uid))).toBe(
      'Ash already had today’s bite of the Advent Calendar.',
    );
    s = run(s, END, END, END);
    expect(validateAction(s, eat('ash', uid))).toBeNull();
  });

  it('Costco Sample sometimes keeps the bite', () => {
    let kept = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let s = fixtureGame({ seed });
      const uid = food(s, 'ash', 'costcoSample');
      s = run(s, eat('ash', uid));
      if (bag(s, 'ash')[0]?.bitesLeft === 3) kept += 1;
    }
    // 45% at Quality 3.
    expect(kept).toBeGreaterThan(8);
    expect(kept).toBeLessThan(32);
  });

  it('Meatball Soup gives other food here +1 Appetite for good; at Quality 1 only its eater’s', () => {
    let s = fixtureGame();
    const mine = food(s, 'ash', 'pelmeni');
    const theirs = food(s, 'birch', 'pelmeni');
    s = run(s, eat('ash', food(s, 'ash', 'meatballSoup')));
    expect(bag(s, 'ash').find((i) => i.uid === mine)?.appetiteMod).toBe(1);
    expect(bag(s, 'birch').find((i) => i.uid === theirs)?.appetiteMod).toBe(1);

    let t = fixtureGame();
    const own = food(t, 'ash', 'pelmeni');
    const other = food(t, 'birch', 'pelmeni');
    t = run(t, eat('ash', food(t, 'ash', 'meatballSoup', 1)));
    expect(bag(t, 'ash').find((i) => i.uid === own)?.appetiteMod).toBe(1);
    expect(bag(t, 'birch').find((i) => i.uid === other)?.appetiteMod).toBeUndefined();
  });

  it('S’mores give more at night', () => {
    let s = fixtureGame();
    place(s, 'ash', 'T', { appetite: 2, morale: 5 });
    s = run(s, eat('ash', food(s, 'ash', 'smores')));
    expect(hiker(s, 'ash').stats).toMatchObject({ appetite: 3, morale: 5 });
    s = toNight(s);
    const before = hiker(s, 'ash').stats;
    const [appetite, morale] = [before.appetite, before.morale];
    s = run(s, eat('ash', food(s, 'ash', 'smores')));
    expect(hiker(s, 'ash').stats.appetite).toBe(appetite + 2);
    expect(hiker(s, 'ash').stats.morale).toBe(morale + 1);
  });

  it('Dog Food: +4 for a Dog, +2 and −1 Morale for anyone else', () => {
    let s = fixtureGame();
    hiker(s, 'birch').family = 'dog';
    place(s, 'ash', 'T', { appetite: 2, morale: 5 });
    place(s, 'birch', 'T', { appetite: 2, morale: 5 });
    s = run(s, eat('ash', food(s, 'ash', 'dogFood')), eat('birch', food(s, 'birch', 'dogFood')));
    expect(hiker(s, 'ash').stats).toMatchObject({ appetite: 4, morale: 4 });
    expect(hiker(s, 'birch').stats).toMatchObject({ appetite: 6, morale: 6 });
  });

  it('Energy Drink: Energized for 2 days, then Buzzed', () => {
    let s = fixtureGame();
    s = run(s, eat('ash', food(s, 'ash', 'energyDrink')));
    expect(hiker(s, 'ash').conditions.find((c) => c.id === 'energized')).toMatchObject({
      remaining: 2,
      unit: 'days',
      then: { id: 'buzzed', remaining: 2, unit: 'days' },
    });
  });

  it('Talenti: stacks of Sated, each +1 Appetite', () => {
    let s = fixtureGame();
    place(s, 'ash', 'T', { appetite: 4 });
    s = run(s, eat('ash', food(s, 'ash', 'talentiIceCream')));
    expect(hiker(s, 'ash').stats.appetite).toBe(7); // 3 stacks at Quality 3
    expect(hasCondition(hiker(s, 'ash'), 'weak')).toBe(true);
  });

  it('Trail Mix: Lucky for this phase only', () => {
    let s = fixtureGame();
    s = run(s, eat('ash', food(s, 'ash', 'trailMix')));
    expect(hasCondition(hiker(s, 'ash'), 'lucky')).toBe(true);
    s = run(s, END);
    expect(hasCondition(hiker(s, 'ash'), 'lucky')).toBe(false);
  });

  it('Quality 1 plain food can give Food Poisoning; Quality 3 never does', () => {
    let poisoned = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let s = fixtureGame({ seed });
      s = run(
        s,
        eat('ash', food(s, 'ash', 'pelmeni', 1)),
        eat('birch', food(s, 'birch', 'pelmeni')),
      );
      if (hasCondition(hiker(s, 'ash'), 'foodPoisoning')) poisoned += 1;
      expect(hasCondition(hiker(s, 'birch'), 'foodPoisoning')).toBe(false);
    }
    expect(poisoned).toBeGreaterThan(3); // 25%
    expect(poisoned).toBeLessThan(20);
  });

  it('Vente Coffee Misto rolls each stat separately, the same for the same seed', () => {
    const once = () => {
      let s = fixtureGame({ seed: 7 });
      place(s, 'ash', 'T', { appetite: 0, energy: 0, morale: 0 });
      s = run(s, eat('ash', food(s, 'ash', 'venteCoffeeMisto')));
      return hiker(s, 'ash').stats;
    };
    const a = once();
    expect(a).toEqual(once());
    for (const v of [a.appetite, a.energy, a.morale]) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(10);
    }
  });

  it('every food can be eaten at every Quality without errors', async () => {
    const { FOOD } = await import('../../content/items/food');
    for (const def of FOOD) {
      for (const q of [1, 2, 3, 4, 5] as const) {
        let s = fixtureGame({ seed: q });
        place(s, 'ash', 'T', { appetite: 3, energy: 3, morale: 3 });
        const uid = food(s, 'ash', def.id, q);
        expect(validateAction(s, eat('ash', uid)), def.id).toBeNull();
        s = run(s, eat('ash', uid));
        expect(s.log.some((e) => e.kind === 'ate' && e.itemId === def.id)).toBe(true);
      }
    }
  });
});
