/**
 * Stat changes, injuries and passing out.
 *
 * - Stats run 0–10. A gain stops at 10 (positive conditions can push past it
 *   in Phase 6; a stat already above 10 isn't pulled back down by a gain).
 * - Energy or Appetite reaching 0 gives an injury. Morale just stops at 0
 *   (Wyatt, Nov 5). Gaining an injury raises every stat below 5 back up to 5.
 * - The 3rd injury makes the hiker pass out.
 * - Changes resolve one at a time: each finishes, injury included, before the
 *   next starts (Wyatt, Nov 3).
 */
import { BALANCE } from '../config/balance';
import { fireMoraleChange } from './effects';
import { pushEvent } from './log';
import { STAT_NAMES, type GameState, type Hiker, type StatName } from './types';

export function changeStat(
  state: GameState,
  hiker: Hiker,
  stat: StatName,
  delta: number,
  cause: string,
): void {
  if (delta === 0 || hiker.status === 'abandoned') return;
  const from = hiker.stats[stat];
  const ceiling = Math.max(BALANCE.stats.max, from);
  const to = Math.max(BALANCE.stats.min, Math.min(from + delta, ceiling));
  if (to === from) return;

  hiker.stats[stat] = to;
  pushEvent(state, { kind: 'stat', hikerId: hiker.id, stat, from, to, cause });

  if (stat === 'morale') fireMoraleChange(state, hiker, to - from, cause);
  const injures = BALANCE.injuries.fromStats.includes(stat);
  if (injures && to === BALANCE.stats.min && delta < 0) addInjury(state, hiker, `${stat} hit 0`);
}

export function addInjury(state: GameState, hiker: Hiker, cause: string): void {
  hiker.injuries += 1;
  pushEvent(state, { kind: 'injury', hikerId: hiker.id, injuries: hiker.injuries, cause });

  if (hiker.injuries >= BALANCE.injuries.passOutAt && hiker.status === 'active') {
    hiker.status = 'passedOut';
    pushEvent(state, { kind: 'passedOut', hikerId: hiker.id });
  }

  const floor = BALANCE.injuries.raiseStatsBelowTo;
  for (const stat of STAT_NAMES) {
    const from = hiker.stats[stat];
    if (from >= floor) continue;
    hiker.stats[stat] = floor;
    pushEvent(state, { kind: 'stat', hikerId: hiker.id, stat, from, to: floor, cause: 'injury' });
  }
}
