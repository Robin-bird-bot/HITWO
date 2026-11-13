import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content/items';
import { validateAction } from '../applyAction';
import { addInjury } from '../stats';
import { deserialize } from '../save';
import { foundTier } from '../scavenge/deal';
import { seedRng } from '../rng';
import { END, fixtureGame, hiker, place, run, toNight } from '../test/fixtures';
import type { GameState, ItemInstance } from '../types';
import { makeItem } from './make';
import { loseDurability, loseUses } from './wear';

const give = (s: GameState, id: string, itemId: string, quality: 1 | 2 | 3 | 4 | 5 = 3) => {
  const item = makeItem(s, itemId, { quality });
  hiker(s, id).inventory.bag.push(item);
  return item;
};
const wear = (s: GameState, id: string, itemId: string, quality: 1 | 2 | 3 | 4 | 5 = 3) => {
  const item = makeItem(s, itemId, { quality });
  const slot = ITEMS[itemId]!.slot!;
  hiker(s, id).inventory.equipped[slot] = item;
  return item;
};

describe('finds', () => {
  it('come at the biome’s tier, one higher about 10% of the time', () => {
    const rng = seedRng(3);
    let higher = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) if (foundTier(rng, 1) === 2) higher += 1;
    expect(higher / n).toBeCloseTo(BALANCE.items.findHigher, 1);
    expect(foundTier(seedRng(1), 3)).toBe(3); // never above Tier 3
  });
});

describe('durability and uses', () => {
  it('worn clothes lose a day at each camp; clothes in the bag don’t', () => {
    let s = fixtureGame();
    wear(s, 'ash', 'cozySweater');
    give(s, 'ash', 'flannel');
    s = run(toNight(s), END);
    expect(hiker(s, 'ash').inventory.equipped.body?.durability).toBe(6);
    expect(hiker(s, 'ash').inventory.bag[0]?.durability).toBe(7);
  });

  it('clothes at 0 durability are gone', () => {
    const s = fixtureGame();
    const sweater = wear(s, 'ash', 'cozySweater');
    expect(loseDurability(s, hiker(s, 'ash'), sweater, 9, 'test')).toBe(7);
    expect(hiker(s, 'ash').inventory.equipped.body).toBeUndefined();
    expect(s.log.at(-1)).toMatchObject({ kind: 'itemGone', itemId: 'cozySweater', why: 'worn' });
  });

  it('tools at 0 uses are gone', () => {
    const s = fixtureGame();
    const scanner = give(s, 'ash', 'scanner');
    loseUses(s, hiker(s, 'ash'), scanner, 2, 'test');
    expect(scanner.usesLeft).toBe(1);
    loseUses(s, hiker(s, 'ash'), scanner, 1, 'test');
    expect(hiker(s, 'ash').inventory.bag).toEqual([]);
  });

  it('using a medical tool takes a use: a Quality 5 Bandaid works twice', () => {
    let s = fixtureGame();
    const bandaid = give(s, 'ash', 'bandaid', 5);
    for (const h of ['birch', 'cedar']) {
      s.hikers
        .find((x) => x.id === h)!
        .conditions.push({ id: 'sluggish', remaining: 2, unit: 'days' });
    }
    s = run(s, { type: 'useItem', hikerId: 'ash', itemUid: bandaid.uid, targetId: 'birch' });
    expect(hiker(s, 'ash').inventory.bag[0]?.usesLeft).toBe(1);
    s = run(s, { type: 'useItem', hikerId: 'ash', itemUid: bandaid.uid, targetId: 'cedar' });
    expect(hiker(s, 'ash').inventory.bag).toEqual([]);
  });
});

describe('putting clothes on and taking them off', () => {
  it('puts clothes on from the bag, as a free action', () => {
    let s = fixtureGame();
    const sweater = give(s, 'ash', 'cozySweater');
    s = run(s, { type: 'putOn', hikerId: 'ash', itemUid: sweater.uid });
    expect(hiker(s, 'ash').inventory.equipped.body?.uid).toBe(sweater.uid);
    expect(hiker(s, 'ash').inventory.bag).toEqual([]);
    expect(hiker(s, 'ash').acted).toBe(false);
  });

  it('swaps out what’s in the slot; shoes and socks share Feet', () => {
    let s = fixtureGame();
    const skates = wear(s, 'ash', 'rollerSkates');
    const socks = give(s, 'ash', 'speedySocks');
    s = run(s, { type: 'putOn', hikerId: 'ash', itemUid: socks.uid });
    expect(hiker(s, 'ash').inventory.equipped.feet?.uid).toBe(socks.uid);
    expect(hiker(s, 'ash').inventory.bag.map((i) => i.uid)).toEqual([skates.uid]);
  });

  it('only clothes, only by an active hiker', () => {
    const s = fixtureGame();
    const scanner = give(s, 'ash', 'scanner');
    expect(validateAction(s, { type: 'putOn', hikerId: 'ash', itemUid: scanner.uid })).toBe(
      'Scanner isn’t something to wear.',
    );
    const sweater = give(s, 'birch', 'cozySweater');
    for (let i = 0; i < 3; i++) addInjury(s, hiker(s, 'birch'), 'test');
    expect(validateAction(s, { type: 'putOn', hikerId: 'birch', itemUid: sweater.uid })).toBe(
      'Birch has passed out.',
    );
  });

  it('takes clothes off into the bag, if there’s room (a Backpack takes its slots with it)', () => {
    let s = fixtureGame();
    wear(s, 'ash', 'backpack'); // +2 bag slots at Quality 3
    for (let i = 0; i < 5; i++) give(s, 'ash', 'scanner');
    expect(validateAction(s, { type: 'takeOff', hikerId: 'ash', slot: 'gear' })).toBe(
      'Ash’s bag is full.',
    );
    hiker(s, 'ash').inventory.bag.splice(0, 2);
    s = run(s, { type: 'takeOff', hikerId: 'ash', slot: 'gear' });
    expect(hiker(s, 'ash').inventory.equipped.gear).toBeUndefined();
    expect(hiker(s, 'ash').inventory.bag.some((i) => i.itemId === 'backpack')).toBe(true);
  });

  it('a passed-out hiker’s clothes can be taken off by someone on their tile', () => {
    let s = fixtureGame();
    wear(s, 'birch', 'cozySweater');
    for (let i = 0; i < 3; i++) addInjury(s, hiker(s, 'birch'), 'test');
    expect(validateAction(s, { type: 'takeOff', hikerId: 'birch', slot: 'body' })).toBe(
      'Pick who takes them.',
    );
    place(s, 'ash', 'L');
    expect(
      validateAction(s, { type: 'takeOff', hikerId: 'birch', slot: 'body', toId: 'ash' }),
    ).toBe('Ash isn’t on this tile.');
    place(s, 'ash', 'T');
    s = run(s, { type: 'takeOff', hikerId: 'birch', slot: 'body', toId: 'ash' });
    expect(hiker(s, 'ash').inventory.bag.map((i) => i.itemId)).toEqual(['cozySweater']);
    expect(s.log.at(-1)).toMatchObject({ kind: 'dressed', on: false, by: 'ash' });
  });
});

describe('debug and saves', () => {
  it('gives any item at a Quality, and refills items', () => {
    let s = run(fixtureGame(), {
      type: 'debug',
      op: { kind: 'giveItem', hikerId: 'ash', itemId: 'scanner', quality: 5 },
    });
    const scanner = hiker(s, 'ash').inventory.bag[0] as ItemInstance;
    expect(scanner).toMatchObject({ quality: 5, usesLeft: 4 });
    scanner.usesLeft = 1;
    s = run(s, { type: 'debug', op: { kind: 'refillItems', hikerId: 'ash' } });
    expect(hiker(s, 'ash').inventory.bag[0]?.usesLeft).toBe(4);
  });

  it('an older save’s recorded wear and lost uses come off', () => {
    const v7 = structuredClone(fixtureGame()) as unknown as Record<string, unknown>;
    const hikers = v7.hikers as { inventory: Record<string, unknown> }[];
    hikers[0]!.inventory = {
      bag: [{ uid: 'a', itemId: 'phone', usesLost: 1 }],
      equipped: { body: { uid: 'b', itemId: 'tier3Clothes', wear: 2 } },
      resources: {},
    };
    const loaded = deserialize(JSON.stringify({ ...v7, saveVersion: 7 }));
    if (!loaded.ok) throw new Error('not loaded');
    expect(loaded.state.hikers[0]!.inventory.equipped.body).toMatchObject({ durability: 8 });
    expect(loaded.state.hikers[0]!.inventory.equipped.body).not.toHaveProperty('wear');
  });
});
