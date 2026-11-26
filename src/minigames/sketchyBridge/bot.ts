/**
 * Sketchy Bridge's demo bot (23-minigames-final.md, section 1): it holds
 * when the icon is above the zone's middle (allowing for where the zone is
 * heading) and lets go when it's below,
 * but [0.15 s] late, and now and then it keeps holding a moment too long
 * (an overshoot). It returns whether to hold, only when that changes.
 */
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { playing } from '../quick/turns';
import type { SketchyBridgeState } from './logic';

const LATE = 0.15;
/** How far ahead (seconds) it judges the zone's movement. */
const LEAD = 0.4;

export function sketchyBridgeBot(
  s: SketchyBridgeState,
  mem: Record<string, unknown>,
  rng: RngState,
  time: number,
): boolean | null {
  if (s.over || !playing(s.turns)) return null;
  // What it wants now, remembered, so it acts on what it saw [0.15 s] ago. Like a player who
  // has the feel of it, it allows for where the zone is heading, not just where it is.
  const want = s.iconY > s.zoneY + s.zoneH / 2 + s.zoneV * LEAD;
  const seen = (mem.seen as { at: number; want: boolean }[] | undefined) ?? [];
  seen.push({ at: time, want });
  while (seen.length > 1 && seen[1]!.at <= time - LATE) seen.shift();
  mem.seen = seen;
  let hold = seen[0]!.want;
  // An overshoot: keep holding a little longer than it should.
  if (!hold && s.holding) {
    if (mem.overUntil === undefined && nextFloat(rng) < 0.04) mem.overUntil = time + 0.12;
    if (typeof mem.overUntil === 'number' && time < mem.overUntil) hold = true;
    else mem.overUntil = undefined;
  }
  return hold === s.holding ? null : hold;
}
