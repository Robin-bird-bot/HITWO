/**
 * Traildle always fits (fixes update, design section 2): nothing draws
 * outside a board or the screen, even with 8 signs, two codes and 9 guesses;
 * when rows would get too small, the board scrolls and the newest guess shows.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../../config/balance';
import { BOARD, bigSigns, boardLayout, followRow } from './layout';

const F = BALANCE.minigames.traildle.fit;

describe('Traildle fits on the screen', () => {
  it('the worst case (8 signs, two codes, 9 guesses): every small sign stays inside its board', () => {
    for (const place of [...BOARD.two, BOARD.one]) {
      for (let signs = 3; signs <= 8; signs++) {
        for (let guesses = 6; guesses <= 9; guesses++) {
          const fit = boardLayout(signs, guesses, place.width);
          const rightEdge = fit.x0 + (signs - 1) * fit.pitchX + fit.cellW;
          expect(fit.x0, `${signs} signs`).toBeGreaterThanOrEqual(BOARD.padX - 0.01);
          expect(rightEdge).toBeLessThanOrEqual(place.width - BOARD.padX + 0.01);
          expect(fit.cellW).toBeLessThanOrEqual(F.maxSign);
          expect(BOARD.header + fit.visibleRows * fit.rowH).toBeLessThanOrEqual(
            BOARD.height - BOARD.padBottom + 0.01,
          );
          expect(fit.rowH).toBeGreaterThanOrEqual(F.minRow);
          expect(fit.rowH).toBeLessThanOrEqual(F.maxRow);
        }
      }
    }
    // The boards themselves fit the screen.
    for (const place of [...BOARD.two, BOARD.one]) {
      expect(place.left).toBeGreaterThanOrEqual(0);
      expect(place.left + place.width).toBeLessThanOrEqual(320);
    }
  });

  it('when rows would be shorter than 9 units, they stay at 9 and the board scrolls, following the newest guess', () => {
    const fit = boardLayout(8, 14, BOARD.two[0]!.width);
    expect(fit.scroll).toBe(true);
    expect(fit.rowH).toBe(F.minRow);
    expect(fit.visibleRows).toBeLessThan(14);
    // After 12 guesses the newest (row 12) and the empty row below (13) are in view.
    const first = followRow(12, 14, fit.visibleRows);
    expect(first).toBeLessThanOrEqual(11);
    expect(first + fit.visibleRows).toBeGreaterThanOrEqual(13);
    expect(followRow(0, 14, fit.visibleRows)).toBe(0);
    // With 9 guesses the rows simply fit.
    expect(boardLayout(8, 9, 148).scroll).toBe(false);
  });

  it('the big signs shrink for 7 or 8, so they fit across with their arrows', () => {
    for (let signs = 3; signs <= 8; signs++) {
      const big = bigSigns(signs);
      expect(big.left).toBeGreaterThanOrEqual(0);
      expect(big.left + (signs - 1) * big.pitch + big.w).toBeLessThanOrEqual(320);
      expect(big.scale).toBe(signs >= 7 ? F.bigSignScale : 1);
    }
  });
});
