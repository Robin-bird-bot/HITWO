/**
 * Prepare (docs/design/20-challenge-popup.md, sections 4 and 8): slot
 * outlines show exactly who can fill them and update as slots fill; the
 * inventory lists only what a slot takes, every thing, one tile per hiker
 * stack, faded ones last and not pickable; a stack never fills more slots
 * than it has; × empties; nothing is spent before Start; Start takes
 * exactly what's in the slots from the right hikers, and items lose a use.
 */
import { describe, expect, it } from 'vitest';
import {
  applyPrepare,
  effects,
  emptySlot,
  fillSlot,
  FOOD,
  perHikerCounts,
  res,
  item,
  rowsFor,
  slotsFor,
  spend,
  tilesFor,
  whoCanFill,
  type Fills,
  type Packs,
  type PrepRow,
} from './prepare';

const ORDER = ['finn', 'mom', 'ellie'];

/** The prototype's packs (challenge-popup/prototype.html). */
const PACKS: Packs = {
  finn: { resources: { meat: 2, mushroom: 1, grass: 1 }, items: [] },
  mom: {
    resources: { meat: 1, fish: 3, grass: 3, moss: 2 },
    items: [{ uid: 'b1', itemId: 'bearSpray', usesLeft: 1 }],
  },
  ellie: {
    resources: { mushroom: 2, moss: 1 },
    items: [
      { uid: 'c1', itemId: 'camera', usesLeft: 2 },
      { uid: 'g1', itemId: 'glasses' },
    ],
  },
};

const HEART: PrepRow = {
  id: 'lives',
  label: '+1 HEART',
  line: '',
  slots: 1,
  perHiker: true,
  accepts: FOOD,
  need: 1,
  effect: { param: 'prep.lives', step: 1 },
};
const SLOW: PrepRow = {
  id: 'slower',
  label: 'SLOWER ATTACKS',
  line: '',
  slots: 2,
  accepts: FOOD,
  need: 1,
  effect: { param: 'prep.slower', step: 1 },
};
const SMOKE: PrepRow = {
  id: 'smoke',
  label: 'SMOKY FIRE',
  line: '',
  slots: 1,
  accepts: res('grass', 'moss'),
  need: 2,
  effect: { param: 'prep.smoke', step: 1 },
};
const SPRAY: PrepRow = {
  id: 'spray',
  label: 'BEAR SPRAY',
  line: '',
  slots: 1,
  accepts: item('bearSpray'),
  need: 1,
  effect: { param: 'prep.bearSpray', step: 0.25 },
  onlyIf: (s) => s.animal === 'bear',
};

const ROWS = [HEART, SLOW, SMOKE];
const SLOTS = slotsFor(ROWS, ORDER);
const slot = (key: string) => SLOTS.find((s) => s.key === key)!;

describe('slots', () => {
  it('a row has its slots; a per-hiker row has one in each hiker’s row; only rows that apply', () => {
    expect(SLOTS.map((s) => s.key)).toEqual([
      'lives:finn',
      'lives:mom',
      'lives:ellie',
      'slower:0',
      'slower:1',
      'smoke:0',
    ]);
    expect(rowsFor([SLOW, SPRAY], { animal: 'bees' }).map((r) => r.id)).toEqual(['slower']);
    expect(rowsFor([SLOW, SPRAY], { animal: 'bear' }).map((r) => r.id)).toEqual([
      'slower',
      'spray',
    ]);
  });

  it('each slot’s outline shows exactly who can fill it now, and updates as slots fill and empty', () => {
    // Smoky Fire takes 2 of Grass or Moss: Finn has 1 Grass only; Mom has 3 Grass and 2 Moss; Ellie 1 Moss.
    expect(whoCanFill(slot('smoke:0'), SLOTS, {}, PACKS, ORDER)).toEqual(['mom']);
    expect(whoCanFill(slot('slower:0'), SLOTS, {}, PACKS, ORDER)).toEqual(['finn', 'mom', 'ellie']);
    // Ellie's two Mushrooms go into the two Slower slots: she can't fill her heart any more.
    let fills: Fills = {};
    for (const key of ['slower:0', 'slower:1']) {
      const tile = tilesFor(slot(key), SLOTS, fills, PACKS, ORDER).find(
        (t) => t.hiker === 'ellie' && t.thing.id === 'mushroom',
      )!;
      fills = fillSlot(fills, slot(key), tile);
    }
    expect(whoCanFill(slot('lives:ellie'), SLOTS, fills, PACKS, ORDER)).toEqual(['finn', 'mom']);
    // A filled slot has no outline of its own (its owner's color instead).
    expect(whoCanFill(slot('slower:0'), SLOTS, fills, PACKS, ORDER)).toEqual([]);
    // Emptying one gives her a Mushroom back.
    fills = emptySlot(fills, 'slower:1');
    expect(whoCanFill(slot('lives:ellie'), SLOTS, fills, PACKS, ORDER)).toContain('ellie');
  });
});

describe('the inventory', () => {
  it('lists only what the slot takes, every one of them, one tile per hiker stack; faded ones last', () => {
    const tiles = tilesFor(slot('lives:finn'), SLOTS, {}, PACKS, ORDER);
    expect(tiles.map((t) => `${t.hiker}:${t.thing.id}`)).toEqual([
      'finn:meat',
      'mom:meat',
      'mom:fish',
      'finn:mushroom',
      'ellie:mushroom',
    ]);
    // A thing nobody has still gets one faded tile with no owner.
    const fish = tilesFor(
      { key: 'x:0', row: { ...SLOW, accepts: res('salt', 'meat') } },
      SLOTS,
      {},
      PACKS,
      ORDER,
    );
    expect(fish.at(-1)).toMatchObject({ hiker: null, ok: false, thing: { id: 'salt' } });
    // Smoky Fire: Finn's 1 Grass and Ellie's 1 Moss are faded (it needs 2), and come last.
    const smoke = tilesFor(slot('smoke:0'), SLOTS, {}, PACKS, ORDER);
    expect(smoke.map((t) => `${t.hiker}:${t.thing.id}:${t.ok}`)).toEqual([
      'mom:grass:true',
      'mom:moss:true',
      'finn:grass:false',
      'ellie:moss:false',
    ]);
  });

  it('faded tiles can’t be picked, and a stack never fills more slots than it has', () => {
    const smoke = tilesFor(slot('smoke:0'), SLOTS, {}, PACKS, ORDER);
    const faded = smoke.find((t) => !t.ok)!;
    expect(fillSlot({}, slot('smoke:0'), faded)).toEqual({});
    // Mom's one Meat: once in a slot, her Meat tile is faded everywhere else ("0 FREE").
    let fills: Fills = {};
    const momMeat = (key: string, f: Fills) =>
      tilesFor(slot(key), SLOTS, f, PACKS, ORDER).find(
        (t) => t.hiker === 'mom' && t.thing.id === 'meat',
      )!;
    fills = fillSlot(fills, slot('slower:0'), momMeat('slower:0', fills));
    const again = momMeat('slower:1', fills);
    expect(again).toMatchObject({ ok: false, free: 0, partlyUsed: true });
    expect(fillSlot(fills, slot('slower:1'), again)).toBe(fills);
    // In its own slot, its tile still counts as free (to swap or keep).
    expect(momMeat('slower:0', fills)).toMatchObject({ ok: true, free: 1 });
  });
});

describe('effects and spending', () => {
  const filled = (): Fills => {
    let f: Fills = {};
    const pick = (key: string, hiker: string, id: string) => {
      const t = tilesFor(slot(key), SLOTS, f, PACKS, ORDER).find(
        (x) => x.hiker === hiker && x.thing.id === id,
      )!;
      f = fillSlot(f, slot(key), t);
    };
    pick('lives:mom', 'finn', 'meat');
    pick('slower:0', 'mom', 'fish');
    pick('slower:1', 'mom', 'fish');
    pick('smoke:0', 'mom', 'grass');
    return f;
  };

  it('each filled slot adds its row’s step; a per-hiker row lists its hikers', () => {
    const fills = filled();
    expect(effects(SLOTS, fills)).toMatchObject({
      counts: { lives: 1, slower: 2, smoke: 1 },
      perHiker: { lives: ['mom'] },
      skip: false,
    });
    const settings = applyPrepare({ tier: 2 }, SLOTS, fills);
    expect(settings).toMatchObject({
      tier: 2,
      'prep.slower': 2,
      'prep.smoke': 1,
      'prep.lives': ['mom'],
    });
    expect(perHikerCounts(settings, 'prep.lives')).toEqual({ mom: 1 });
  });

  it('nothing leaves a pack before Start; Start takes exactly what’s in the slots, from the right hikers', () => {
    const fills = filled();
    // Filling never touched the packs.
    expect(PACKS.mom!.resources.fish).toBe(3);
    const { packs, spent } = spend(PACKS, SLOTS, fills);
    expect(packs.finn!.resources).toEqual({ meat: 1, mushroom: 1, grass: 1 });
    expect(packs.mom!.resources).toEqual({ meat: 1, fish: 1, grass: 1, moss: 2 });
    expect(packs.ellie).toEqual(PACKS.ellie);
    expect(spent).toHaveLength(4);
  });

  it('items lose one use (gone at none); an item that doesn’t track uses stays, and is listed', () => {
    const rows: PrepRow[] = [
      { ...SPRAY, onlyIf: undefined },
      { ...SPRAY, id: 'cam', accepts: item('camera') },
      { ...SPRAY, id: 'glasses', accepts: item('glasses') },
    ];
    const slots = slotsFor(rows, ORDER);
    const fills: Fills = {
      'spray:0': { hiker: 'mom', thing: { kind: 'item', id: 'bearSpray' } },
      'cam:0': { hiker: 'ellie', thing: { kind: 'item', id: 'camera' } },
      'glasses:0': { hiker: 'ellie', thing: { kind: 'item', id: 'glasses' } },
    };
    const { packs, untracked } = spend(PACKS, slots, fills);
    expect(packs.mom!.items).toEqual([]);
    expect(packs.ellie!.items).toEqual([
      { uid: 'c1', itemId: 'camera', usesLeft: 1 },
      { uid: 'g1', itemId: 'glasses' },
    ]);
    expect(untracked).toEqual(['glasses']);
  });

  it('a SKIP IT slot skips the challenge, and adds nothing to the game', () => {
    const skipRow: PrepRow = { ...SPRAY, id: 'skip', need: 1, skip: true, onlyIf: undefined };
    const slots = slotsFor([skipRow], ORDER);
    const fills: Fills = { 'skip:0': { hiker: 'mom', thing: { kind: 'item', id: 'bearSpray' } } };
    expect(effects(slots, fills).skip).toBe(true);
    expect(applyPrepare({}, slots, fills)).toEqual({});
  });
});
