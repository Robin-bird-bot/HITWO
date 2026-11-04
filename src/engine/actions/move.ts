import { moveCost } from '../costs';
import { fireMove } from '../effects';
import { pushEvent } from '../log';
import { lineBetween } from '../map';
import type { Action, GameState } from '../types';
import {
  enterTile,
  findHiker,
  mustFindHiker,
  payCost,
  phaseActionReason,
  tileEntryReason,
} from './common';

type MoveAction = Extract<Action, { type: 'move' }>;

export function validateMove(state: GameState, action: MoveAction): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  const reason = phaseActionReason(state, hiker, action);
  if (reason || !hiker) return reason;
  if (!state.section.tiles[action.toTileId]) return 'That tile isn’t on the map.';
  if (!lineBetween(state.section, hiker.tileId, action.toTileId)) {
    return 'That tile isn’t connected to this one.';
  }
  return tileEntryReason(state, action.toTileId);
}

export function applyMove(state: GameState, action: MoveAction): void {
  const hiker = mustFindHiker(state, action.hikerId);
  const line = lineBetween(state.section, hiker.tileId, action.toTileId);
  const cost = moveCost(state, hiker.id, action.toTileId);
  if (!line || !cost) throw new Error('applyMove: not adjacent');

  const from = hiker.tileId;
  hiker.tileId = action.toTileId;
  hiker.acted = true;
  const revealed = enterTile(state, hiker.tileId);
  pushEvent(state, {
    kind: 'move',
    hikerId: hiker.id,
    from,
    to: hiker.tileId,
    brought: [],
    ...(revealed.length ? { revealed } : {}),
  });
  payCost(state, hiker, cost, 'Move');
  fireMove(state, hiker, { from, to: hiker.tileId, role: 'actor', line });
}
