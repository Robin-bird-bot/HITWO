/**
 * Line up (docs/design/11-minigames-puzzles.md, "Line up"): before a game with
 * 2 or more hikers, the player sets the order. The front of the line goes
 * first and takes the most risk. Cards can be dragged to a new place, or two
 * tapped to swap them.
 */

/** Line up is skipped with only 1 hiker. */
export const needsLineUp = (hikers: number): boolean => hikers >= 2;

/** A card dragged from one place to another; the others close up around it. */
export function moveTo<T>(order: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= order.length) return [...order];
  const out = [...order];
  const [item] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, item as T);
  return out;
}

/** Two cards tapped: they swap places. */
export function swap<T>(order: readonly T[], i: number, j: number): T[] {
  const out = [...order];
  if (i < 0 || j < 0 || i >= out.length || j >= out.length || i === j) return out;
  [out[i], out[j]] = [out[j] as T, out[i] as T];
  return out;
}

/** Results for the puzzle games: "2 passed, 1 failed", in line order. */
export function passFailResult(
  order: readonly string[],
  passed: (id: string) => boolean,
  energy?: string,
): import('./types').MinigameResult {
  return {
    safe: order.filter(passed),
    hit: order.filter((id) => !passed(id)).map((hikerId) => ({ hikerId, round: 0 })),
    wording: 'passed-failed',
    ...(energy ? { energy } : {}),
  };
}
