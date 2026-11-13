import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { validateAction } from '../applyAction';
import { gainCaps } from '../effects';
import { isSheltered } from '../map';
import { safeFrom } from '../night/nightEvents';
import { deserialize, serialize } from '../save';
import { scavengeSetup } from '../scavenge/setup';
import { addInjury, statMax } from '../stats';
import { END, fixtureGame, hiker, place, run, toNight } from '../test/fixtures';
import type { Action, GameState } from '../types';
import { makeItem } from './make';
import { placeShelterOn } from './shelters';

/** Puts an item in a hiker's bag; returns its uid. */
function give(s: GameState, id: string, itemId: string): string {
  const item = makeItem(s, itemId);
  hiker(s, id).inventory.bag.push(item);
  return item.uid;
}

const placeIt = (hikerId: string, itemUid: string): Action => ({
  type: 'placeShelter',
  hikerId,
  itemUid,
});

/** The Energy a hiker gets from sleeping at night on a tile, from Energy 2. */
function sleepGain(setup: (s: GameState) => void): number {
  let s = toNight(fixtureGame());
  for (const id of ['ash', 'birch', 'cedar', 'dot']) place(s, id, 'L', { energy: 2 });
  setup(s);
  s = run(s, { type: 'sleep', hikerId: 'ash' });
  return hiker(s, 'ash').stats.energy - 2;
}

describe('placing shelters', () => {
  it('a hiker puts one on their tile, as a free action', () => {
    let s = fixtureGame();
    place(s, 'ash', 'L');
    s = run(s, placeIt('ash', give(s, 'ash', 'tent')));
    expect(hiker(s, 'ash').inventory.bag).toEqual([]);
    expect(hiker(s, 'ash').acted).toBe(false);
    expect(s.section.tiles.L?.shelters).toEqual([
      expect.objectContaining({ itemId: 'tent', nightsLeft: 3, by: 'ash' }),
    ]);
    expect(s.counters.sheltersPlaced[0]).toBe(1);
    expect(s.log.at(-1)).toMatchObject({ kind: 'shelterPlaced', tileId: 'L', nights: 3 });
  });

  it('only shelters, and only from an active hiker’s bag', () => {
    const s = fixtureGame();
    expect(validateAction(s, placeIt('ash', give(s, 'ash', 'shovel')))).toBe(
      'Shovel isn’t a shelter.',
    );
  });

  it('counts its nights down at camp, then it’s gone', () => {
    let s = fixtureGame();
    place(s, 'ash', 'L');
    s = run(s, placeIt('ash', give(s, 'ash', 'tent')));
    s = run(s, END, END, END);
    expect(s.section.tiles.L?.shelters?.[0]?.nightsLeft).toBe(2);
    s = run(s, END, END, END, END, END, END);
    expect(s.section.tiles.L?.shelters).toBeUndefined();
    expect(s.log.some((e) => e.kind === 'shelterGone')).toBe(true);
  });

  it('is a basic shelter: the sleep bonus, and safe from night events', () => {
    const plain = sleepGain(() => {});
    const tent = sleepGain((s) => placeShelterOn(s, 'L', 'tent'));
    expect(tent - plain).toBe(BALANCE.sleep.shelteredEnergy - BALANCE.sleep.energy);
    const s = fixtureGame();
    place(s, 'ash', 'L');
    placeShelterOn(s, 'L', 'hammock');
    expect(safeFrom(s, hiker(s, 'ash'))).toEqual({ why: 'shelter' });
  });

  it('Ruins builds a real one', () => {
    const s = fixtureGame();
    const before = s.section.tiles.L?.shelters;
    expect(before).toBeUndefined();
    placeShelterOn(s, 'L', 'tent');
    expect(s.section.tiles.L?.shelters?.[0]).toMatchObject({ itemId: 'tent', nightsLeft: 3 });
    expect(s.section.tiles.L?.shelters?.[0]?.by).toBeUndefined();
  });
});

describe('each shelter’s own effect', () => {
  it('Cabin: +1 more Energy from sleeping there', () => {
    const tent = sleepGain((s) => placeShelterOn(s, 'L', 'tent'));
    const cabin = sleepGain((s) => placeShelterOn(s, 'L', 'cabin'));
    expect(cabin - tent).toBe(1);
  });

  it('Hostel: +1 with 2 or more hikers here, +1 more with all 4', () => {
    const tent = sleepGain((s) => placeShelterOn(s, 'L', 'tent'));
    const four = sleepGain((s) => placeShelterOn(s, 'L', 'hostel'));
    const two = sleepGain((s) => {
      placeShelterOn(s, 'L', 'hostel');
      place(s, 'cedar', 'M');
      place(s, 'dot', 'M');
    });
    const alone = sleepGain((s) => {
      placeShelterOn(s, 'L', 'hostel');
      for (const id of ['birch', 'cedar', 'dot']) place(s, id, 'M');
    });
    expect(four - tent).toBe(2);
    expect(two - tent).toBe(1);
    expect(alone - tent).toBe(0);
  });

  it('Yurt: an extra card when scavenging there', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    const before = scavengeSetup(s, hiker(s, 'ash')).count;
    placeShelterOn(s, 'L', 'yurt');
    expect(scavengeSetup(s, hiker(s, 'ash')).count).toBe(before + 1);
  });

  it('RV: the tiles next to it count as sheltered', () => {
    const s = fixtureGame();
    place(s, 'ash', 'M');
    place(s, 'birch', 'C'); // next to M
    place(s, 'cedar', 'R'); // next to M too, but a campsite anyway
    expect(isSheltered(s, hiker(s, 'birch'))).toBe(false);
    placeShelterOn(s, 'M', 'rv');
    expect(isSheltered(s, hiker(s, 'ash'))).toBe(true);
    expect(isSheltered(s, hiker(s, 'birch'))).toBe(true);
  });

  it('Tree-House: the tiles next to it are safe from night events, not sheltered', () => {
    const s = fixtureGame();
    place(s, 'birch', 'C');
    placeShelterOn(s, 'M', 'treeHouse');
    expect(safeFrom(s, hiker(s, 'birch'))).toEqual({ why: 'item', item: 'treeHouse' });
    expect(isSheltered(s, hiker(s, 'birch'))).toBe(false);
  });

  it('Medic Tent: heals 1 injury the first time each hiker sleeps there', () => {
    let s = toNight(fixtureGame());
    place(s, 'ash', 'L');
    addInjury(s, hiker(s, 'ash'), 'test');
    addInjury(s, hiker(s, 'ash'), 'test');
    placeShelterOn(s, 'L', 'medicTent');
    s = run(s, { type: 'sleep', hikerId: 'ash' });
    expect(hiker(s, 'ash').injuries).toBe(1);
    s = run(s, END, END, END); // the next night
    s = run(s, { type: 'sleep', hikerId: 'ash' });
    expect(hiker(s, 'ash').injuries).toBe(1);
  });
});

describe('trinkets', () => {
  it('Wallet: +1 to every caps gain, for good, and it’s used up', () => {
    let s = fixtureGame();
    const uid = give(s, 'ash', 'wallet');
    s = run(s, { type: 'useItem', hikerId: 'ash', itemUid: uid, targetId: 'ash' });
    expect(hiker(s, 'ash').inventory.bag).toEqual([]);
    expect(gainCaps(s, 2)).toBe(3);
    expect(gainCaps(s, 0)).toBe(0);
  });

  it('a Serum raises a hiker’s maximum for good', () => {
    let s = fixtureGame();
    const uid = give(s, 'ash', 'energySerum');
    s = run(s, { type: 'useItem', hikerId: 'ash', itemUid: uid, targetId: 'birch' });
    expect(statMax(s, hiker(s, 'birch'), 'energy')).toBe(BALANCE.stats.max + 1);
    expect(statMax(s, hiker(s, 'ash'), 'energy')).toBe(BALANCE.stats.max);
  });

  it('the ones waiting on Phase 10 or Wyatt say so', () => {
    const s = fixtureGame();
    const use = (itemId: string): Action => ({
      type: 'useItem',
      hikerId: 'ash',
      itemUid: give(s, 'ash', itemId),
      targetId: 'ash',
    });
    expect(validateAction(s, use('diploma'))).toBe(
      'Diploma can’t be used yet. It works once traits and levels arrive (Phase 10).',
    );
    expect(validateAction(s, use('ring'))).toContain('Ring can’t be used yet.');
  });
});

describe('saves', () => {
  it('a v8 save’s shelter ids become placed shelters', () => {
    const s = fixtureGame();
    const old = JSON.parse(serialize(s));
    old.saveVersion = 8;
    old.section.tiles.L.shelters = ['tent'];
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.state.section.tiles.L?.shelters).toEqual([
      expect.objectContaining({ itemId: 'tent', nightsLeft: 3 }),
    ]);
  });

  it('placed shelters survive a save and load', () => {
    let s = fixtureGame();
    place(s, 'ash', 'L');
    s = run(s, placeIt('ash', give(s, 'ash', 'medicTent')));
    const loaded = deserialize(serialize(s));
    expect(loaded.ok && loaded.state).toEqual(s);
  });
});
