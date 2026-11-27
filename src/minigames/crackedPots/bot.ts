/**
 * Cracked Pots' demo bot (24-challenges-reset.md, section 7): every so often
 * it picks up the shard that fits the most open edge (next to shards
 * already in, or on the pot's rim) and drops it in its spot. Now and then
 * it tries the wrong spot first, and the shard goes back to the blanket.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import type { CrackedPotsState, Point } from './logic';

const C = BALANCE.minigames.crackedPots;

export interface CrackedDrop {
  id: number;
  at: Point;
}

export function crackedPotsBot(
  s: CrackedPotsState,
  mem: Record<string, unknown>,
  rng: RngState,
  time: number,
): CrackedDrop | null {
  if (s.over || s.phase !== 'play') return null;
  if (time < ((mem.next as number | undefined) ?? C.bot.everySec)) return null;
  mem.next = time + C.bot.everySec * (0.8 + nextFloat(rng) * 0.4);
  const placed = new Set(s.shards.filter((x) => x.placed).map((x) => x.id));
  const loose = s.shards.filter((x) => !x.placed);
  if (!loose.length) return null;
  const score = (id: number) => {
    const x = s.shards.find((y) => y.id === id)!;
    return x.touches.filter((t) => placed.has(t)).length * 2 + (x.rim ? 1 : 0);
  };
  const best = [...loose].sort((a, b) => score(b.id) - score(a.id) || a.id - b.id)[0]!;
  // Sometimes the wrong spot first (once per shard).
  const tried = (mem.tried as number[] | undefined) ?? [];
  if (!tried.includes(best.id) && nextFloat(rng) < C.bot.wrongChance) {
    mem.tried = [...tried, best.id];
    return { id: best.id, at: { x: best.home.x + C.bot.wrongBy, y: best.home.y - C.bot.wrongBy } };
  }
  return { id: best.id, at: best.home };
}
