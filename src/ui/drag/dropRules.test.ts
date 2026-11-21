import { describe, expect, it } from 'vitest';
import { applyAction, type GameState, type ItemInstance } from '../../engine';
import { makeItem } from '../../engine/items/make';
import { fixtureGame, hiker, place, run } from '../../engine/test/fixtures';
import { bringChoices, popupAction } from '../game/movePlan';
import type { DragPayload } from './drag';
import {
  buyDrop,
  canDragHiker,
  canPickUpOffer,
  hikerDropTiles,
  mapDrop,
  portraitDrop,
  sellDrop,
  slotDrop,
  tileDrop,
} from './dropRules';

/** Ash and Birch on L, Cedar on M; Ash carries a few things. */
function trail(): { s: GameState; give(itemId: string): ItemInstance } {
  const s = fixtureGame();
  place(s, 'ash', 'L');
  place(s, 'birch', 'L');
  place(s, 'cedar', 'M');
  hiker(s, 'ash').inventory.resources = { wood: 2 };
  const give = (itemId: string) => {
    const item = makeItem(s, itemId, { quality: 3 });
    hiker(s, 'ash').inventory.bag.push(item);
    return item;
  };
  return { s, give };
}
const itemFrom = (itemUid: string): DragPayload => ({ kind: 'item', hikerId: 'ash', itemUid });
const wood: DragPayload = { kind: 'resource', hikerId: 'ash', resource: 'wood' };

describe('dragging a hiker (Nov 14 update)', () => {
  it('lights up only the connected tiles the hiker can move to', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    // L connects to T, M and the checkpoint C; R isn't connected.
    expect([...hikerDropTiles(s, 'ash')].sort()).toEqual(['C', 'M', 'T']);
  });

  it('lights up nothing once the hiker has acted, or when they can’t be picked up', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    hiker(s, 'ash').acted = true;
    expect(hikerDropTiles(s, 'ash').size).toBe(0);
    hiker(s, 'birch').status = 'passedOut';
    expect(canDragHiker(hiker(s, 'birch'))).toBe(false);
    expect(hikerDropTiles(s, 'birch').size).toBe(0);
    expect(canDragHiker(hiker(s, 'cedar'))).toBe(true);
  });

  it('an Exhausted hiker (who can only sleep) lights up nothing', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { energy: 1 });
    expect(hikerDropTiles(s, 'ash').size).toBe(0);
  });
});

describe('the move pop-up', () => {
  it('lists the others on the tile, and why one can’t come', () => {
    const s = fixtureGame();
    for (const id of ['ash', 'birch', 'cedar']) place(s, id, 'L');
    hiker(s, 'cedar').acted = true;
    const choices = bringChoices(s, hiker(s, 'ash'), 'M');
    expect(choices.map((c) => [c.hiker.id, c.reason === null])).toEqual([
      ['birch', true],
      ['cedar', false],
    ]);
    expect(choices[1]?.reason).toMatch(/already acted/);
  });

  it('Move all moves only the checked hikers', () => {
    let s = fixtureGame();
    for (const id of ['ash', 'birch', 'cedar']) place(s, id, 'L');
    s = applyAction(s, popupAction(hiker(s, 'ash'), 'M', ['birch']));
    expect(hiker(s, 'ash').tileId).toBe('M');
    expect(hiker(s, 'birch').tileId).toBe('M');
    expect(hiker(s, 'cedar').tileId).toBe('L');
    expect(hiker(s, 'cedar').acted).toBe(false);
  });

  it('Move moves the hiker alone', () => {
    let s = fixtureGame();
    for (const id of ['ash', 'birch']) place(s, id, 'L');
    s = applyAction(s, popupAction(hiker(s, 'ash'), 'M', null));
    expect(hiker(s, 'ash').tileId).toBe('M');
    expect(hiker(s, 'birch').tileId).toBe('L');
  });
});

describe('dragging items and resources (Nov 14 update)', () => {
  it('giving: only hikers on the same tile light up, or anyone with a Walkie-Talkie', () => {
    const { s, give } = trail();
    expect(portraitDrop(s, wood, 'birch')?.kind).toBe('give');
    expect(portraitDrop(s, wood, 'cedar')).toBeNull();
    expect(portraitDrop(s, wood, 'ash')).toBeNull();
    const radio = give('walkieTalkie');
    const tuned = run(s, {
      type: 'useItem',
      hikerId: 'ash',
      itemUid: radio.uid,
      targetId: 'ash',
    });
    expect(portraitDrop(tuned, wood, 'cedar')?.kind).toBe('give');
  });

  it('equipping: clothes light up only their own slot', () => {
    const { s, give } = trail();
    const shirt = give('plainShirt');
    expect(slotDrop(s, itemFrom(shirt.uid), 'body')).toEqual({
      type: 'putOn',
      hikerId: 'ash',
      itemUid: shirt.uid,
    });
    expect(slotDrop(s, itemFrom(shirt.uid), 'feet')).toBeNull();
    expect(slotDrop(s, itemFrom(give('shovel').uid), 'gear')).toBeNull();
    expect(slotDrop(s, wood, 'body')).toBeNull();
  });

  it('food: their own portrait eats it; someone here can be given it or eat it', () => {
    const { s, give } = trail();
    const mix = give('trailMix');
    expect(portraitDrop(s, itemFrom(mix.uid), 'ash')).toEqual({
      kind: 'eat',
      action: { type: 'eat', hikerId: 'ash', itemUid: mix.uid },
    });
    const feed = portraitDrop(s, itemFrom(mix.uid), 'birch');
    expect(feed?.kind).toBe('feed');
    expect(feed?.kind === 'feed' && feed.eat).toEqual({
      type: 'eat',
      hikerId: 'birch',
      itemUid: mix.uid,
    });
    expect(portraitDrop(s, itemFrom(mix.uid), 'cedar')).toBeNull();
    // Not food: their own portrait does nothing; someone here is given it.
    const shovel = give('shovel');
    expect(portraitDrop(s, itemFrom(shovel.uid), 'ash')).toBeNull();
    expect(portraitDrop(s, itemFrom(shovel.uid), 'birch')?.kind).toBe('give');
  });

  it('a map tool lights up only the tiles it can be used on', () => {
    const { s, give } = trail();
    const scanner = give('scanner');
    // L connects to T, M and the checkpoint C; R isn't next to it.
    expect(tileDrop(s, itemFrom(scanner.uid), 'M')?.kind).toBe('tool');
    expect(tileDrop(s, itemFrom(scanner.uid), 'R')).toBeNull();
    expect(mapDrop(s, itemFrom(scanner.uid))).toBe(false);
  });

  it('a tool with no tile to pick goes anywhere on the map (it opens its Use step)', () => {
    const { s, give } = trail();
    expect(mapDrop(s, itemFrom(give('walkieTalkie').uid))).toBe(true);
    expect(mapDrop(s, itemFrom(give('trailMix').uid))).toBe(false);
    expect(mapDrop(s, wood)).toBe(false);
  });

  it('a shelter lights up only its hiker’s own tile', () => {
    const { s, give } = trail();
    const tent = give('tent');
    expect(tileDrop(s, itemFrom(tent.uid), 'L')?.kind).toBe('place');
    expect(tileDrop(s, itemFrom(tent.uid), 'M')).toBeNull();
  });
});

describe('dragging at the ranger station', () => {
  function open(caps: number): GameState {
    const s = run(fixtureGame({ seed: 5 }), {
      type: 'debug',
      op: { kind: 'openStation', themeId: 'finn' },
    });
    s.caps = caps;
    return s;
  }

  it('buying: packs with room light up, only while the party can afford it', () => {
    const s = open(100);
    const offer = s.station!.items[0]!;
    const card: DragPayload = { kind: 'offer', offerId: offer.id };
    expect(canPickUpOffer(s, offer.id)).toBe(true);
    expect(buyDrop(s, card, 'ash')).toEqual({ type: 'buy', offerId: offer.id, hikerId: 'ash' });
    // A full bag can't take it.
    const bag = hiker(s, 'birch').inventory.bag;
    while (bag.length < 4) bag.push(makeItem(s, 'tent'));
    expect(buyDrop(s, card, 'birch')).toBeNull();
    // Too few caps: it can't even be picked up.
    s.caps = offer.price - 1;
    expect(canPickUpOffer(s, offer.id)).toBe(false);
    expect(buyDrop(s, card, 'ash')).toBeNull();
  });

  it('a sold card and the specials can’t be dragged', () => {
    const s = open(100);
    const offer = s.station!.items[0]!;
    offer.sold = true;
    expect(canPickUpOffer(s, offer.id)).toBe(false);
    expect(canPickUpOffer(s, 'special')).toBe(false);
  });

  it('selling: a bag item, or a whole stack of a resource', () => {
    const s = open(0);
    const mix = makeItem(s, 'trailMix', { quality: 3 });
    hiker(s, 'ash').inventory.bag.push(mix);
    hiker(s, 'ash').inventory.resources = { wood: 3 };
    expect(sellDrop(s, itemFrom(mix.uid))).toEqual({ hikerId: 'ash', itemUid: mix.uid });
    expect(sellDrop(s, wood)).toEqual({ hikerId: 'ash', resource: 'wood', count: 3 });
    expect(sellDrop(fixtureGame(), wood)).toBeNull();
  });
});

describe('Presents on portraits (holiday hikers)', () => {
  it('a Present dropped on its owner’s own portrait opens it', () => {
    const { s } = trail();
    const p = run(s, {
      type: 'debug',
      op: { kind: 'givePresent', hikerId: 'ash', colorway: 3, grade: 'plain' },
    });
    const uid = hiker(p, 'ash').inventory.bag.at(-1)!.uid;
    expect(portraitDrop(p, itemFrom(uid), 'ash')).toEqual({
      kind: 'open',
      action: { type: 'openPresent', hikerId: 'ash', itemUid: uid },
    });
    // On someone else's portrait it's given, like any item.
    expect(portraitDrop(p, itemFrom(uid), 'birch')?.kind).toBe('give');
    // Without an action left, there's nothing to light up on their own portrait.
    hiker(p, 'ash').acted = true;
    expect(portraitDrop(p, itemFrom(uid), 'ash')).toBeNull();
  });

  it('Two Sizes Too Small: her items don’t light up other portraits', () => {
    const { s } = trail();
    hiker(s, 'ash').slots.push({ type: 'U', traitId: 'twoSizesTooSmall' });
    const p = run(s, {
      type: 'debug',
      op: { kind: 'givePresent', hikerId: 'ash', colorway: 1, grade: 'tier3' },
    });
    const uid = hiker(p, 'ash').inventory.bag.at(-1)!.uid;
    expect(portraitDrop(p, itemFrom(uid), 'birch')).toBeNull();
    // Her resources still go.
    expect(portraitDrop(p, wood, 'birch')?.kind).toBe('give');
  });
});
