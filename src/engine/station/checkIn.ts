/**
 * Checkpoints (01-design-doc.md, "Checkpoints"): every active hiker must check
 * in to finish a section.
 *
 * - Moving onto the checkpoint checks a hiker in (a normal move, Move All or
 *   the Trampoline), along with anyone they carry. Cards never move a hiker
 *   onto it. TODO(wyatt): checking in is always the hiker's own move.
 * - Checked-in hikers wait there: they can't act, use or trade items, or step
 *   back out, and lose no stats or durability (camp drains, night events,
 *   weather, wear and condition ticks all skip them).
 * - When nobody is left on the trail, the ranger station opens. A passed-out
 *   hiker still out there is left behind and abandons the hike. At the last
 *   checkpoint the party has reached the summit, and the hike is over.
 */
import { BALANCE } from '../../config/balance';
import { abandonHike, endCarry } from '../health';
import { pushEvent } from '../log';
import { openStation } from './stock';
import type { GameState, Hiker, HikerId, TileId } from '../types';

export const isCheckpoint = (state: GameState, tileId: TileId): boolean =>
  state.section.tiles[tileId]?.kind === 'checkpoint';

/** The last section's checkpoint is the summit. */
export const atLastSection = (state: GameState): boolean =>
  state.sectionIndex >= BALANCE.run.biomes.length - 1;

/** Hikers who just arrived on a tile: on the checkpoint, they check in. */
export function checkInArrivals(
  state: GameState,
  hikerIds: readonly HikerId[],
  tileId: TileId,
): void {
  if (!isCheckpoint(state, tileId)) return;
  const xp = BALANCE.station.checkInXp;
  const arrived: HikerId[] = [];
  for (const id of hikerIds) {
    const h = state.hikers.find((x) => x.id === id);
    if (!h || h.tileId !== tileId || h.status === 'abandoned' || h.status === 'checkedIn') {
      continue;
    }
    const carried = h.status === 'passedOut';
    // A carried hiker is set down here, still out cold: their injuries stay.
    endCarry(state, h);
    h.status = 'checkedIn';
    delete h.countdown;
    delete h.watching;
    h.xp += xp;
    state.arrivals = [
      ...(state.arrivals ?? []),
      { section: state.sectionIndex, hikerId: h.id, injuries: h.injuries, carried },
    ];
    arrived.push(h.id);
  }
  if (arrived.length) pushEvent(state, { kind: 'checkedIn', hikerIds: arrived, xp });
}

/** Nobody is left on the trail, and someone has checked in. */
export function readyToLeave(state: GameState): boolean {
  return (
    !state.station &&
    !state.summit &&
    !state.hikers.some((h) => h.status === 'active') &&
    state.hikers.some((h) => h.status === 'checkedIn')
  );
}

/** Everyone is in: whoever is still out passed out is left behind; the station opens, or the summit. */
export function finishSection(state: GameState): void {
  for (const h of state.hikers) if (h.status === 'passedOut') abandonHike(state, h, 'leftBehind');
  if (atLastSection(state)) {
    state.summit = true;
    pushEvent(state, { kind: 'summit' });
    return;
  }
  state.station = openStation(state);
  pushEvent(state, { kind: 'stationOpened', checkpoint: state.station.checkpoint });
}

export interface CheckInPreview {
  /** Nobody would be left on the trail. */
  last: boolean;
  /** The summit, not a station. */
  summit: boolean;
  /** Passed-out hikers on the trail who'd be left behind. */
  leftBehind: Hiker[];
}

/** What checking these hikers in would do (for the move confirm). Carried hikers come along. */
export function checkInPreview(state: GameState, arrivingIds: readonly HikerId[]): CheckInPreview {
  const arriving = new Set(arrivingIds);
  for (const id of arrivingIds) {
    const carried = state.hikers.find((h) => h.id === id)?.carrying;
    if (carried) arriving.add(carried);
  }
  const last = !state.hikers.some((h) => h.status === 'active' && !arriving.has(h.id));
  return {
    last,
    summit: atLastSection(state),
    leftBehind: last
      ? state.hikers.filter((h) => h.status === 'passedOut' && !arriving.has(h.id))
      : [],
  };
}
