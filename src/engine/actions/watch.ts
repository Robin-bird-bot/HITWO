/**
 * Keep Watch (01-design-doc.md, "Days, phases and actions"): a night action.
 * Hikers on a tile where anyone keeps watch are safe from tonight's night
 * event (05-nights-and-weather.md). A watcher doesn't sleep, so the night
 * without sleep still costs Energy at camp.
 */
import { pushEvent } from '../log';
import { watchReach, fireAction } from '../effects';
import { hikersOnTile, tileDistance } from '../map';
import type { Action, GameState, Hiker, TileId } from '../types';
import { findHiker, mustFindHiker, phaseActionReason, spendAction } from './common';

type WatchAction = Extract<Action, { type: 'keepWatch' }>;

/** Is anyone keeping watch on this tile tonight? */
export function isWatched(state: GameState, tileId: TileId): boolean {
  return !!watcherFor(state, tileId);
}

/**
 * Who keeps watch over a tile tonight: someone on it, or someone whose watch
 * reaches it from nearby (Lookout).
 */
export function watcherFor(state: GameState, tileId: TileId): Hiker | undefined {
  const here = hikersOnTile(state, tileId).find((h) => h.watching);
  if (here) return here;
  return state.hikers.find(
    (h) =>
      h.watching &&
      h.status === 'active' &&
      tileDistance(state.section, h.tileId, tileId) <= watchReach(state, h),
  );
}

export function validateWatch(state: GameState, action: WatchAction): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  const reason = phaseActionReason(state, hiker, action);
  if (reason || !hiker) return reason;
  if (state.phase !== 'night') return 'Hikers keep watch at night.';
  // TODO(wyatt): one watcher per tile, since a second keeps nobody safer.
  const watcher = hikersOnTile(state, hiker.tileId).find((h) => h.watching);
  if (watcher) return `${watcher.name} is already keeping watch on this tile.`;
  return undefined;
}

export function applyWatch(state: GameState, action: WatchAction): void {
  const hiker = mustFindHiker(state, action.hikerId);
  spendAction(state, hiker);
  hiker.watching = true;
  pushEvent(state, { kind: 'watch', hikerId: hiker.id });
  fireAction(state, hiker, { kind: 'watch', role: 'actor', tileId: hiker.tileId });
}
