/**
 * An item's card text at its Quality. The template from the content:
 * - {key} is the item's value at this Quality ("Carry {n} more items.");
 * - {key:s} is "s" unless the value is 1 ("{days} day{days:s}");
 * - [ ... ] drops out when a value inside it is 0 at this Quality
 *   ("+1 Appetite[, +{morale} Morale].");
 * - [key? ... ] drops out when that value is 0, without showing it
 *   ("+1 Appetite[lucky? and Lucky for this phase].");
 * - at Quality 1, food adds its downside (atQuality1).
 */
import type { ItemDef } from '../effects';
import { valueAt, type Quality } from './quality';

function fill(text: string, value: (key: string) => number | undefined): string {
  return text.replace(/\{(\w+)(:s)?\}/g, (all, key: string, plural?: string) => {
    const v = value(key);
    if (v === undefined) return all;
    return plural ? (v === 1 ? '' : 's') : String(v);
  });
}

/** The effect text as the card shows it, at this Quality. */
export function itemText(def: ItemDef, quality?: Quality): string {
  const value = (key: string) =>
    def.values?.[key] !== undefined ? valueAt(def.values[key], quality) : undefined;
  // Optional parts: dropped when their value (or any value inside) is 0.
  const kept = def.text.replace(
    /\[(?:(\w+)\?)?([^\]]*)\]/g,
    (_, flag: string | undefined, inner: string) => {
      const keys = [...inner.matchAll(/\{(\w+)(?::s)?\}/g)].map((m) => m[1] ?? '');
      if (flag !== undefined) keys.push(flag);
      return keys.some((k) => value(k) === 0) ? '' : inner;
    },
  );
  const main = fill(kept, value);
  return quality === 1 && def.atQuality1 ? `${main} At Quality 1: ${def.atQuality1}` : main;
}
