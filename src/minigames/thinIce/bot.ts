/**
 * Thin Ice's demo bot (docs/design/23-minigames-final.md, section 7): it
 * stands where the shore number is lowest, steps to a square it knows is
 * safe (toward the far shore), uses a pick when no square next to it is
 * known to be safe, and guesses when stuck. It acts every half second or so.
 */
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { around, canPick, canStep, count, posOf, shoreCount, type ThinIceState } from './logic';
import { playing } from '../quick/turns';

export type ThinIceAction =
  | { kind: 'stand'; col: number }
  | { kind: 'step'; cell: number }
  | { kind: 'pick'; cell: number }
  | { kind: 'cross' };

/** Whether the bot knows a square is safe: its number shows, or a number next to it says so. */
function knownSafe(s: ThinIceState, cell: number): boolean {
  if (s.seen[cell]) return !s.holes[cell];
  const { col, row } = posOf(s, cell);
  // On the first ice row, a shore 0 below it clears it.
  if (row === s.rows - 1 && s.at?.row === s.rows && shoreCount(s, s.at.col) === 0) return true;
  return around(s, cell).some((n) => {
    if (!s.seen[n] || s.holes[n]) return false;
    const known = around(s, n).filter((m) => s.seen[m] && s.holes[m]).length;
    return count(s, n) === known && col >= 0;
  });
}

export function thinIceBot(
  s: ThinIceState,
  mem: Record<string, unknown>,
  rng: RngState,
  time: number,
): ThinIceAction | null {
  if (s.over || !playing(s.turns)) return null;
  if (time < ((mem.next as number | undefined) ?? 0)) return null;
  mem.next = time + 0.45 + nextFloat(rng) * 0.3;
  if (!s.at) {
    // The shore square with the lowest number whose first steps aren't all cracked.
    const cols = Array.from({ length: s.cols }, (_, c) => c).filter((c) =>
      [c - 1, c, c + 1].some((x) => x >= 0 && x < s.cols && !s.cracked[(s.rows - 1) * s.cols + x]),
    );
    const low = Math.min(...cols.map((c) => shoreCount(s, c)));
    const best = cols.filter((c) => shoreCount(s, c) === low);
    return { kind: 'stand', col: best[Math.floor(nextFloat(rng) * best.length)] ?? 0 };
  }
  const at = s.at;
  if (at.row === 0) return { kind: 'cross' };
  const steps = s.holes.map((_, c) => c).filter((c) => canStep(s, c));
  // Known-safe steps, the ones nearest the far shore first (and not back onto its own path).
  const safe = steps
    .filter((c) => knownSafe(s, c) && !s.walked[c])
    .sort((a, b) => posOf(s, a).row - posOf(s, b).row);
  const forward = safe.filter((c) => posOf(s, c).row < at.row);
  if (forward.length) return { kind: 'step', cell: forward[0]! };
  // Nothing safe ahead: test a square 2 away, ahead if it can.
  const picks = s.holes
    .map((_, c) => c)
    .filter((c) => canPick(s, c))
    .sort((a, b) => posOf(s, a).row - posOf(s, b).row);
  if (picks.length && s.picksLeft > 0) return { kind: 'pick', cell: picks[0]! };
  if (safe.length) return { kind: 'step', cell: safe[0]! };
  // Stuck: guess, ahead if it can.
  const ahead = steps.filter((c) => !s.walked[c] && posOf(s, c).row < at.row);
  const pool = ahead.length ? ahead : steps.filter((c) => !s.walked[c]);
  if (!pool.length) return null;
  return { kind: 'step', cell: pool[Math.floor(nextFloat(rng) * pool.length)]! };
}
