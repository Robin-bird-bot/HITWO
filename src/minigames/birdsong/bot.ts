/**
 * Birdsong's demo bot (23-minigames-final.md, section 5): while answering,
 * it taps the next note about every half second, getting it right [92%] of
 * the time, a little less in longer songs.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import type { BirdsongState } from './logic';

const BS = BALANCE.minigames.birdsong;

export function birdsongBot(
  s: BirdsongState,
  mem: Record<string, unknown>,
  rng: RngState,
  time: number,
): number | null {
  if (s.over || s.phase !== 'answer') return null;
  if (time < ((mem.next as number | undefined) ?? 0)) return null;
  mem.next = time + 0.4 + nextFloat(rng) * 0.3;
  const right = s.song[s.answer.length];
  if (right === undefined) return null;
  const odds = BS.botRight - Math.max(0, s.song.length - 4) * 0.015;
  if (nextFloat(rng) < odds) return right;
  return (right + 1 + Math.floor(nextFloat(rng) * (s.colors - 1))) % s.colors;
}
