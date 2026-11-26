/**
 * Fly Block's demo bot (23-minigames-final.md, section 3): it moves the
 * swatter toward the lane of the fly closest to the ring, one panel at a
 * time, and steps off a bee's lane. Now and then it stops a panel short.
 * It returns which way to move (1 clockwise, −1 back), or nothing.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { playing } from '../quick/turns';
import type { FlyBlockState } from './logic';

const FB = BALANCE.minigames.flyBlock;

/** The shortest way round from one panel to another: 1, −1 or 0. */
export function stepToward(from: number, to: number, panels: number): -1 | 0 | 1 {
  const d = (to - from + panels) % panels;
  if (d === 0) return 0;
  return d <= panels / 2 ? 1 : -1;
}

export function flyBlockBot(
  s: FlyBlockState,
  mem: Record<string, unknown>,
  rng: RngState,
  time: number,
): -1 | 1 | null {
  if (s.over || !playing(s.turns)) return null;
  if (time < ((mem.next as number | undefined) ?? 0)) return null;
  mem.next = time + FB.repeatSec + nextFloat(rng) * 0.05;
  const flies = s.flies.filter((f) => f.kind !== 'bee').sort((a, b) => a.dist - b.dist);
  const target = flies[0];
  // A bee on its way to the swatter's panel: step aside.
  const bee = s.flies.find((f) => f.kind === 'bee' && f.lane === s.at && f.dist < 30);
  if (bee && (!target || target.lane !== s.at)) return nextFloat(rng) < 0.5 ? 1 : -1;
  if (!target) return null;
  // Now and then it settles a panel short (once per fly).
  if (mem.fly !== target.id) {
    mem.fly = target.id;
    mem.short = nextFloat(rng) < 0.1;
  }
  const dir = stepToward(s.at, target.lane, s.panels);
  if (dir === 0) return null;
  const away = Math.min(
    (target.lane - s.at + s.panels) % s.panels,
    (s.at - target.lane + s.panels) % s.panels,
  );
  if (mem.short && away === 1) return null;
  return dir;
}
