/**
 * Fitting Traildle on the screen (docs/design/11-minigames-puzzles.md,
 * section 2, "Fitting everything on screen"), in scene units (320 × 240).
 * Nothing may draw outside its board or the screen: the small signs and the
 * rows take their size from each board's space, the board scrolls if rows
 * would get too small, and the big signs shrink so 7 or 8 fit across.
 */
import { BALANCE } from '../../../config/balance';

const F = BALANCE.minigames.traildle.fit;

/** The boards: two side by side, or one using the full width. */
export const BOARD = {
  top: 24,
  height: 110,
  two: [
    { left: 8, width: 148 },
    { left: 164, width: 148 },
  ],
  one: { left: 8, width: 304 },
  /** The hiker's name at the top, the sides, the space under the last row, the gaps. */
  header: 16,
  padX: 6,
  padBottom: 3,
  gapX: 2,
  gapY: 1,
} as const;

export interface BoardLayout {
  /** A small sign's size, and the step from one to the next. */
  cellW: number;
  cellH: number;
  pitchX: number;
  rowH: number;
  /** Where the first sign starts, so the row is centered. */
  x0: number;
  /** The rows don't all fit: the board scrolls, showing this many. */
  scroll: boolean;
  visibleRows: number;
}

/** The small signs and rows for a board this big. */
export function boardLayout(
  signs: number,
  guesses: number,
  width: number,
  height: number = BOARD.height,
): BoardLayout {
  const cellW = Math.min(F.maxSign, (width - 2 * BOARD.padX - (signs - 1) * BOARD.gapX) / signs);
  const space = height - BOARD.header - BOARD.padBottom;
  const fit = space / guesses;
  const scroll = fit < F.minRow;
  const rowH = scroll ? F.minRow : Math.min(F.maxRow, fit);
  const pitchX = cellW + BOARD.gapX;
  return {
    cellW,
    cellH: rowH - BOARD.gapY,
    pitchX,
    rowH,
    x0: (width - (signs * pitchX - BOARD.gapX)) / 2,
    scroll,
    visibleRows: scroll ? Math.floor(space / rowH) : guesses,
  };
}

/**
 * The first row a scrolling board shows: far enough down that the newest
 * guess and the empty row below it are in view.
 */
export function followRow(used: number, total: number, visible: number): number {
  return Math.max(0, Math.min(total - visible, used + 1 - visible));
}

/** The big signs of the guess: their size, step and where the first one starts. */
export function bigSigns(signs: number): {
  scale: number;
  w: number;
  h: number;
  pitch: number;
  left: number;
} {
  const scale = signs >= F.bigSignsFrom ? F.bigSignScale : 1;
  const w = 24 * scale;
  const pitch = 28 * scale;
  return { scale, w, h: 20 * scale, pitch, left: (320 - (signs * pitch - (pitch - w))) / 2 };
}
