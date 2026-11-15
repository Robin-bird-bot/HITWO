/**
 * Multi-select (Nov 14 update, section 9): several hikers picked in order,
 * then one action that each of them does on their own, in that order.
 * Pure, so it's tested; the game screen runs it a step at a time.
 *
 * - Move: each hiker moves to the tile separately and pays their own way.
 *   It waits while a challenge is open, so the first to arrive faces the
 *   tile's card alone (a card triggers only once). Hikers who can't reach
 *   the tile, but could move somewhere, come last: each picks their own tile
 *   or skips.
 * - Scavenge, Tend, Sleep, Keep Watch: each hiker in turn (each scavenge
 *   window opens after the last one closes).
 * - A hiker who can't take the action at all is skipped, with why.
 */
import {
  validateAction,
  type Action,
  type GameState,
  type HikerId,
  type TileId,
} from '../../engine';
import { moveTargets, type MoveTarget } from './movePlan';

export type GroupKind = 'move' | 'scavenge' | 'tend' | 'sleep' | 'watch';

export interface Skip {
  hikerId: HikerId;
  reason: string;
}

export interface GroupRun {
  kind: GroupKind;
  /** Move: where everyone's going. */
  tileId?: TileId;
  /** Still to go, in turn order. */
  pending: HikerId[];
  /** Move: hikers who can't reach the tile; each picks their own afterwards. */
  later: HikerId[];
  /** Move: the hiker picking their own tile now (or skipping). */
  own?: HikerId;
}

export type GroupStep =
  /** A window is open (a challenge, a scavenge): wait for it. */
  | { kind: 'wait' }
  /** This hiker does it now. */
  | { kind: 'act'; action: Action; run: GroupRun; skipped: Skip[] }
  /** Move: this hiker picks their own tile, or skips. */
  | { kind: 'own'; run: GroupRun; skipped: Skip[] }
  /** Everyone's done. */
  | { kind: 'done'; skipped: Skip[] };

/** The action each hiker takes. */
export function groupAction(kind: GroupKind, hikerId: HikerId, tileId?: TileId): Action {
  switch (kind) {
    case 'move':
      return { type: 'move', hikerId, toTileId: tileId ?? '' };
    case 'scavenge':
      return { type: 'scavenge', hikerId };
    case 'tend':
      return { type: 'tend', hikerId };
    case 'sleep':
      return { type: 'sleep', hikerId };
    case 'watch':
      return { type: 'keepWatch', hikerId };
  }
}

/** Could this hiker move anywhere right now (if not to the group's tile)? */
function canMoveSomewhere(state: GameState, hikerId: HikerId): boolean {
  const h = state.hikers.find((x) => x.id === hikerId);
  return !!h && moveTargets(state, h, { kind: 'move' }).some((t) => t.reason === null);
}

/**
 * The tiles a group can be sent to: every tile connected to any of them, ready
 * (gold ring) if at least one of them can move there now. Those who can't
 * come last and pick their own tile.
 */
export function groupMoveTargets(state: GameState, group: readonly HikerId[]): MoveTarget[] {
  const out = new Map<TileId, MoveTarget>();
  for (const id of group) {
    const h = state.hikers.find((x) => x.id === id);
    if (!h || h.status !== 'active') continue;
    for (const t of moveTargets(state, h, { kind: 'move' })) {
      const had = out.get(t.tileId);
      if (!had || (had.reason !== null && t.reason === null)) out.set(t.tileId, t);
    }
  }
  return [...out.values()];
}

/** A window that has to close before the next hiker goes. */
const busy = (state: GameState) => !!state.challenge || !!state.scavenge || !!state.station;

/**
 * Starts a group action: everyone in turn order goes; for a move, anyone who
 * can't reach the tile but could move elsewhere goes last, picking their own;
 * anyone who can't take the action at all is skipped, with why.
 */
export function startGroup(
  state: GameState,
  order: readonly HikerId[],
  kind: GroupKind,
  tileId?: TileId,
): { run: GroupRun; skipped: Skip[] } {
  const run: GroupRun = { kind, ...(tileId ? { tileId } : {}), pending: [], later: [] };
  const skipped: Skip[] = [];
  for (const id of order) {
    const reason = validateAction(state, groupAction(kind, id, tileId));
    if (reason === null) run.pending.push(id);
    else if (kind === 'move' && canMoveSomewhere(state, id)) run.later.push(id);
    else skipped.push({ hikerId: id, reason });
  }
  return { run, skipped };
}

/**
 * The next step, checked against the game as it is now: the next hiker's
 * action if they can take it; otherwise they're skipped (or, for a move,
 * sent to pick their own tile) and the one after is tried.
 */
export function stepGroup(state: GameState, run: GroupRun): GroupStep {
  if (busy(state)) return { kind: 'wait' };
  const skipped: Skip[] = [];
  const pending = [...run.pending];
  const later = [...run.later];
  while (pending.length) {
    const id = pending.shift() as HikerId;
    const action = groupAction(run.kind, id, run.tileId);
    const reason = validateAction(state, action);
    if (reason === null) {
      return { kind: 'act', action, run: { ...run, pending, later }, skipped };
    }
    if (run.kind === 'move' && canMoveSomewhere(state, id)) later.push(id);
    else skipped.push({ hikerId: id, reason });
  }
  while (later.length) {
    const id = later.shift() as HikerId;
    if (canMoveSomewhere(state, id)) {
      return { kind: 'own', run: { ...run, pending: [], later, own: id }, skipped };
    }
    const name = state.hikers.find((h) => h.id === id)?.name ?? 'They';
    skipped.push({ hikerId: id, reason: `${name} can’t move anywhere right now.` });
  }
  return { kind: 'done', skipped };
}

/** The turn order as numbers for the badges: 1 for the first picked, and so on. */
export function orderNumbers(group: readonly HikerId[]): Partial<Record<HikerId, number>> {
  return Object.fromEntries(group.map((id, i) => [id, i + 1]));
}

/**
 * Picking hikers for a group: a hiker not in it joins at the end (starting
 * from the one already selected); one in it leaves. A group of one is no group.
 */
export function toggleInGroup(
  group: readonly HikerId[],
  selected: HikerId | null,
  id: HikerId,
): HikerId[] {
  const base = group.length ? [...group] : selected && selected !== id ? [selected] : [];
  const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
  return next.length > 1 ? next : [];
}

/** The short note for hikers a group action skipped: "Birch skipped: …". */
export function skipWords(skipped: readonly Skip[], nameOf: (id: HikerId) => string): string {
  if (!skipped.length) return '';
  const lines = skipped.map((k) => {
    const name = nameOf(k.hikerId);
    // Most reasons already start with the name ("Birch has already acted…").
    return k.reason.startsWith(name) ? k.reason : `${name}: ${k.reason}`;
  });
  return `Skipped. ${lines.join(' ')}`;
}
