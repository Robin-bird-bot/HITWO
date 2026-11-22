/**
 * Nothing cut off at the edges (Phase 10.6, part B): where a tooltip or hover
 * window goes. It tries the side it prefers, then the opposite side, then the
 * other two, and finally nudges itself inside the game screen, keeping
 * `margin` from every edge. Stage pixels.
 */
import { BALANCE } from '../../config/balance';

export type Side = 'right' | 'left' | 'below' | 'above';

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const OPPOSITE: Record<Side, Side> = {
  right: 'left',
  left: 'right',
  below: 'above',
  above: 'below',
};
const OTHERS: Record<Side, Side[]> = {
  right: ['below', 'above'],
  left: ['below', 'above'],
  below: ['right', 'left'],
  above: ['right', 'left'],
};

export function placePopup(
  anchor: Rect,
  size: { w: number; h: number },
  screen: { w: number; h: number },
  prefer: Side = 'right',
  gap = 12,
  margin: number = BALANCE.ui.popupMargin,
): { left: number; top: number; side: Side } {
  const cx = (anchor.left + anchor.right) / 2;
  const cy = (anchor.top + anchor.bottom) / 2;
  const at = (side: Side) => {
    switch (side) {
      case 'right':
        return { left: anchor.right + gap, top: cy - size.h / 2 };
      case 'left':
        return { left: anchor.left - gap - size.w, top: cy - size.h / 2 };
      case 'below':
        return { left: cx - size.w / 2, top: anchor.bottom + gap };
      case 'above':
        return { left: cx - size.w / 2, top: anchor.top - gap - size.h };
    }
  };
  // Room on that side, ignoring the other axis (that one gets nudged).
  const roomOn = (side: Side) => {
    const p = at(side);
    return side === 'right' || side === 'left'
      ? p.left >= margin && p.left + size.w <= screen.w - margin
      : p.top >= margin && p.top + size.h <= screen.h - margin;
  };
  const order: Side[] = [prefer, OPPOSITE[prefer], ...OTHERS[prefer]];
  const side = order.find(roomOn) ?? prefer;
  const p = at(side);
  const nudge = (v: number, len: number, max: number) =>
    Math.min(Math.max(v, margin), Math.max(margin, max - margin - len));
  return { left: nudge(p.left, size.w, screen.w), top: nudge(p.top, size.h, screen.h), side };
}

/** Whether a box lies fully inside the screen with the margin (the edge test). */
export const fitsScreen = (r: Rect, screen: { w: number; h: number }, margin = 0): boolean =>
  r.left >= margin - 0.5 &&
  r.top >= margin - 0.5 &&
  r.right <= screen.w - margin + 0.5 &&
  r.bottom <= screen.h - margin + 0.5;
