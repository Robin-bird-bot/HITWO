/**
 * Which drops are valid (Nov 14 update, section 6). Pure, so it's tested;
 * the screens ask these while something is being dragged, and they mostly
 * ask the engine (validateAction) what the drop would do.
 */
import type { GameState, Hiker, HikerId, TileId } from '../../engine';
import { moveTargets } from '../game/movePlan';

/** A hiker can be picked up off the map while they're on the trail and awake. */
export function canDragHiker(hiker: Hiker | undefined): boolean {
  return hiker?.status === 'active';
}

/** The tiles a dragged hiker can be dropped on: every connected tile they can move to now. */
export function hikerDropTiles(state: GameState, hikerId: HikerId): ReadonlySet<TileId> {
  const hiker = state.hikers.find((h) => h.id === hikerId);
  if (!canDragHiker(hiker) || !hiker) return new Set();
  return new Set(
    moveTargets(state, hiker, { kind: 'move' })
      .filter((t) => t.reason === null)
      .map((t) => t.tileId),
  );
}
