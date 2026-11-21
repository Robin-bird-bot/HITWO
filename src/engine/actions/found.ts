/**
 * The illustrated map found a named place (Phase 10.5): its paint reached the
 * label's spot for the first time. Only a look: it adds "Found …" to the trail
 * log, once per name, and changes nothing else.
 */
import { pushEvent } from '../log';
import type { Action, GameState } from '../types';

type FoundAction = Extract<Action, { type: 'foundPlace' }>;

export function validateFound(state: GameState, action: FoundAction): string | undefined {
  if (!action.name.trim()) return 'That place has no name.';
  if (state.foundPlaces?.includes(action.name)) return `${action.name} was already found.`;
  return undefined;
}

export function applyFound(state: GameState, action: FoundAction): void {
  state.foundPlaces = [...(state.foundPlaces ?? []), action.name];
  pushEvent(state, { kind: 'found', name: action.name });
}
