/**
 * The portraits' float (docs/design/12-minigames-dodge.md, section 3): the
 * flying ones (the bee and the Woods Monster) move up and down along a sine
 * wave, drawn at whole units. Shared by the portraits and Glare's beams,
 * which start at his eyes.
 */
import { BALANCE } from '../../../config/balance';
import type { Attacker } from '../../../minigames/dodge/logic';

const P = BALANCE.minigames.dodge.portraits;

/** How far a portrait floats from its resting place now (0 for the ones that bob). */
export function floatOffset(who: Attacker, time: number): number {
  const f = P.float[who];
  return f ? Math.round(f.units * Math.sin((2 * Math.PI * time) / f.sec)) : 0;
}
