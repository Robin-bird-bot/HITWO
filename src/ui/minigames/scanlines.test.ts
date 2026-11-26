/**
 * The GPS scanlines (docs/design/20-challenge-popup.md, sections 2.1 and
 * 8): after a resize or a zoom, the canvas matches the screen's device
 * pixels, and the lines keep the prototype's spacing at any scale (never
 * closer than 2 device pixels).
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { scanlineLayout } from './scanlines';

const S = BALANCE.minigames.gps.scanlines;

describe('scanlines', () => {
  it.each([
    [288, 480, 1],
    [288, 480, 2],
    [144, 240, 1],
    [432, 720, 1.5],
    [200, 333.3, 3],
  ])('a %f × %f screen at %f dpr: the canvas is the screen in device pixels', (w, h, dpr) => {
    const out = scanlineLayout(w, h, dpr);
    expect(out.width).toBe(Math.round(w * dpr));
    expect(out.height).toBe(Math.round(h * dpr));
    expect(out.every).toBe(Math.max(2, Math.round(S.everyPx * (w / S.referenceWidth) * dpr)));
  });

  it('the prototype’s size reads as the prototype (a line every 3 px); small screens never go under 2', () => {
    expect(scanlineLayout(S.referenceWidth, 480, 1).every).toBe(S.everyPx);
    expect(scanlineLayout(S.referenceWidth, 480, 2).every).toBe(S.everyPx * 2);
    expect(scanlineLayout(60, 100, 1).every).toBe(2);
  });

  it('zooming in (a higher dpr) keeps the lines the same size on screen', () => {
    const a = scanlineLayout(288, 480, 1);
    const b = scanlineLayout(288, 480, 2);
    expect(b.every / 2).toBe(a.every);
    expect(b.width / 2).toBe(a.width);
  });
});
