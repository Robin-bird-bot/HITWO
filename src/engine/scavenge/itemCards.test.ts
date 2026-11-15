import { describe, expect, it } from 'vitest';
import { SCAVENGE_CARDS } from '../../content';
import { ITEMS } from '../../content/items';
import { hasQuality } from '../items/quality';
import { seedRng } from '../rng';
import { fixtureGame, hiker, place, run } from '../test/fixtures';
import type { GameState, ScavengeCardType, TileNode } from '../types';
import { dealCard, dealCards } from './deal';

const ITEM_CARDS: ScavengeCardType[] = [
  'toolCard',
  'foodCard',
  'clothesCard',
  'shelterCard',
  'trinketCard',
];
const nodes: TileNode[] = [{ type: 'forest', revealed: true }];

/** Ash on L, with the next deal's first card forced. */
function dealt(type: ScavengeCardType, seed = 6): GameState {
  const s = fixtureGame({ seed });
  place(s, 'ash', 'L');
  s.debugDeal = [type];
  return run(s, { type: 'scavenge', hikerId: 'ash' }, { type: 'scavengeFlip', cards: [0] });
}

describe('item cards from scavenging (Nov 14 update)', () => {
  it('are as rare as the random find of their type', () => {
    for (const type of ['tool', 'food', 'clothes', 'shelter', 'trinket'] as const) {
      const find = SCAVENGE_CARDS[`${type}Find` as ScavengeCardType];
      const card = SCAVENGE_CARDS[`${type}Card` as ScavengeCardType];
      expect(card.rarity).toBe(find.rarity);
      expect(card.itemType).toBe(type);
      expect(card.itemCard).toBe(true);
    }
  });

  it('show one real item, its Quality rolled when dealt (none for shelters and trinkets)', () => {
    for (const type of ITEM_CARDS) {
      const card = dealCard(seedRng(11), { nodes, abundance: 20, luck: 0, count: 1 }, type);
      const itemId = card.items?.[0];
      expect(card.items).toHaveLength(1);
      const def = ITEMS[itemId ?? ''];
      expect(def?.type).toBe(SCAVENGE_CARDS[type].itemType);
      if (def && hasQuality(def)) expect(card.itemQuality).toBeGreaterThanOrEqual(1);
      else expect(card.itemQuality).toBeUndefined();
    }
  });

  it('keep their rolled Quality: the hiker gets exactly that item', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = dealt('toolCard', seed);
      const card = s.scavenge?.cards[0];
      const after = run(s, { type: 'scavengeTake', card: 0 });
      const got = hiker(after, 'ash').inventory.bag.at(-1);
      expect(got?.itemId).toBe(card?.items?.[0]);
      expect(got?.quality).toBe(card?.itemQuality);
    }
  });

  it('are never Empty, even at Abundance 0', () => {
    const cards = dealCards(seedRng(4), { nodes, abundance: 0, luck: 5, count: 6000 });
    const items = cards.filter((c) => SCAVENGE_CARDS[c.type].itemCard);
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((c) => c.empty)).toBe(false);
  });

  it('the same seed deals the same card, item and Quality', () => {
    const deal = () =>
      dealCard(seedRng(9), { nodes, abundance: 20, luck: 0, count: 1 }, 'foodCard');
    expect(deal()).toEqual(deal());
  });
});
