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
import { setUpShelterOn, shelterDeployments } from './shelters';

/** Puts an item in a hiker's bag; returns its uid. */
function give(s: GameState, id: string, itemId: string): string {
  const item = makeItem(s, itemId);
  hiker(s, id).inventory.bag.push(item);
  return item.uid;
}

const setUp = (hikerId: string, itemUid: string): Action => ({
  type: 'setUpShelter',
  hikerId,
  itemUid,
});
const packUp = (hikerId: string): Action => ({ type: 'packUpShelter', hikerId });

/** A shelter set up on a tile, new, with nobody as its owner (like Ruins). */
const up = (s: GameState, tileId: string, itemId: string) =>
  setUpShelterOn(s, tileId, itemId, shelterDeployments(itemId));

/** The Energy a hiker gets from sleeping at night on a tile, from Energy 2. */
function sleepGain(setup: (s: GameState) => void): number {
  let s = toNight(fixtureGame());
  for (const id of ['ash', 'birch', 'cedar', 'dot']) place(s, id, 'L', { energy: 2 });
  setup(s);
  s = run(s, { type: 'sleep', hikerId: 'ash' });
  return hiker(s, 'ash').stats.energy - 2;
}

describe('portable shelters (Phase 10.6)', () => {
  it('setting one up is free, on your own tile, and uses 1 deployment; it leaves the pack', () => {
    let s = fixtureGame();
    place(s, 'ash', 'L');
    s = run(s, setUp('ash', give(s, 'ash', 'tent')));
    expect(hiker(s, 'ash').inventory.bag).toEqual([]);
    expect(hiker(s, 'ash').acted).toBe(false);
    expect(s.section.tiles.L?.shelters).toEqual([
      expect.objectContaining({ itemId: 'tent', deploymentsLeft: 3, by: 'ash' }),
    ]);
    expect(s.counters.sheltersPlaced[0]).toBe(1);
    expect(s.log.at(-1)).toMatchObject({ kind: 'shelterSetUp', tileId: 'L', left: 3 });
  });

  it('only shelters, only from an active hiker’s pack, and only 1 up on a tile', () => {
    let s = fixtureGame();
    place(s, 'ash', 'L');
    place(s, 'birch', 'L');
    expect(validateAction(s, setUp('ash', give(s, 'ash', 'shovel')))).toBe(
      'Shovel isn’t a shelter.',
    );
    s = run(s, setUp('ash', give(s, 'ash', 'tent')));
    expect(validateAction(s, setUp('birch', give(s, 'birch', 'hammock')))).toBe(
      'A Tent is already up here.',
    );
  });

  it('it doesn’t count nights: it stays up until it’s packed', () => {
    let s = fixtureGame();
    place(s, 'ash', 'L');
    s = run(s, setUp('ash', give(s, 'ash', 'tent')));
    for (let i = 0; i < 9; i++) s = run(s, END);
    expect(s.section.tiles.L?.shelters?.[0]).toMatchObject({ itemId: 'tent', deploymentsLeft: 3 });
  });

  it('anyone on the tile with room packs it up (free), and it can be set up again', () => {
    let s = fixtureGame();
    place(s, 'ash', 'L');
    place(s, 'birch', 'L');
    const uid = give(s, 'ash', 'tent');
    s = run(s, setUp('ash', uid), packUp('birch'));
    expect(s.section.tiles.L?.shelters).toBeUndefined();
    const tent = hiker(s, 'birch').inventory.bag.find((i) => i.itemId === 'tent');
    expect(tent).toMatchObject({ uid, deploymentsLeft: 3 });
    expect(hiker(s, 'birch').acted).toBe(false);
    s = run(s, setUp('birch', uid));
    expect(s.section.tiles.L?.shelters?.[0]).toMatchObject({ deploymentsLeft: 2, by: 'birch' });
  });

  it('packs itself into its owner’s pack when they leave (a move or a Move All)', () => {
    let s = fixtureGame();
    place(s, 'ash', 'T');
    s = run(s, setUp('ash', give(s, 'ash', 'tent')));
    s = run(s, { type: 'move', hikerId: 'ash', toTileId: 'L' });
    expect(s.section.tiles.T?.shelters).toBeUndefined();
    expect(hiker(s, 'ash').inventory.bag.map((i) => i.itemId)).toContain('tent');
    expect(s.log.some((e) => e.kind === 'shelterPackedUp' && e.auto)).toBe(true);
  });

  it('stays up when its owner leaves with a full pack', () => {
    let s = fixtureGame();
    place(s, 'ash', 'T');
    s = run(s, setUp('ash', give(s, 'ash', 'tent')));
    for (let i = 0; i < 10; i++) give(s, 'ash', 'shovel');
    s = run(s, { type: 'move', hikerId: 'ash', toTileId: 'L' });
    expect(s.section.tiles.T?.shelters?.[0]?.itemId).toBe('tent');
  });

  it('a worn-out one can’t be set up, and is thrown away when it’s packed', () => {
    let s = fixtureGame();
    place(s, 'ash', 'L');
    const uid = give(s, 'ash', 'hammock'); // 2 deployments
    s = run(s, setUp('ash', uid), packUp('ash'), setUp('ash', uid));
    expect(s.section.tiles.L?.shelters?.[0]?.deploymentsLeft).toBe(0);
    s = run(s, packUp('ash'));
    expect(s.section.tiles.L?.shelters).toBeUndefined();
    expect(hiker(s, 'ash').inventory.bag.some((i) => i.uid === uid)).toBe(false);
    expect(s.log.at(-1)).toMatchObject({ kind: 'shelterWornOut', itemId: 'hammock' });
    const worn = makeItem(s, 'hammock');
    worn.deploymentsLeft = 0;
    hiker(s, 'ash').inventory.bag.push(worn);
    expect(validateAction(s, setUp('ash', worn.uid))).toBe('The Hammock is worn out.');
  });

  it('shelters everyone on its tile', () => {
    let s = fixtureGame();
    place(s, 'ash', 'L');
    place(s, 'birch', 'L');
    s = run(s, setUp('ash', give(s, 'ash', 'tent')));
    expect(isSheltered(s, hiker(s, 'ash'))).toBe(true);
    expect(isSheltered(s, hiker(s, 'birch'))).toBe(true);
  });

  it('is a basic shelter: the sleep bonus, and safe from night events', () => {
    const plain = sleepGain(() => {});
    const tent = sleepGain((s) => up(s, 'L', 'tent'));
    expect(tent - plain).toBe(BALANCE.sleep.shelteredEnergy - BALANCE.sleep.energy);
    const s = fixtureGame();
    place(s, 'ash', 'L');
    up(s, 'L', 'hammock');
    expect(safeFrom(s, hiker(s, 'ash'))).toEqual({ why: 'shelter' });
  });

  it('Ruins builds a real one', () => {
    const s = fixtureGame();
    const before = s.section.tiles.L?.shelters;
    expect(before).toBeUndefined();
    up(s, 'L', 'tent');
    expect(s.section.tiles.L?.shelters?.[0]).toMatchObject({ itemId: 'tent', deploymentsLeft: 3 });
    expect(s.section.tiles.L?.shelters?.[0]?.by).toBeUndefined();
  });
});

describe('each shelter’s own effect', () => {
  it('Cabin: +1 more Energy from sleeping there', () => {
    const tent = sleepGain((s) => up(s, 'L', 'tent'));
    const cabin = sleepGain((s) => up(s, 'L', 'cabin'));
    expect(cabin - tent).toBe(1);
  });

  it('Hostel: +1 with 2 or more hikers here, +1 more with all 4', () => {
    const tent = sleepGain((s) => up(s, 'L', 'tent'));
    const four = sleepGain((s) => up(s, 'L', 'hostel'));
    const two = sleepGain((s) => {
      up(s, 'L', 'hostel');
      place(s, 'cedar', 'M');
      place(s, 'dot', 'M');
    });
    const alone = sleepGain((s) => {
      up(s, 'L', 'hostel');
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
    up(s, 'L', 'yurt');
    expect(scavengeSetup(s, hiker(s, 'ash')).count).toBe(before + 1);
  });

  it('RV: the tiles next to it count as sheltered', () => {
    const s = fixtureGame();
    place(s, 'ash', 'M');
    place(s, 'birch', 'C'); // next to M
    place(s, 'cedar', 'R'); // next to M too, but a campsite anyway
    expect(isSheltered(s, hiker(s, 'birch'))).toBe(false);
    up(s, 'M', 'rv');
    expect(isSheltered(s, hiker(s, 'ash'))).toBe(true);
    expect(isSheltered(s, hiker(s, 'birch'))).toBe(true);
  });

  it('Tree-House: the tiles next to it are safe from night events, not sheltered', () => {
    const s = fixtureGame();
    place(s, 'birch', 'C');
    up(s, 'M', 'treeHouse');
    expect(safeFrom(s, hiker(s, 'birch'))).toEqual({ why: 'item', item: 'treeHouse' });
    expect(isSheltered(s, hiker(s, 'birch'))).toBe(false);
  });

  it('Medic Tent: heals 1 injury the first time each hiker sleeps there', () => {
    let s = toNight(fixtureGame());
    place(s, 'ash', 'L');
    addInjury(s, hiker(s, 'ash'), 'test');
    addInjury(s, hiker(s, 'ash'), 'test');
    up(s, 'L', 'medicTent');
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

  it('the one waiting on Wyatt says so', () => {
    const s = fixtureGame();
    const use = (itemId: string): Action => ({
      type: 'useItem',
      hikerId: 'ash',
      itemUid: give(s, 'ash', itemId),
      targetId: 'ash',
    });
    // The Phase 10 trinkets work now (src/engine/traits/trinkets.test.ts).
    expect(validateAction(s, use('diploma'))).toBeNull();
    expect(validateAction(s, use('ring'))).toContain('Ring can’t be used yet.');
  });
});

describe('saves', () => {
  it('a v8 save’s shelter ids become set-up shelters (via nights left)', () => {
    const s = fixtureGame();
    const old = JSON.parse(serialize(s));
    old.saveVersion = 8;
    old.section.tiles.L.shelters = ['tent'];
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.state.section.tiles.L?.shelters).toEqual([
      expect.objectContaining({ itemId: 'tent', deploymentsLeft: 3 }),
    ]);
  });

  it('a v19 save’s placed shelter becomes a set-up one: nights left are its deployments, and it has an owner', () => {
    const s = fixtureGame();
    place(s, 'birch', 'L');
    const old = JSON.parse(serialize(s));
    old.saveVersion = 19;
    old.section.tiles.L.shelters = [
      { uid: 'shelter-1', itemId: 'cabin', nightsLeft: 2 },
      { uid: 'shelter-2', itemId: 'tent', nightsLeft: 1, by: 'ash' },
    ];
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.state.section.tiles.L?.shelters).toEqual([
      { uid: 'shelter-1', itemId: 'cabin', deploymentsLeft: 2, by: 'birch' },
    ]);
  });

  it('placed shelters survive a save and load', () => {
    let s = fixtureGame();
    place(s, 'ash', 'L');
    s = run(s, setUp('ash', give(s, 'ash', 'medicTent')));
    const loaded = deserialize(serialize(s));
    expect(loaded.ok && loaded.state).toEqual(s);
  });
});
