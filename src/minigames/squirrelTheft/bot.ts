/**
 * Squirrel Theft's demo bot (23-minigames-final.md, section 4): it throws
 * at the squirrel nearest the middle, leading moving ones (where they'll
 * be when the nut lands), and misjudges about [30%] of its throws. It
 * mostly leaves bears alone. It throws every [0.6–0.9 s].
 */
import { BALANCE } from '../../config/balance';
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { playing } from '../quick/turns';
import { isUp, targetAt, type Point, type SquirrelTheftState } from './logic';

const ST = BALANCE.minigames.squirrelTheft;

export type SquirrelAction = { kind: 'skip' } | { kind: 'throw'; to: Point };

export function squirrelTheftBot(
  s: SquirrelTheftState,
  mem: Record<string, unknown>,
  rng: RngState,
  time: number,
): SquirrelAction | null {
  if (s.over) return null;
  if (s.phase === 'intro') return time > 1.2 ? { kind: 'skip' } : null;
  if (!playing(s.turns) || time < ((mem.next as number | undefined) ?? 0)) return null;
  const landAt = s.time + ST.flightSec;
  const squirrels = s.targets.filter(
    (t) => t.kind === 'squirrel' && t.fedAt === undefined && isUp(t, s.time) && isUp(t, landAt),
  );
  // Now and then it throws at a bear by mistake.
  const bears = s.targets.filter((t) => t.kind === 'bear' && isUp(t, landAt));
  const pool = bears.length && nextFloat(rng) < 0.08 ? bears : squirrels;
  if (!pool.length) return null;
  const pick = [...pool].sort((a, b) => Math.abs(a.x - 160) - Math.abs(b.x - 160))[0]!;
  const lead = targetAt(pick, landAt);
  mem.next = time + 0.6 + nextFloat(rng) * 0.3;
  const miss = nextFloat(rng) < ST.botMiss;
  const off = miss ? (10 + nextFloat(rng) * 8) * (nextFloat(rng) < 0.5 ? -1 : 1) : 0;
  return { kind: 'throw', to: { x: lead.x + off, y: lead.y + (miss ? off / 3 : 0) } };
}
