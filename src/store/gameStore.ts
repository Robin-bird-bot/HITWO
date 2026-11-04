/**
 * Holds the current game, applies actions and autosaves after each one.
 * The UI reads state and dispatches actions through this (CLAUDE.md rule 1);
 * Phase 3 connects it to React with useSyncExternalStore.
 */
import {
  applyAction,
  validateAction,
  type Action,
  type GameState,
  type LoadFailure,
} from '../engine';
import { loadAutosave, writeAutosave, type StorageLike } from './autosave';

export type DispatchResult = { ok: true } | { ok: false; reason: string };

export interface GameStore {
  /** The game in progress, or null before one starts. */
  getState(): GameState | null;
  /** Why the autosave couldn't be loaded at start-up, if there was one that couldn't. */
  readonly loadProblem: LoadFailure | null;
  /** True when the browser refused the most recent save. */
  lastSaveFailed(): boolean;
  dispatch(action: Action): DispatchResult;
  /** Starts a new game, replacing the autosave. */
  newGame(state: GameState): void;
  subscribe(listener: () => void): () => void;
}

export function createGameStore({ storage }: { storage: StorageLike | undefined }): GameStore {
  const loaded = loadAutosave(storage);
  let state: GameState | null = loaded.ok ? loaded.state : null;
  let saveFailed = false;
  const listeners = new Set<() => void>();

  const commit = (next: GameState) => {
    state = next;
    saveFailed = !writeAutosave(storage, next);
    for (const listener of listeners) listener();
  };

  return {
    getState: () => state,
    loadProblem: !loaded.ok && loaded.reason !== 'empty' ? loaded.reason : null,
    lastSaveFailed: () => saveFailed,
    dispatch(action) {
      if (!state) return { ok: false, reason: 'There’s no hike in progress.' };
      const reason = validateAction(state, action);
      if (reason) return { ok: false, reason };
      commit(applyAction(state, action));
      return { ok: true };
    },
    newGame: commit,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
