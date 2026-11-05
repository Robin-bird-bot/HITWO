import { moveAllCost } from '../costs';
import { canActReason, fireMove } from '../effects';
import { pushEvent } from '../log';
import { lineBetween } from '../map';
import type { Action, GameState } from '../types';
import {
  enterTile,
  findHiker,
  moraleCostReason,
  mustFindHiker,
  payCost,
  phaseActionReason,
  tileEntryReason,
} from './common';

type MoveAllAction = Extract<Action, { type: 'moveAll' }>;

export function validateMoveAll(state: GameState, action: MoveAllAction): string | undefined {
  const mover = findHiker(state, action.hikerId);
  const reason = phaseActionReason(state, mover, action);
  if (reason || !mover) return reason;
  if (!state.section.tiles[action.toTileId]) return 'That tile isn’t on the map.';
  if (!lineBetween(state.section, mover.tileId, action.toTileId)) {
    return 'That tile isn’t connected to this one.';
  }
  const entry = tileEntryReason(state, action.toTileId);
  if (entry) return entry;
  if (action.bring.length === 0) return 'Pick at least one hiker to bring along.';
  if (new Set(action.bring).size !== action.bring.length) return 'Each hiker can come along once.';

  for (const id of action.bring) {
    const b = findHiker(state, id);
    if (!b) return 'That hiker isn’t in the party.';
    if (b.id === mover.id) return `${mover.name} is already moving.`;
    if (b.status !== 'active') return `${b.name} can’t come along right now.`;
    if (b.tileId !== mover.tileId) return `${b.name} isn’t on this tile.`;
    if (b.acted) return `${b.name} has already acted this ${state.phase}.`;
    const blocked = canActReason(state, b, { action, role: 'brought', phase: state.phase });
    if (blocked) return `${b.name} can’t come along. ${blocked}`;
  }
  // Rough lines cost each crosser Morale; nobody at 0 Morale can pay it.
  for (const { hikerId, cost } of moveAllCost(state, mover.id, action.toTileId, action.bring) ??
    []) {
    const h = findHiker(state, hikerId);
    const why = h && moraleCostReason(h, cost.morale);
    if (why) return why;
  }
  return undefined;
}

export function applyMoveAll(state: GameState, action: MoveAllAction): void {
  const mover = mustFindHiker(state, action.hikerId);
  const line = lineBetween(state.section, mover.tileId, action.toTileId);
  const costs = moveAllCost(state, mover.id, action.toTileId, action.bring);
  if (!line || !costs) throw new Error('applyMoveAll: not adjacent');

  const from = mover.tileId;
  const group = [mover, ...action.bring.map((id) => mustFindHiker(state, id))];
  for (const h of group) {
    h.cameFrom = from;
    h.tileId = action.toTileId;
    h.acted = true;
  }
  const revealed = enterTile(state, action.toTileId);
  pushEvent(state, {
    kind: 'move',
    hikerId: mover.id,
    from,
    to: action.toTileId,
    brought: [...action.bring],
    ...(revealed.length ? { revealed } : {}),
  });
  for (const { hikerId, cost } of costs) {
    payCost(
      state,
      mustFindHiker(state, hikerId),
      cost,
      hikerId === mover.id ? 'Move All' : 'Moved with the group',
    );
  }
  for (const h of group) {
    fireMove(state, h, {
      from,
      to: action.toTileId,
      role: h === mover ? 'actor' : 'brought',
      line,
    });
  }
}
