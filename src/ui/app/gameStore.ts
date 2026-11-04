/**
 * The one game store for the app: holds the current game, applies actions
 * and autosaves to this browser after each one (CLAUDE.md rule 1).
 */
import { useSyncExternalStore } from 'react';
import type { GameState } from '../../engine';
import { browserStorage } from '../../store/autosave';
import { createGameStore } from '../../store/gameStore';

export const gameStore = createGameStore({ storage: browserStorage() });

/** The game in progress, re-rendering whenever it changes. */
export function useGame(): GameState | null {
  return useSyncExternalStore(gameStore.subscribe, gameStore.getState);
}
