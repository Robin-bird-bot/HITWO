/**
 * Footsteps (32-audio-system.md, section 6): which step plays while a hiker's
 * token walks along a line, how often, and where it sits left to right.
 *
 * - The surface comes from the line: normal → dirt, rough → gravel, paved,
 *   steep, muddy → mud. While it snows, people step in snow.
 * - Dogs pad (claws on paved and rough lines), cats pad more softly, and
 *   plush hikers go "fwump" everywhere.
 */
import { BALANCE } from '../config/balance';
import type { Family, LineKind } from '../engine';

const F = BALANCE.audio.footsteps;

const BOOT: Record<LineKind, string> = {
  normal: 'foot.dirt',
  rough: 'foot.gravel',
  paved: 'foot.paved',
  steep: 'foot.steep',
  muddy: 'foot.mud',
};

/** The step sound for this line, hiker and weather, and its level. */
export function footstepFor(
  line: LineKind,
  family: Family,
  snowing: boolean,
): { id: string; volume: number } {
  if (family === 'plush') return { id: 'foot.plush', volume: 1 };
  if (family === 'cat') return { id: 'foot.paw', volume: F.catVolume };
  if (family === 'dog') {
    return { id: line === 'paved' || line === 'rough' ? 'foot.pawHard' : 'foot.paw', volume: 1 };
  }
  return { id: snowing ? 'foot.snow' : BOOT[line], volume: 1 };
}

/** Milliseconds between steps: people, dogs and cats, plush. */
export function stepMs(family: Family): number {
  if (family === 'plush') return F.stepMs.plush;
  if (family === 'dog' || family === 'cat') return F.stepMs.paws;
  return F.stepMs.people;
}

/** Left to right on screen (0 to 1) as a pan, from −F.pan at the left edge to +F.pan at the right. */
export function panAt(fraction: number): number {
  const f = Math.min(1, Math.max(0, fraction));
  return (f * 2 - 1) * F.pan;
}
