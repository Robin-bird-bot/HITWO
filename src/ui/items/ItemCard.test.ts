/**
 * The TrailMate item cards (docs/design/31-trailmate-item-cards.md, section 8):
 * the LEDs (as many as the full counter, lit for what's left; unrolled, lit
 * for the least and rings up to the most), each type's words (drinks say
 * DRINK and SIPS, shelters NO QUALITY), every item's text fitting its card,
 * and every item's art (or a fallback icon). And the walkie-talkie back.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../content';
import { counterRange, fullCounters, itemRangeText, itemText, QUALITIES } from '../../engine';
import { ItemBack } from '../scavenge/ItemBack';
import { counterOf, type Counters } from './cardCounter';
import { CARD, cardFit, fits } from './cardFit';
import { ItemCard } from './ItemCard';
import { deviceLook } from './itemLook';

const card = (
  itemId: string,
  props: { item?: Counters; unrolled?: boolean; width?: number } = {},
) => renderToStaticMarkup(createElement(ItemCard, { itemId, width: 220, ...props }));

/** The LEDs' row: how many, how many lit, how many rings. */
function leds(html: string) {
  const at = html.search(/<span class="[^"]*_leds_/);
  if (at < 0) return { all: 0, on: 0, may: 0 };
  const row = html.slice(at, html.indexOf('</span>', at));
  return {
    all: (row.match(/<i /g) ?? []).length,
    on: (row.match(/data-on="true"/g) ?? []).length,
    may: (row.match(/data-may="true"/g) ?? []).length,
  };
}

const ALL = Object.values(ITEMS);

/** File names in a folder, from Vite's glob (keys only: nothing is loaded). */
const fileNames = (glob: Record<string, unknown>) =>
  Object.keys(glob).map((path) => path.slice(path.lastIndexOf('/') + 1));
const ITEM_ART = fileNames(import.meta.glob('/public/assets/items/*.png'));
const CARD_ICONS = fileNames(import.meta.glob('/public/assets/item-cards/**/*.{png,svg}'));

describe('the LEDs: what’s left', () => {
  it('one per point of the full counter, lit for what’s left (uses, bites, durability, set-ups)', () => {
    expect(leds(card('scanner', { item: { quality: 3, usesLeft: 2 } }))).toEqual({
      all: fullCounters(ITEMS.scanner!, 3).usesLeft,
      on: 2,
      may: 0,
    });
    const tent = ITEMS.tent!;
    expect(leds(card('tent', { item: { deploymentsLeft: 1 } }))).toMatchObject({
      all: tent.deployments,
      on: 1,
    });
    for (const def of ALL) {
      const { left, max } = counterOf(def.id, undefined, 3);
      const got = leds(card(def.id, { item: { quality: 3 } }));
      expect(got.all, def.id).toBe(def.type === 'present' ? 0 : max);
      expect(got.on, def.id).toBe(def.type === 'present' ? 0 : left);
    }
  });

  it('unrolled: lit for the least, rings up to the most', () => {
    for (const def of ALL) {
      const range = counterRange(def);
      if (!range || def.fixedQuality) continue;
      const got = leds(card(def.id, { unrolled: true }));
      expect(got, def.id).toEqual({ all: range.max, on: range.min, may: range.max - range.min });
    }
  });

  it('no counter, no LEDs (some trinkets)', () => {
    const none = ALL.find((d) => d.type === 'trinket' && !counterRange(d));
    if (none) expect(leds(card(none.id)).all).toBe(0);
  });

  it('the most fits the big card and the bag (12: Tier III clothes; 31 says 9)', () => {
    const most = Math.max(...ALL.map((d) => counterRange(d)?.max ?? 0));
    expect(most).toBe(12);
    // Twelve 8 px LEDs 4 px apart fit under the 200 px face.
    expect(most * 8 + (most - 1) * 4).toBeLessThan(200);
    // In the bag (46 px slots, from a 48 px design): 2.5 px, 1 px apart, past 9.
    expect(((most * 2.5 + (most - 1) * 1) * 46) / 48).toBeLessThan(46 - 4);
  });
});

describe('the words', () => {
  it('each type shows its counter word and its name in the strip', () => {
    const words: [string, string, string][] = [
      ['scanner', 'TOOL', 'USES'],
      ['trailMix', 'FOOD', 'BITES'],
      ['rainJacket', 'CLOTHES', 'DURABILITY'],
      ['tent', 'SHELTER', 'SET UPS'],
      ['coffee', 'DRINK', 'SIPS'],
    ];
    for (const [id, label, count] of words) {
      const html = card(id, { item: { quality: 3 } });
      expect(html, id).toContain(`>${label}`);
      expect(html, id).toContain(`${count}<br/>`);
    }
    expect(card('rainJacket')).toContain('· BODY');
  });

  it('drinks look like drinks; shelters say NO QUALITY; unrolled says QUALITY ?', () => {
    expect(deviceLook(ITEMS.coffee!)).toMatchObject({
      kind: 'drink',
      label: 'Drink',
      count: 'SIPS',
    });
    expect(card('coffee')).toContain('--l:#8BE6DD');
    expect(card('tent')).toContain('NO QUALITY');
    expect(card('scanner', { unrolled: true })).toContain('QUALITY ?');
  });

  it('a tier chip from Tier II (silver), III and IV', () => {
    const two = ALL.find((d) => d.tier === 2 && d.type !== 'present')!;
    expect(card(two.id)).toContain('data-tier="2"');
    expect(card(two.id)).toContain('>II</span>');
    const one = ALL.find((d) => d.tier === 1 && d.type !== 'present')!;
    expect(card(one.id)).not.toContain('data-tier');
  });
});

describe('fit', () => {
  it('every item’s text fits its card, at every Quality and unrolled, at 10 px or more', () => {
    for (const def of ALL) {
      for (const text of [...QUALITIES.map((q) => itemText(def, q)), itemRangeText(def)]) {
        const f = cardFit(def.name, text);
        expect(f.textSize, def.id).toBeGreaterThanOrEqual(CARD.text.min);
        expect(f.art, def.id).toBeGreaterThanOrEqual(CARD.artMin);
        expect(fits(f), `${def.id}: ${text}`).toBe(true);
      }
    }
  });

  it('short text keeps the full size and the full art; long text shrinks first, then the art', () => {
    expect(cardFit('Tent', 'A basic shelter.')).toMatchObject({ textSize: 12.5, art: CARD.art });
    const mid = cardFit('Scanner', 'x'.repeat(80));
    expect(mid.textSize).toBeLessThan(12.5);
    expect(mid.art).toBe(CARD.art);
    expect(cardFit('Costco Sample', 'x'.repeat(170)).art).toBeLessThan(CARD.art);
  });

  it('long names shrink to their line', () => {
    expect(cardFit('Tent', '').nameSize).toBe(15);
    expect(cardFit('A Very Long Item Name Here', '').nameSize).toBeLessThan(15);
  });
});

describe('art', () => {
  it('every item has its art (turned green on the card), or the type’s icon instead', () => {
    for (const def of ALL) {
      const look = deviceLook(def);
      if (def.art && def.type !== 'present') {
        expect(ITEM_ART, def.id).toContain(`${def.art}.png`);
      } else if (def.type !== 'present') {
        expect(look.icon, def.id).toBeTruthy();
      }
    }
    // Until the green art is made (and in tests), the type's icon stands in.
    expect(card('scanner')).toContain('_fallback_');
  });

  it('the type icons and the drink’s cup are there', () => {
    for (const type of ['tool', 'food', 'clothes', 'shelter', 'trinket'] as const) {
      expect(CARD_ICONS, type).toContain(`${type}.png`);
    }
    expect(CARD_ICONS).toContain('drink-cup.svg');
  });
});

describe('the back: a walkie-talkie', () => {
  it('the type’s colors, the embossed logo, TRAILMATE and the type, the grille; no sticker', () => {
    const html = renderToStaticMarkup(createElement(ItemBack, { type: 'food', width: 220 }));
    expect(html).toContain('--l:#86D594');
    expect(html).toContain('TRAILMATE');
    expect(html).toContain('FOOD · SUPPLY');
    expect((html.match(/_screw_/g) ?? []).length).toBe(4);
    expect((html.match(/_grip_/g) ?? []).length).toBe(2);
    expect(html).toContain('type-icons/food.png');
  });
});
