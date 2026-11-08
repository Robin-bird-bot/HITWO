/**
 * Stat changes, injuries and passing out.
 *
 * - Stats run 0–10. A gain stops at 10, or the hiker's raised maximum
 *   (positive conditions can push past it in Phase 6; a stat already above
 *   it isn't pulled back down by a gain).
 * - Energy or Appetite reaching 0 gives an injury. Morale just stops at 0
 *   (Wyatt, Nov 5). Gaining an injury raises every stat below 5 back up to 5.
 * - The 3rd injury makes the hiker pass out (src/engine/health.ts). Injuries
 *   stop there. Curing one below 3 wakes them.
 * - Changes resolve one at a time: each finishes, injury included, before the
 *   next starts (Wyatt, Nov 3).
 */
import { BALANCE } from '../config/balance';
import {
  adjustStatChange,
  blocksInjury,
  fireMoraleChange,
  fireStatChange,
  statMaxModifiers,
} from './effects';
import { passOut, wakeUp } from './health';
import { pushEvent } from './log';
import { STAT_NAMES, type GameState, type Hiker, type StatName } from './types';

/**
 * A stat's maximum for this hiker right now: 10, plus any permanent raise
 * (Sleeping Giant), less what conditions take (Burning), and no higher than
 * any cap (Dejected: Morale 5).
 */
export function statMax(state: GameState, hiker: Hiker, stat: StatName): number {
  let max = BALANCE.stats.max + (hiker.maxBonus?.[stat] ?? 0);
  const mods = statMaxModifiers(state, hiker, stat);
  for (const m of mods) max += m.delta ?? 0;
  for (const m of mods) if (m.cap !== undefined) max = Math.min(max, m.cap);
  return Math.max(BALANCE.stats.min, max);
}

/** Is something holding this stat below its usual maximum (a cap, Burning)? */
function capped(state: GameState, hiker: Hiker, stat: StatName): boolean {
  return statMaxModifiers(state, hiker, stat).some(
    (m) => m.cap !== undefined || (m.delta ?? 0) < 0,
  );
}

/**
 * Lowers any stat above a cap to the cap (a new Dejected, more Burning, or
 * Hangry as Appetite drops). A stat above 10 from a positive condition is left
 * alone unless a cap holds it.
 */
export function clampToCaps(state: GameState, hiker: Hiker): void {
  for (const stat of STAT_NAMES) {
    if (!capped(state, hiker, stat)) continue;
    const max = statMax(state, hiker, stat);
    const from = hiker.stats[stat];
    if (from <= max) continue;
    hiker.stats[stat] = max;
    pushEvent(state, {
      kind: 'stat',
      hikerId: hiker.id,
      stat,
      from,
      to: max,
      cause: 'its maximum',
    });
  }
}

export interface StatChangeOptions {
  /** A positive condition can push a stat above its maximum (Energized). */
  pastMax?: boolean;
}

/**
 * Changes a stat. Sources change it first (Strained loses 1 more, Refreshed
 * loses none, Inspired gains 1 more). Energy or Appetite reaching 0 gives an injury.
 */
export function changeStat(
  state: GameState,
  hiker: Hiker,
  stat: StatName,
  delta: number,
  cause: string,
  { pastMax = false }: StatChangeOptions = {},
): void {
  if (delta === 0 || hiker.status === 'abandoned') return;
  const change = adjustStatChange(state, hiker, { stat, delta, cause });
  if (change === 0) return;
  const from = hiker.stats[stat];
  const ceiling = pastMax ? Infinity : Math.max(statMax(state, hiker, stat), from);
  const to = Math.max(BALANCE.stats.min, Math.min(from + change, ceiling));
  if (to === from) return;

  hiker.stats[stat] = to;
  pushEvent(state, { kind: 'stat', hikerId: hiker.id, stat, from, to, cause });

  if (stat === 'morale') fireMoraleChange(state, hiker, to - from, cause);
  fireStatChange(state, hiker, { stat, from, to, cause });
  const injures = BALANCE.injuries.fromStats.includes(stat);
  if (injures && to === BALANCE.stats.min && change < 0) addInjury(state, hiker, `${stat} hit 0`);
  // Hangry's Morale cap moves with Appetite.
  clampToCaps(state, hiker);
}

/**
 * Gives back or takes back a condition's stat change when it ends: no
 * sources, no injury, never below 0, and never above the maximum.
 */
export function shiftStat(
  state: GameState,
  hiker: Hiker,
  stat: StatName,
  delta: number,
  cause: string,
): void {
  if (delta === 0 || hiker.status === 'abandoned') return;
  const from = hiker.stats[stat];
  const ceiling = Math.max(statMax(state, hiker, stat), from);
  const to = Math.max(BALANCE.stats.min, Math.min(from + delta, ceiling));
  if (to === from) return;
  hiker.stats[stat] = to;
  pushEvent(state, { kind: 'stat', hikerId: hiker.id, stat, from, to, cause });
}

export function addInjury(state: GameState, hiker: Hiker, cause: string): void {
  // Injuries stop at the one that passes a hiker out.
  if (hiker.status === 'abandoned' || hiker.injuries >= BALANCE.injuries.passOutAt) return;
  // Something blocks it (a Star; the Hardhat).
  if (blocksInjury(state, hiker, cause)) return;
  hiker.injuries += 1;
  pushEvent(state, { kind: 'injury', hikerId: hiker.id, injuries: hiker.injuries, cause });

  if (hiker.injuries >= BALANCE.injuries.passOutAt) passOut(state, hiker);

  const floor = BALANCE.injuries.raiseStatsBelowTo;
  for (const stat of STAT_NAMES) {
    const from = hiker.stats[stat];
    if (from >= floor) continue;
    hiker.stats[stat] = floor;
    pushEvent(state, { kind: 'stat', hikerId: hiker.id, stat, from, to: floor, cause: 'injury' });
  }
}

/** Cures up to `n` injuries. A passed-out hiker who drops below the line wakes up. */
export function cureInjuries(state: GameState, hiker: Hiker, n: number, cause: string): void {
  const healed = Math.min(hiker.injuries, n);
  if (healed <= 0 || hiker.status === 'abandoned') return;
  hiker.injuries -= healed;
  pushEvent(state, { kind: 'healed', hikerId: hiker.id, healed, injuries: hiker.injuries, cause });
  if (hiker.injuries < BALANCE.injuries.passOutAt) wakeUp(state, hiker, cause);
}
