/**
 * Raccoon Shuffle's demo bot (22-minigame-revisions.md, section 1.2): it
 * follows one empty bin through the shuffle. If a raccoon takes that one
 * away, it picks at random from the bins still there. It waits a moment
 * before picking, like a player would.
 */
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { current, playing } from '../quick/turns';
import { takenAt, type RaccoonShuffleState } from './logic';

export function raccoonShuffleBot(
  s: RaccoonShuffleState,
  mem: Record<string, unknown>,
  rng: RngState,
  time: number,
): number | null {
  if (s.over || !playing(s.turns)) return null;
  // A new turn: follow one of its empty bins (by id: it keeps it through the swaps).
  const turn = `${current(s.turns)}:${s.bins.map((b) => (b.card ? 1 : 0)).join('')}`;
  if (mem.turn !== turn) {
    const empties = s.bins.filter((b) => !b.card);
    mem.turn = turn;
    mem.follow = empties[Math.floor(nextFloat(rng) * empties.length)]?.id ?? 0;
    mem.at = undefined;
  }
  if (s.phase !== 'pick') return null;
  if (mem.at === undefined) mem.at = time + 0.5 + nextFloat(rng) * 0.4;
  if (time < (mem.at as number)) return null;
  const slot = s.slots.indexOf(mem.follow as number);
  if (slot >= 0 && !takenAt(s, slot)) return slot;
  // Its bin was taken: any bin still there.
  const left = s.slots.map((_, k) => k).filter((k) => !takenAt(s, k));
  return left[Math.floor(nextFloat(rng) * left.length)] ?? null;
}
