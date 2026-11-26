/**
 * Prepare as cost cards (docs/design/20-challenge-popup.md, sections 4 and
 * 8): options with the same cost share a card of at most [3] slots; a
 * slot's outline shows exactly who can fill it now (none when its card's
 * effects are used up); filling is the tile, then what it does (only with
 * several effects), then who gets it (only per-hiker); used-up effects and
 * maxed hikers can't be picked; × frees the effect; nothing is spent before
 * Start, and Start takes exactly what's in the slots, from the right hikers.
 */
import { describe, expect, it } from 'vitest';
import {
  applyPrepare,
  cardsFor,
  costText,
  effectOpen,
  effects,
  emptySlot,
  fillSlot,
  FOOD,
  group,
  item,
  nextStep,
  orderCards,
  perHikerCounts,
  res,
  slotsFor,
  spend,
  targetOpen,
  tilesFor,
  whoCanFill,
  type Card,
  type Fills,
  type Option,
  type Packs,
  type Slot,
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

const option = (o: Partial<Option> & Pick<Option, 'id'>): Option => ({
  title: o.id.toUpperCase(),
  color: 'green',
  accepts: FOOD,
  need: 1,
  label: o.id.toUpperCase(),
  short: o.id.toUpperCase(),
  note: '',
  max: 1,
  param: `prep.${o.id}`,
  step: 1,
  ...o,
});

const HEART = option({ id: 'lives', label: '+1 HEART', perHiker: true });
const SLOW = option({ id: 'slower', title: 'SLOWER ATTACKS', color: 'red', max: 2 });
const SMOKE = option({
  id: 'smoke',
  title: 'SMOKY FIRE',
  color: 'red',
  accepts: res('grass', 'moss'),
  need: 2,
});
const SPRAY = option({
  id: 'bearSpray',
  title: 'BEAR SPRAY',
  color: 'red',
  accepts: item('bearSpray'),
  step: 0.25,
  onlyIf: (s) => s.animal === 'bear',
});

const CARDS = cardsFor([HEART, SLOW, SMOKE], {}, ORDER.length);
const SLOTS = slotsFor(CARDS);
const slot = (key: string) => SLOTS.find((s) => s.key === key)!;
const FOOD_SLOTS = ['lives+slower:0', 'lives+slower:1', 'lives+slower:2'];

/** Fills a slot the way the pop-up does: a hiker's stack, an effect, and who gets it. */
function fill(
  fills: Fills,
  key: string,
  hiker: string,
  thing: string,
  effect: string,
  target?: string,
  slots: readonly Slot[] = SLOTS,
): Fills {
  const s = slots.find((x) => x.key === key)!;
  const tile = tilesFor(s, slots, fills, PACKS, ORDER).find(
    (t) => t.hiker === hiker && t.thing.id === thing,
  )!;
  return fillSlot(fills, s, tile, effect, ORDER, target);
}

describe('cost cards', () => {
  it('options with the same cost share one card; Food is FOOD, the rest take the first title and color', () => {
    expect(CARDS.map((c) => [c.title, c.color, c.effects.map((e) => e.id)])).toEqual([
      ['FOOD', 'green', ['lives', 'slower']],
      ['SMOKY FIRE', 'red', ['smoke']],
    ]);
    expect(costText(CARDS[0]!)).toBe('×1 MEAT, FISH OR MUSHROOM');
    expect(costText(CARDS[1]!)).toBe('×2 GRASS OR MOSS');
    expect(costText({ accepts: group('forest'), need: 2 })).toBe('×2 FOREST RESOURCES');
  });

  it('a card never has more than [3] slots, and no more than its effects can use', () => {
    // +1 heart for 3 hikers and slower twice is 5 uses, but the card has 3 slots.
    expect(CARDS[0]!.slots).toBe(3);
    expect(CARDS[1]!.slots).toBe(1);
    expect(cardsFor([SLOW], {}, 3)[0]!.slots).toBe(2);
    expect(cardsFor([HEART], {}, 2)[0]!.slots).toBe(2);
    for (const c of cardsFor([HEART, SLOW, option({ id: 'x', max: 3 })], {}, 4)) {
      expect(c.slots).toBeLessThanOrEqual(3);
    }
  });

  it('only options that apply to this run make cards', () => {
    expect(cardsFor([SLOW, SPRAY], { animal: 'bees' }, 3).map((c) => c.id)).toEqual(['slower']);
    expect(cardsFor([SLOW, SPRAY], { animal: 'bear' }, 3).map((c) => c.id)).toEqual([
      'slower',
      'bearSpray',
    ]);
  });

  it('cards nobody can fill go last', () => {
    const salt = option({ id: 'salt', title: 'SALT LINE', accepts: res('salt') });
    const cards = cardsFor([salt, SLOW], {}, 3);
    const slots = slotsFor(cards);
    expect(orderCards(cards, slots, {}, PACKS, ORDER).map((c) => c.id)).toEqual(['slower', 'salt']);
  });
});

describe('outlines', () => {
  it('show exactly who can fill the slot now, and update as slots fill and empty', () => {
    // Smoky Fire takes 2 of Grass or Moss: Finn has 1 Grass; Mom 3 Grass and 2 Moss; Ellie 1 Moss.
    expect(whoCanFill(slot('smoke:0'), SLOTS, {}, PACKS, ORDER)).toEqual(['mom']);
    expect(whoCanFill(slot(FOOD_SLOTS[0]!), SLOTS, {}, PACKS, ORDER)).toEqual(ORDER);
    // Ellie's two Mushrooms go into two Food slots: she can't fill the third.
    let fills = fill({}, FOOD_SLOTS[0]!, 'ellie', 'mushroom', 'slower');
    fills = fill(fills, FOOD_SLOTS[1]!, 'ellie', 'mushroom', 'lives', 'finn');
    expect(whoCanFill(slot(FOOD_SLOTS[2]!), SLOTS, fills, PACKS, ORDER)).toEqual(['finn', 'mom']);
    // A filled slot has no outline of its own (its owner's color instead).
    expect(whoCanFill(slot(FOOD_SLOTS[0]!), SLOTS, fills, PACKS, ORDER)).toEqual([]);
    // × gives her a Mushroom back.
    fills = emptySlot(fills, FOOD_SLOTS[1]!);
    expect(whoCanFill(slot(FOOD_SLOTS[2]!), SLOTS, fills, PACKS, ORDER)).toContain('ellie');
  });

  it('show nobody when the card’s effects are used up', () => {
    // A card with a slot to spare: once its one use is taken, the other slot has no outline.
    const once = option({ id: 'once' });
    const card: Card = { ...cardsFor([once], {}, 3)[0]!, slots: 2 };
    const slots = slotsFor([card]);
    const fills = fill({}, 'once:0', 'finn', 'meat', 'once', undefined, slots);
    expect(fills['once:0']).toBeDefined();
    expect(whoCanFill(slots[1]!, slots, fills, PACKS, ORDER)).toEqual([]);
  });
});

describe('filling a slot', () => {
  it('asks what it does only with several effects, and who gets it only for a per-hiker effect', () => {
    expect(nextStep(slot(FOOD_SLOTS[0]!), null)).toBe('what');
    expect(nextStep(slot(FOOD_SLOTS[0]!), 'lives')).toBe('who');
    expect(nextStep(slot(FOOD_SLOTS[0]!), 'slower')).toBe('done');
    expect(nextStep(slot('smoke:0'), null)).toBe('done');
    const hearts = slotsFor(cardsFor([HEART], {}, 3));
    expect(nextStep(hearts[0]!, null)).toBe('who');
  });

  it('a used-up effect and a hiker who has the most can’t be picked', () => {
    let fills = fill({}, FOOD_SLOTS[0]!, 'mom', 'fish', 'slower');
    fills = fill(fills, FOOD_SLOTS[1]!, 'mom', 'fish', 'slower');
    // SLOWER ATTACKS is used up (2 at most): the third slot can't take it.
    expect(effectOpen(SLOW, fills, ORDER, FOOD_SLOTS[2])).toBe(false);
    expect(fill(fills, FOOD_SLOTS[2]!, 'mom', 'fish', 'slower')).toBe(fills);
    // +1 heart is still open; once Finn has it, he's maxed and someone else must get it.
    const withFinn = fill(fills, FOOD_SLOTS[2]!, 'mom', 'fish', 'lives', 'finn');
    expect(withFinn[FOOD_SLOTS[2]!]).toEqual({
      hiker: 'mom',
      thing: { kind: 'resource', id: 'fish' },
      effect: 'lives',
      target: 'finn',
    });
    expect(targetOpen(HEART, 'finn', withFinn)).toBe(false);
    expect(targetOpen(HEART, 'ellie', withFinn)).toBe(true);
    const twice = fill(withFinn, FOOD_SLOTS[0]!, 'finn', 'meat', 'lives', 'finn');
    // Refilling slot 0 with Finn's heart: he already has one (in slot 2).
    expect(twice).toBe(withFinn);
    // A per-hiker effect needs someone to get it.
    expect(fill({}, FOOD_SLOTS[0]!, 'finn', 'meat', 'lives')).toEqual({});
  });

  it('a faded tile can’t be picked, and a stack never fills more slots than it has', () => {
    const smoke = tilesFor(slot('smoke:0'), SLOTS, {}, PACKS, ORDER);
    expect(smoke.map((t) => `${t.hiker}:${t.thing.id}:${t.ok}`)).toEqual([
      'mom:grass:true',
      'mom:moss:true',
      'finn:grass:false',
      'ellie:moss:false',
    ]);
    expect(fillSlot({}, slot('smoke:0'), smoke.at(-1)!, 'smoke', ORDER)).toEqual({});
    // Mom's one Meat: once in a slot, her Meat tile is faded everywhere else ("0 FREE").
    const fills = fill({}, FOOD_SLOTS[0]!, 'mom', 'meat', 'slower');
    const again = tilesFor(slot(FOOD_SLOTS[1]!), SLOTS, fills, PACKS, ORDER).find(
      (t) => t.hiker === 'mom' && t.thing.id === 'meat',
    )!;
    expect(again).toMatchObject({ ok: false, free: 0, partlyUsed: true });
  });

  it('× empties a slot and frees its effect', () => {
    let fills = fill({}, 'smoke:0', 'mom', 'grass', 'smoke');
    expect(effectOpen(SMOKE, fills, ORDER, undefined)).toBe(false);
    fills = emptySlot(fills, 'smoke:0');
    expect(fills).toEqual({});
    expect(effectOpen(SMOKE, fills, ORDER)).toBe(true);
  });
});

describe('effects and spending', () => {
  const filled = (): Fills => {
    let f = fill({}, FOOD_SLOTS[0]!, 'finn', 'meat', 'lives', 'mom');
    f = fill(f, FOOD_SLOTS[1]!, 'mom', 'fish', 'slower');
    f = fill(f, FOOD_SLOTS[2]!, 'mom', 'fish', 'slower');
    return fill(f, 'smoke:0', 'mom', 'grass', 'smoke');
  };

  it('each fill adds its own effect; a per-hiker one lists who got it', () => {
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
    expect(PACKS.mom!.resources.fish).toBe(3);
    const { packs, spent } = spend(PACKS, SLOTS, fills);
    expect(packs.finn!.resources).toEqual({ meat: 1, mushroom: 1, grass: 1 });
    // A ×2 slot takes 2 of the same thing from one hiker.
    expect(packs.mom!.resources).toEqual({ meat: 1, fish: 1, grass: 1, moss: 2 });
    expect(packs.ellie).toEqual(PACKS.ellie);
    expect(spent).toHaveLength(4);
  });

  it('items lose one use (gone at none); an item that doesn’t track uses stays, and is listed', () => {
    const cam = option({ id: 'cam', accepts: item('camera') });
    const glasses = option({ id: 'glasses', accepts: item('glasses') });
    const slots = slotsFor(cardsFor([{ ...SPRAY, onlyIf: undefined }, cam, glasses], {}, 3));
    const fills: Fills = {
      'bearSpray:0': {
        hiker: 'mom',
        thing: { kind: 'item', id: 'bearSpray' },
        effect: 'bearSpray',
      },
      'cam:0': { hiker: 'ellie', thing: { kind: 'item', id: 'camera' }, effect: 'cam' },
      'glasses:0': { hiker: 'ellie', thing: { kind: 'item', id: 'glasses' }, effect: 'glasses' },
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
    const skip = option({ id: 'skip', accepts: item('bearSpray'), skip: true });
    const slots = slotsFor(cardsFor([skip], {}, 3));
    const fills: Fills = {
      'skip:0': { hiker: 'mom', thing: { kind: 'item', id: 'bearSpray' }, effect: 'skip' },
    };
    expect(effects(slots, fills).skip).toBe(true);
    expect(applyPrepare({}, slots, fills)).toEqual({});
  });
});
