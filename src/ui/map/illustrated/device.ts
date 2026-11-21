/**
 * Phones get a lighter illustrated map (Phase 10.5, section 8): canvases at 1
 * pixel per stage pixel, and a coarser field grid.
 */
import { cellFor } from '../../../config/mapStyle';

export function isPhone(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return coarse && Math.min(window.screen.width, window.screen.height) <= 600;
}

/** Canvas pixels per world pixel: min(devicePixelRatio, 2), and 1 on phones. */
export const landScale = (): number =>
  isPhone()
    ? 1
    : Math.min(2, Math.max(1, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));

/** Prototype units per field cell for this device. */
export const landCellUnits = (): number => cellFor(isPhone());
