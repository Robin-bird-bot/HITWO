/**
 * Morale types (09-hikers.md; Phase 10.7): at the end of every phase each
 * active hiker's type gives +1 Morale, −1, or nothing, within their Morale
 * limits. "Moved" includes being brought along by a Move All. Counts include
 * the hiker.
 *
 * The forecast is what the end of this phase would give right now, for the
 * Morale bar: up, down, nothing, or can't tell yet (Wanderlust and Homebody,
 * while the hiker hasn't moved and can still act).
 */
import { BALANCE } from '../config/balance';
import { MORALE_TYPES } from '../content/moraleTypes';
import { tally } from './effects';
import { hikersOnTile } from './map';
import { changeStat } from './stats';
import type { GameState, Hiker } from './types';

const M = BALANCE.moraleTypes;

export type MoraleForecast = 1 | -1 | 0 | 'unknown';

/** Did this hiker move this phase (walking, or brought along)? */
export const movedThisPhase = (state: GameState, h: Hiker): boolean =>
  tally(state, h, 'moved', 0, 'phase') > 0;

/** What the hiker's type gives right now: +1, −1 or 0. */
export function moraleNow(state: GameState, h: Hiker): 1 | -1 | 0 {
  const type = h.moraleType;
  if (!type || h.status !== 'active') return 0;
  const here = hikersOnTile(state, h.tileId).length;
  const sign = (up: boolean, down: boolean): 1 | -1 | 0 => (up && !down ? 1 : down && !up ? -1 : 0);
  switch (type) {
    case 'extrovert':
      return sign(here >= M.crowd, here <= 1);
    case 'introvert':
      return sign(here <= 1, here >= M.crowd);
    case 'ambivert':
      return sign(here >= 2 && here < M.bigGroup, here <= 1 || here >= M.bigGroup);
    case 'foody':
      return sign(h.stats.appetite >= M.high, h.stats.appetite <= M.low);
    case 'energetic':
      return sign(h.stats.energy >= M.high, h.stats.energy <= M.low);
    case 'wanderlust':
      return movedThisPhase(state, h) ? 1 : -1;
    case 'homebody':
      return movedThisPhase(state, h) ? -1 : 1;
  }
}

/** What the end of this phase will give, as the Morale bar shows it. */
export function moraleForecast(state: GameState, h: Hiker): MoraleForecast {
  const type = h.moraleType;
  if (!type || h.status !== 'active') return 0;
  const moves = type === 'wanderlust' || type === 'homebody';
  if (moves && !movedThisPhase(state, h) && !h.acted) return 'unknown';
  return moraleNow(state, h);
}

/** The end of a phase: every active hiker's type gives its +1 or −1 ("Finn +1 Morale (Extrovert)."). */
export function checkMoraleTypes(state: GameState): void {
  for (const h of state.hikers) {
    const delta = moraleNow(state, h);
    if (!delta || !h.moraleType) continue;
    changeStat(state, h, 'morale', delta * M.change, MORALE_TYPES[h.moraleType].name);
  }
}
