/**
 * Quality (docs/design/03-items.md): tools, food and clothes have a Quality
 * from 1 to 5; shelters and trinkets have none. A value written (X a/b/c/d/e)
 * is a at Quality 1 up to e at Quality 5, stored as qualityScale([a,b,c,d,e]).
 */
import type { ItemDef, ItemType } from '../effects';

export type Quality = 1 | 2 | 3 | 4 | 5;
export const QUALITIES: readonly Quality[] = [1, 2, 3, 4, 5];

/** A value at each Quality, 1 to 5. */
export type QualityValues = readonly [number, number, number, number, number];

/** (X a/b/c/d/e) from 03-items.md. */
export function qualityScale(values: QualityValues): QualityValues {
  return values;
}

/** A value at a Quality: a fixed number, or the scale's entry (Quality 3 when there's none). */
export function valueAt(
  v: QualityValues | number | undefined,
  quality: Quality | undefined,
): number {
  if (v === undefined) return 0;
  if (typeof v === 'number') return v;
  return v[(quality ?? 3) - 1] ?? 0;
}

/** Item types with a Quality: tools, food and clothes. */
export const HAS_QUALITY: ReadonlySet<ItemType> = new Set(['tool', 'food', 'clothes']);
export const hasQuality = (def: ItemDef) => HAS_QUALITY.has(def.type);
