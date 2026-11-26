/**
 * Pack It Up's demo bot (23-minigames-final.md, section 8): a simple
 * solver that follows the cut the puzzle was made from. Every second or so
 * it turns the next piece to its fit and drops it in, and now and then it
 * drops one a cell off (which doesn't fit, so it tries again).
 */
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { playing } from '../quick/turns';
import type { Cell, PackItUpState } from './logic';

export type PackAction = { kind: 'turn'; id: number } | { kind: 'place'; id: number; at: Cell };

export function packItUpBot(
  s: PackItUpState,
  mem: Record<string, unknown>,
  rng: RngState,
  time: number,
): PackAction | null {
  if (s.over || !playing(s.turns)) return null;
  if (time < ((mem.next as number | undefined) ?? 0)) return null;
  const p = s.pieces.find((x) => x.at === null && x.id !== s.sacked);
  if (!p) return null;
  if (p.rot !== p.homeRot) {
    mem.next = time + 0.25;
    return { kind: 'turn', id: p.id };
  }
  mem.next = time + 0.8 + nextFloat(rng) * 0.6;
  const off = nextFloat(rng) < 0.12 ? 1 : 0;
  return { kind: 'place', id: p.id, at: { col: p.home.col + off, row: p.home.row } };
}
