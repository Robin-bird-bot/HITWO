import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../content/items';
import { fullCounters } from './make';
import { hasQuality, QUALITIES, valueAt } from './quality';
import { counterRange, itemRangeText, rangeWords, valueRange } from './text';

const defs = Object.values(ITEMS);
const ranged = defs.filter((d) => hasQuality(d) && !d.fixedQuality);

describe('card previews before Quality is rolled (Nov 14 update)', () => {
  it('every value outside an optional part reads as its range across Qualities 1–5', () => {
    let checked = 0;
    for (const def of ranged) {
      const outside = def.text.replace(/\[[^\]]*\]/g, '');
      for (const [key, values] of Object.entries(def.values ?? {})) {
        if (!new RegExp(`\\{${key}\\}`).test(outside)) continue;
        const all = QUALITIES.map((q) => valueAt(values, q));
        const expected = rangeWords({ min: Math.min(...all), max: Math.max(...all) });
        expect(itemRangeText(def), `${def.id}.${key}`).toContain(expected);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(40);
  });

  it('never leaves a {placeholder} or a bracket behind', () => {
    for (const def of defs) {
      expect(itemRangeText(def), def.id).not.toMatch(/[{}[\]]/);
    }
  });

  it('the counter’s range is the full counts at Qualities 1–5', () => {
    for (const def of ranged) {
      const counts = QUALITIES.map((q) => {
        const f = fullCounters(def, q);
        return f.usesLeft ?? f.bitesLeft ?? f.durability ?? 0;
      });
      const max = Math.max(...counts);
      expect(counterRange(def), def.id).toEqual(
        max > 0 ? { min: Math.min(...counts), max } : undefined,
      );
    }
  });

  it.each([
    ['fertilizer', 'Gain 1–3 Abundance.'],
    ['industrialFertilizer', 'Gain 3–6 Abundance.'],
    ['stuffedAnimal', '+1–3 Morale.'],
    ['popcorn', '+1 Appetite, +1–2 Morale (Quality 2+).'],
    [
      'stinkyFeetPopcorn',
      '+1 Appetite, +2–3 Morale (Quality 2+). A 25% chance of Nauseous (Quality 1).',
    ],
  ])('%s reads “%s”', (id, text) => {
    const def = ITEMS[id];
    if (!def) throw new Error(`no ${id}`);
    expect(itemRangeText(def)).toBe(text);
  });

  it('a fixed Quality, or none, reads as the card always does', () => {
    const nuggets = ITEMS.pukedNuggets;
    expect(nuggets && itemRangeText(nuggets)).toBe('+1 Appetite.');
    const tent = ITEMS.tent;
    expect(tent && hasQuality(tent)).toBe(false);
    expect(tent && counterRange(tent)).toEqual({ min: tent?.deployments, max: tent?.deployments });
  });

  it('valueRange and rangeWords', () => {
    expect(valueRange([1, 2, 2, 2, 3])).toEqual({ min: 1, max: 3 });
    expect(valueRange(4)).toEqual({ min: 4, max: 4 });
    expect(rangeWords({ min: 2, max: 2 })).toBe('2');
    expect(rangeWords({ min: 2, max: 4 })).toBe('2–4');
  });
});
