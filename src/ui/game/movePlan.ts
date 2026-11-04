/**
 * Planning a move for the UI: which connected tiles the selected hiker can
 * go to, and a preview of what it costs each hiker. Pure, so it's tested.
 */
import {
  adjacentTileIds,
  hikersOnTile,
  moveAllCost,
  moveCost,
  STAT_NAMES,
  validateAction,
  type Action,
  type GameState,
  type Hiker,
  type HikerId,
  type StatName,
  type TileId,
} from '../../engine';
import { tileName } from '../panels/hikerInfo';

export type MoveMode = { kind: 'move' } | { kind: 'moveAll'; bring: HikerId[] };

export interface MoveTarget {
  tileId: TileId;
  /** Null when the move is allowed; otherwise why not. */
  reason: string | null;
}

function actionFor(hiker: Hiker, mode: MoveMode, toTileId: TileId): Action {
  return mode.kind === 'move'
    ? { type: 'move', hikerId: hiker.id, toTileId }
    : { type: 'moveAll', hikerId: hiker.id, toTileId, bring: mode.bring };
}

/** Every connected tile, and whether the hiker can move there now. */
export function moveTargets(state: GameState, hiker: Hiker, mode: MoveMode): MoveTarget[] {
  return adjacentTileIds(state.section, hiker.tileId).map((tileId) => ({
    tileId,
    reason: validateAction(state, actionFor(hiker, mode, tileId)),
  }));
}

export interface StatChange {
  stat: StatName;
  from: number;
  to: number;
}

export interface CostRow {
  hikerId: HikerId;
  name: string;
  changes: StatChange[];
  /** A stat would reach 0, giving an injury. */
  injury: boolean;
}

export interface MovePreview {
  tileId: TileId;
  action: Action;
  title: string;
  where: string;
  rows: CostRow[];
  /** Hidden nodes the move would reveal. */
  reveals: number;
  night: boolean;
  /** Why it can't happen, if it can't. */
  reason: string | null;
}

/** What a move would do, for the confirm popover. */
export function movePreview(
  state: GameState,
  hiker: Hiker,
  mode: MoveMode,
  tileId: TileId,
): MovePreview | null {
  const from = state.section.tiles[hiker.tileId];
  const to = state.section.tiles[tileId];
  if (!from || !to) return null;
  const action = actionFor(hiker, mode, tileId);
  const reason = validateAction(state, action);

  const costs =
    mode.kind === 'move'
      ? [{ hikerId: hiker.id, cost: moveCost(state, hiker.id, tileId) }]
      : (moveAllCost(state, hiker.id, tileId, mode.bring) ?? []);

  const rows: CostRow[] = costs.map(({ hikerId, cost }) => {
    const h = state.hikers.find((x) => x.id === hikerId);
    const changes: StatChange[] = [];
    for (const stat of STAT_NAMES) {
      const amount = cost?.[stat] ?? 0;
      if (!h || amount <= 0) continue;
      changes.push({ stat, from: h.stats[stat], to: Math.max(0, h.stats[stat] - amount) });
    }
    return {
      hikerId,
      name: h?.name ?? hikerId,
      changes,
      injury: changes.some((c) => c.to === 0),
    };
  });

  const verb = mode.kind === 'moveAll' ? 'MOVE ALL' : 'MOVE';
  const direction = to.row === from.row ? 'SIDEWAYS ' : to.row < from.row ? 'BACK ' : '';
  return {
    tileId,
    action,
    title: mode.kind === 'moveAll' ? verb : `${direction}${verb}`,
    where: tileName(to),
    rows,
    reveals: to.nodes.filter((n) => !n.revealed).length,
    night: state.phase === 'night',
    reason,
  };
}

export interface BringOption {
  hiker: Hiker;
  /** Null when this hiker can come along; otherwise why not. */
  reason: string | null;
}

/** Hikers on the mover's tile who could be brought along by Move All. */
export function bringOptions(state: GameState, mover: Hiker): BringOption[] {
  const targets = adjacentTileIds(state.section, mover.tileId);
  return hikersOnTile(state, mover.tileId)
    .filter((h) => h.id !== mover.id)
    .map((h) => {
      if (h.acted) return { hiker: h, reason: `${h.name} has already acted this ${state.phase}.` };
      let reason: string | null = 'There’s nowhere to go from here.';
      for (const t of targets) {
        const r = validateAction(state, {
          type: 'moveAll',
          hikerId: mover.id,
          toTileId: t,
          bring: [h.id],
        });
        if (r === null) return { hiker: h, reason: null };
        // Prefer a reason about this hiker over one about the tile.
        if (reason === 'There’s nowhere to go from here.' || r.startsWith(h.name)) reason = r;
      }
      return { hiker: h, reason };
    });
}

/** The next hiker who still has their action this phase, after the given one. */
export function nextReadyHiker(state: GameState, afterId: HikerId): Hiker | undefined {
  const order = state.hikers;
  const start = order.findIndex((h) => h.id === afterId);
  for (let i = 1; i <= order.length; i++) {
    const h = order[(start + i) % order.length];
    if (h && h.status === 'active' && !h.acted) return h;
  }
  return undefined;
}
