/**
 * How a minigame's result reads (docs/design/10-minigames.md and
 * 11-minigames-puzzles.md, "Results"): "1 safe, 2 hit" for Bearrels, "2
 * passed, 1 failed" for the puzzle games, and each hiker's line.
 */
import type { MinigameResult } from './types';

/** "1 safe, 2 hit" or "2 passed, 1 failed". */
export function resultLine(r: MinigameResult): string {
  return r.wording === 'passed-failed'
    ? `${r.safe.length} passed, ${r.hit.length} failed`
    : `${r.safe.length} safe, ${r.hit.length} hit`;
}

/** One hiker's line: "Safe", "Hit in round 2", "Passed" or "Failed"; whether it's bad news. */
export function hikerStatus(r: MinigameResult, hikerId: string): { text: string; bad: boolean } {
  const hit = r.hit.find((h) => h.hikerId === hikerId);
  if (r.wording === 'passed-failed') {
    const n = r.hits?.[hikerId];
    const hits = n === undefined ? '' : ` · ${n} hit${n === 1 ? '' : 's'}`;
    return { text: (hit ? 'Failed' : 'Passed') + hits, bad: !!hit };
  }
  return { text: hit ? `Hit in round ${hit.round}` : 'Safe', bad: !!hit };
}
