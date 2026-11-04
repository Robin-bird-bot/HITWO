/**
 * The game is laid out on a fixed 1600×1000 logical stage, the same size as
 * the mockups, and scaled to fit the window with letterboxing (CLAUDE.md rule 8).
 */
export const STAGE_WIDTH = 1600;
export const STAGE_HEIGHT = 1000;

export interface StageFit {
  /** Screen pixels per stage pixel. */
  scale: number;
  /** Left letterbox, in screen pixels. */
  left: number;
  /** Top letterbox, in screen pixels. */
  top: number;
}

/** Largest scale at which the whole stage fits the viewport, centered. */
export function fitStage(viewWidth: number, viewHeight: number): StageFit {
  if (!(viewWidth > 0) || !(viewHeight > 0)) return { scale: 1, left: 0, top: 0 };
  const scale = Math.min(viewWidth / STAGE_WIDTH, viewHeight / STAGE_HEIGHT);
  return {
    scale,
    left: Math.round((viewWidth - STAGE_WIDTH * scale) / 2),
    top: Math.round((viewHeight - STAGE_HEIGHT * scale) / 2),
  };
}
