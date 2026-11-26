/**
 * The GPS screen's scanlines (docs/design/20-challenge-popup.md, section
 * 2.1): drawn on a canvas at device pixels, so they stay crisp at any
 * scale and zoom (CSS lines scaled with the pop-up blurred into bands).
 *
 * The prototype's screen is 288 px wide with a line every 3 px; here the
 * spacing keeps that look at the screen's real on-screen size: one row of
 * [10%] black, 1 device pixel tall, every round(3 × scale × dpr) device
 * pixels (at least 2), where scale is the on-screen width over 288.
 */
import { BALANCE } from '../../config/balance';

const S = BALANCE.minigames.gps.scanlines;

/** The canvas's size in device pixels, and how far apart its lines are (device pixels). */
export function scanlineLayout(
  onScreenWidth: number,
  onScreenHeight: number,
  dpr: number,
): { width: number; height: number; every: number } {
  const scale = onScreenWidth / S.referenceWidth;
  return {
    width: Math.max(1, Math.round(onScreenWidth * dpr)),
    height: Math.max(1, Math.round(onScreenHeight * dpr)),
    every: Math.max(2, Math.round(S.everyPx * scale * dpr)),
  };
}

/** Draws the lines on a canvas already sized by `scanlineLayout` (one extra period tall, for the drift). */
export function drawScanlines(canvas: HTMLCanvasElement, every: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = `rgba(0, 0, 0, ${S.dark})`;
  for (let y = 0; y < canvas.height; y += every) ctx.fillRect(0, y, canvas.width, 1);
}
