/** The party bar's numbers for the top bar and Skill Trails (Phase 10.7). */
import { BALANCE } from '../../config/balance';
import { partyOf, xpForLevel, type GameState } from '../../engine';

/** How far through its level this much XP is (0–1). */
export function levelFill(xp: number, level: number): number {
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  return Math.max(0, Math.min(1, (xp - from) / Math.max(1, to - from)));
}

/** The bar's fill: how far the party is from this level to the next (0–1). */
export function partyProgress(state: GameState): { level: number; points: number; fill: number } {
  const p = partyOf(state);
  return { level: p.level, points: p.points, fill: levelFill(p.xp, p.level) };
}

/** The party bar as the last night camp recap showed it (a new hike: empty, from the first event). */
export function lastRecap(state: GameState): { xp: number; level: number; eventId: number } {
  return partyOf(state).recap ?? { xp: 0, level: 0, eventId: 0 };
}

/**
 * What the Party LV pill and the party frames show (35-ui-overhaul.md,
 * section 7; Claude's idea): the bar as of the last recap, so a level-up is
 * the night's surprise, and the points minus the ones those new levels gave.
 */
export function shownProgress(state: GameState): { level: number; points: number; fill: number } {
  const p = partyOf(state);
  const last = lastRecap(state);
  const level = Math.min(p.level, last.level);
  const newer = (p.level - level) * BALANCE.trails.pointsPerLevel;
  return { level, points: Math.max(0, p.points - newer), fill: levelFill(last.xp, level) };
}

export const pointsWords = (n: number) => `${n} point${n === 1 ? '' : 's'} to spend`;
