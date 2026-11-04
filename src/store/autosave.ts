/**
 * One autosave slot in the browser (localStorage). Every storage call is
 * wrapped in try/catch: private windows, full storage or blocked site data
 * must never crash the game.
 */
import { deserialize, serialize, type GameState, type LoadResult } from '../engine';

/** The parts of localStorage the game uses, so tests can pass an in-memory version. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const AUTOSAVE_KEY = 'hike-in-the-woods/autosave';

/** The browser's localStorage, or undefined when it isn't available. */
export function browserStorage(): StorageLike | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function loadAutosave(storage: StorageLike | undefined): LoadResult {
  if (!storage) return { ok: false, reason: 'empty' };
  let text: string | null;
  try {
    text = storage.getItem(AUTOSAVE_KEY);
  } catch {
    return { ok: false, reason: 'empty' };
  }
  return deserialize(text);
}

/** Saves the game. Returns false when the browser refused. */
export function writeAutosave(storage: StorageLike | undefined, state: GameState): boolean {
  if (!storage) return false;
  try {
    storage.setItem(AUTOSAVE_KEY, serialize(state));
    return true;
  } catch {
    return false;
  }
}
