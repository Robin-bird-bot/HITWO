/** The party bar's numbers for the top bar and Skill Trails (Phase 10.7). */
import { partyOf, xpForLevel, type GameState } from '../../engine';

/** The bar's fill: how far the party is from this level to the next (0–1). */
export function partyProgress(state: GameState): { level: number; points: number; fill: number } {
  const p = partyOf(state);
  const from = xpForLevel(p.level);
  const to = xpForLevel(p.level + 1);
  return {
    level: p.level,
    points: p.points,
    fill: Math.min(1, (p.xp - from) / Math.max(1, to - from)),
  };
}

export const pointsWords = (n: number) => `${n} point${n === 1 ? '' : 's'} to spend`;
