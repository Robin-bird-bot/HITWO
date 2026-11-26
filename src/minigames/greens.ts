/**
 * The GPS screen's ten LCD greens (docs/design/10-minigames.md, "Art: the GPS
 * greens"): G0 is the darkest and G9 the
 * lightest; G8 is the screen's background. Every minigame is drawn in them.
 * Only the hikers keep their own colors, and red is for mistakes and hits.
 */
import { LCD_GREENS, MISTAKE_RED } from './palette';

export const GREENS: readonly string[] = LCD_GREENS;

/** One of the greens, G0 (darkest) to G9 (lightest). */
export const g = (i: number): string => GREENS[Math.max(0, Math.min(9, i))] ?? '#BAC995';

/** The screen's background. */
export const SCREEN_GREEN = g(8);

/** Mistakes and hits only. */
export const RED: string = MISTAKE_RED;
