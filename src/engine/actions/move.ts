import { revealTile } from '../challenges/reveal';
import { noteArrival } from '../challenges/trials';
import { moveCost } from '../costs';
import { fireMove } from '../effects';
import { pushEvent } from '../log';
import { lineBetween } from '../map';
import type { Action, GameState } from '../types';
import { bringCarried, carryMoveReason } from './carry';
import {
  enterTile,
  findHiker,
  moraleCostReason,
  mustFindHiker,
  payCost,
  phaseActionReason,
  tileEntryReason,
  spendAction,
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
  const entry = tileEntryReason(state, action.toTileId);
  if (entry) return entry;
  const carry = carryMoveReason(state, [hiker]);
  if (carry) return carry;
  return moraleCostReason(hiker, moveCost(state, hiker.id, action.toTileId)?.morale ?? 0);
}

export function applyMove(state: GameState, action: MoveAction): void {
  const hiker = mustFindHiker(state, action.hikerId);
  const line = lineBetween(state.section, hiker.tileId, action.toTileId);
  const cost = moveCost(state, hiker.id, action.toTileId);
  if (!line || !cost) throw new Error('applyMove: not adjacent');

  const from = hiker.tileId;
  const firstHere = !state.section.tiles[action.toTileId]?.visited;
  hiker.cameFrom = from;
  hiker.tileId = action.toTileId;
  // Whoever they carry comes along.
  const carried = bringCarried(state, [hiker], from).map((c) => c.id);
  spendAction(state, hiker);
  const revealed = enterTile(state, hiker.tileId);
  pushEvent(state, {
    kind: 'move',
    hikerId: hiker.id,
    from,
    to: hiker.tileId,
    brought: [],
    ...(carried.length ? { carried } : {}),
    ...(revealed.length ? { revealed } : {}),
  });
  payCost(state, hiker, cost, 'Move');
  fireMove(state, hiker, { from, to: hiker.tileId, role: 'actor', line });
  noteArrival(state, [hiker.id, ...carried], hiker.tileId);
  // The first hiker to land on a tile triggers its card.
  if (firstHere) revealTile(state, hiker.tileId, [hiker.id, ...carried]);
}
