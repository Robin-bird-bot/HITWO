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
import type { NodeType } from '../types';
import { fullCounters } from './make';
import { hasQuality, QUALITIES, valueAt, type Quality } from './quality';

function fill(text: string, value: (key: string) => number | undefined): string {
  return text.replace(/\{(\w+)(:s)?\}/g, (all, key: string, plural?: string) => {
    const v = value(key);
    if (v === undefined) return all;
    return plural ? (v === 1 ? '' : 's') : String(v);
  });
}

const NODE_NAME: Record<NodeType, string> = {
  forest: 'Forest',
  river: 'River',
  wildlife: 'Wildlife',
  mountain: 'Mountain',
};

/**
 * The effect text as the card shows it, at this Quality. {node} is the node
 * the item was made with (Birkenstocks), or "its node" on a blank card.
 */
export function itemText(def: ItemDef, quality?: Quality, node?: NodeType): string {
  const value = (key: string) =>
    def.values?.[key] !== undefined ? valueAt(def.values[key], quality) : undefined;
  const text = def.text.replace(
    '{node}',
    node ? `a ${NODE_NAME[node]} node` : 'its node (picked when made)',
  );
  // Optional parts: dropped when their value (or any value inside) is 0.
  const kept = text.replace(
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

/** The lowest and highest of a value across Qualities 1–5 (or the given ones). */
export function valueRange(
  v: readonly number[] | number | undefined,
  qualities: readonly Quality[] = QUALITIES,
): { min: number; max: number } {
  const all = qualities.map((q) => valueAt(v as Parameters<typeof valueAt>[0], q));
  return { min: Math.min(...all), max: Math.max(...all) };
}

/** "2–4", or just "3" when every Quality gives the same. */
export const rangeWords = ({ min, max }: { min: number; max: number }) =>
  min === max ? String(min) : `${min}–${max}`;

/**
 * The card text before its Quality is rolled (a blueprint, a Choice pick, an
 * item named in text): each value as its range across Qualities 1–5, from
 * the item's qualityScale values ("Gain 1–3 Abundance."). An optional part
 * that only shows at some Qualities says from which ("(Quality 4+)").
 * Items with no Quality, or a fixed one, read as usual.
 */
export function itemRangeText(def: ItemDef, node?: NodeType): string {
  if (!hasQuality(def) || def.fixedQuality) return itemText(def, def.fixedQuality, node);
  const raw = (key: string) => def.values?.[key];
  const text = def.text.replace(
    '{node}',
    node ? `a ${NODE_NAME[node]} node` : 'its node (picked when made)',
  );
  // Optional parts: kept at the Qualities where none of their values is 0.
  const kept = text.replace(
    /\[(?:(\w+)\?)?([^\]]*)\]/g,
    (_, flag: string | undefined, inner: string) => {
      const keys = [...inner.matchAll(/\{(\w+)(?::s)?\}/g)].map((m) => m[1] ?? '');
      if (flag !== undefined) keys.push(flag);
      const shown = QUALITIES.filter((q) =>
        keys.every((k) => raw(k) === undefined || valueAt(raw(k), q) !== 0),
      );
      if (!shown.length) return '';
      const part = fillRange(inner, raw, shown);
      if (shown.length === QUALITIES.length) return part;
      // Which Qualities, before the part's own full stop.
      const note = ` (${qualityWords(shown)})`;
      return part.endsWith('.') ? `${part.slice(0, -1)}${note}.` : `${part}${note}`;
    },
  );
  const main = fillRange(kept, raw, QUALITIES);
  return def.atQuality1 ? `${main} At Quality 1: ${def.atQuality1}` : main;
}

/** "Quality 4+", "Quality 1", "Quality 2 or less" or "Quality 2–4". */
function qualityWords(shown: readonly Quality[]): string {
  const first = shown[0] ?? 1;
  const last = shown[shown.length - 1] ?? 5;
  if (first === last) return `Quality ${first}`;
  if (last === 5) return `Quality ${first}+`;
  if (first === 1) return `Quality ${last} or less`;
  return `Quality ${first}–${last}`;
}

function fillRange(
  text: string,
  raw: (key: string) => readonly number[] | undefined,
  qualities: readonly Quality[],
): string {
  return text.replace(/\{(\w+)(:s)?\}/g, (all, key: string, plural?: string) => {
    const v = raw(key);
    if (v === undefined) return all;
    const range = valueRange(v, qualities);
    if (plural) return range.min === 1 && range.max === 1 ? '' : 's';
    return rangeWords(range);
  });
}

/**
 * What a full item has before its Quality is rolled: the counter's range
 * across Qualities 1–5 (uses, bites or durability; a shelter's nights).
 */
export function counterRange(def: ItemDef): { min: number; max: number } | undefined {
  if (def.type === 'shelter') return def.nights ? { min: def.nights, max: def.nights } : undefined;
  const qualities = def.fixedQuality ? [def.fixedQuality] : QUALITIES;
  const counts = qualities.map((q) => {
    const full = fullCounters(def, q);
    return full.usesLeft ?? full.bitesLeft ?? full.durability ?? 0;
  });
  const max = Math.max(...counts);
  return max > 0 ? { min: Math.min(...counts), max } : undefined;
}
