/**
 * The GPS game screen every minigame draws on (docs/design/10-minigames.md,
 * "Art: the GPS greens"): a 1280 × 960 (4:3) screen showing a 320 × 240
 * scene. Pixel art is drawn at the largest whole-number scale that fits,
 * letterboxed. (These lived with Bearrels until it was removed, Nov 26.)
 */

/** Every minigame is laid out at 1280 × 960 (4:3), the turned GPS's screen. */
export const GAME = { width: 1280, height: 960 } as const;

/** The scene, in scene units. */
export const SCENE = { width: 320, height: 240 } as const;

/** Where the scene sits on the game screen: a scene unit (sx, sy) is drawn at (x + sx × unit, y + sy × unit). */
export interface Frame {
  x: number;
  y: number;
  unit: number;
}

/** The scene filling the whole screen (before the screen is measured). */
export const FILL: Frame = { x: 0, y: 0, unit: GAME.width / SCENE.width };

/**
 * The largest whole-number scale that fits, letterboxed: `shownWidth` is how
 * wide the game screen is drawn, in device pixels.
 */
export function pixelFrame(shownWidth: number): Frame {
  const k = Math.floor(Math.min(shownWidth / SCENE.width, (shownWidth * 0.75) / SCENE.height));
  if (!Number.isFinite(k) || k < 1) return FILL;
  const unit = (k * GAME.width) / shownWidth;
  return {
    x: (GAME.width - SCENE.width * unit) / 2,
    y: (GAME.height - SCENE.height * unit) / 2,
    unit,
  };
}
