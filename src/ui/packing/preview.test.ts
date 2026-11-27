/**
 * The packing screen's card preview (27-packing-screen.md, sections 3 and 7):
 * every item a reel can land on has a card, the game's own ItemCard unrolled,
 * whose text and counter match itemRangeText and counterRange.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../content/items';
import { counterRange, itemRangeText, rangeWords } from '../../engine';
import { PACK_TYPES, itemPool } from '../../packing/logic';
import { ItemCard } from '../items/ItemCard';

describe('the card preview', () => {
  const escape = (t: string) =>
    t
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');

  it('every item that can land has a card, unrolled to ranges', () => {
    for (const t of PACK_TYPES) {
      for (const tier of [1, 2] as const) {
        for (const id of itemPool(t, tier)) {
          const def = ITEMS[id];
          expect(def?.art, id).toBeTruthy();
          if (!def) continue;
          const html = renderToStaticMarkup(
            createElement(ItemCard, { itemId: id, width: 230, unrolled: true }),
          );
          expect(html, id).toContain(escape(itemRangeText(def)));
          const range = counterRange(def);
          if (range) expect(html, id).toContain(rangeWords(range));
        }
      }
    }
  });
});
