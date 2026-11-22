/**
 * Nothing cut off at the edges (Phase 10.6, part B): card rows shrink, then
 * wrap; tooltips flip, then nudge inside the screen.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../stage/fitStage';
import { fitCardRow, rowWidth } from './fitCardRow';
import { fitsScreen, placePopup, type Side } from './placePopup';

const SCREEN = { w: STAGE_WIDTH, h: STAGE_HEIGHT };

describe('card rows', () => {
  it('fit as they are when there’s room', () => {
    expect(fitCardRow(3, 216, 18, 916)).toEqual({ scale: 1, perRow: 3, rows: 1 });
  });

  it('shrink evenly, but never below 80%', () => {
    const fit = fitCardRow(4, 216, 18, 916);
    expect(fit.rows).toBe(1);
    expect(fit.scale).toBeLessThan(1);
    expect(fit.scale).toBeGreaterThanOrEqual(BALANCE.ui.cardRowMinScale);
  });

  it('then wrap onto a second row', () => {
    const fit = fitCardRow(5, 216, 18, 916);
    expect(fit.rows).toBe(2);
    expect(fit.perRow).toBe(3);
  });

  it('never go wider than the window, for any count up to 16', () => {
    for (const maxW of [400, 616, 916, 1200]) {
      for (let n = 1; n <= 16; n++) {
        const fit = fitCardRow(n, 216, 18, maxW);
        expect(rowWidth(fit, 216, 18), `${n} cards in ${maxW}`).toBeLessThanOrEqual(maxW + 1e-6);
        expect(fit.perRow * fit.rows).toBeGreaterThanOrEqual(n);
      }
    }
  });
});

describe('tooltips and hover windows', () => {
  const size = { w: 300, h: 190 };
  const anchors = [
    { left: 4, top: 4, right: 40, bottom: 40 },
    { left: SCREEN.w - 40, top: 4, right: SCREEN.w - 4, bottom: 40 },
    { left: 4, top: SCREEN.h - 40, right: 40, bottom: SCREEN.h - 4 },
    { left: SCREEN.w - 40, top: SCREEN.h - 40, right: SCREEN.w - 4, bottom: SCREEN.h - 4 },
    { left: 780, top: 480, right: 820, bottom: 520 },
  ];

  it('always land inside the game screen, 8 px from every edge', () => {
    for (const a of anchors) {
      for (const prefer of ['right', 'left', 'below', 'above'] as Side[]) {
        const p = placePopup(a, size, SCREEN, prefer);
        const r = { left: p.left, top: p.top, right: p.left + size.w, bottom: p.top + size.h };
        expect(
          fitsScreen(r, SCREEN, BALANCE.ui.popupMargin),
          `${prefer} of ${JSON.stringify(a)}`,
        ).toBe(true);
      }
    }
  });

  it('flip to the other side when the side they prefer has no room', () => {
    const nearRight = anchors[1]!;
    expect(placePopup(nearRight, size, SCREEN, 'right').side).toBe('left');
    const nearBottom = anchors[2]!;
    expect(placePopup(nearBottom, size, SCREEN, 'below').side).toBe('above');
    expect(placePopup(anchors[4]!, size, SCREEN, 'right').side).toBe('right');
  });
});
