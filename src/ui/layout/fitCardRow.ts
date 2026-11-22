/**
 * Nothing cut off at the edges (Phase 10.6, part B): a row of cards that
 * doesn't fit shrinks every card evenly, down to `minScale`, then wraps onto
 * more rows (as few as fit at `minScale` or bigger). Never clips.
 */
import { BALANCE } from '../../config/balance';

export interface CardRowFit {
  /** Each card's scale (1 is its normal size). */
  scale: number;
  /** Cards in each row (the last row may have fewer). */
  perRow: number;
  rows: number;
}

/**
 * How `count` cards of `cardW` (at their normal size) with `gap` between them
 * fit in `maxW`.
 */
export function fitCardRow(
  count: number,
  cardW: number,
  gap: number,
  maxW: number,
  minScale: number = BALANCE.ui.cardRowMinScale,
): CardRowFit {
  if (count <= 0) return { scale: 1, perRow: 0, rows: 0 };
  const scaleFor = (perRow: number) => (maxW - (perRow - 1) * gap) / (perRow * cardW);
  for (let rows = 1; rows <= count; rows++) {
    const perRow = Math.ceil(count / rows);
    const s = scaleFor(perRow);
    if (s >= minScale || perRow === 1) {
      return { scale: Math.min(1, Math.max(0, s)), perRow, rows: Math.ceil(count / perRow) };
    }
  }
  return { scale: Math.min(1, scaleFor(1)), perRow: 1, rows: count };
}

/** The width a fitted row takes. */
export const rowWidth = (fit: CardRowFit, cardW: number, gap: number): number =>
  fit.perRow * cardW * fit.scale + Math.max(0, fit.perRow - 1) * gap;
