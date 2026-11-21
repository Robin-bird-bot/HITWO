/**
 * Tactical (Phase 10a): at the start of each biome, the player picks a tile
 * whose nodes and card are shown for the rest of the biome. Picking no tile
 * skips it for this biome.
 */
import { pushEvent } from '../log';
import { revealAhead, tilesAhead } from '../traits/reveal';
import type { Action, GameState } from '../types';
import { findHiker } from './common';

type TacticalAction = Extract<Action, { type: 'tactical' }>;

export function validateTactical(state: GameState, action: TacticalAction): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  if (!hiker) return 'That hiker isn’t in the party.';
  if (!state.tacticalPicks?.includes(hiker.id)) return `${hiker.name} has no tile to pick.`;
  if (action.tileId === undefined) return undefined;
  if (!tilesAhead(state).includes(action.tileId)) return 'Pick a tile nobody has reached.';
  return undefined;
}

export function applyTactical(state: GameState, action: TacticalAction): void {
  const rest = (state.tacticalPicks ?? []).filter((id) => id !== action.hikerId);
  if (rest.length) state.tacticalPicks = rest;
  else delete state.tacticalPicks;
  if (action.tileId === undefined) return;
  const hiker = findHiker(state, action.hikerId);
  revealAhead(state, action.tileId, 'Tactical');
  if (hiker) {
    pushEvent(state, {
      kind: 'trait',
      hikerId: hiker.id,
      trait: 'Tactical',
      text: `${hiker.name} scouted a tile ahead.`,
    });
  }
}
