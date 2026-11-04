/**
 * How much the screen shows: "simple" (the default) keeps only what's needed
 * to play; "informative" shows every number and label. One setting for the
 * whole game, remembered on this device (localStorage, with try/catch).
 */
import { useSyncExternalStore } from 'react';
import type { StorageLike } from '../../store/autosave';

export type UiMode = 'simple' | 'informative';

export const UI_MODE_KEY = 'hike-in-the-woods/ui-mode';
export const DEFAULT_UI_MODE: UiMode = 'simple';

export function readUiMode(storage: StorageLike | undefined): UiMode {
  try {
    const value = storage?.getItem(UI_MODE_KEY);
    return value === 'informative' || value === 'simple' ? value : DEFAULT_UI_MODE;
  } catch {
    return DEFAULT_UI_MODE;
  }
}

export function writeUiMode(storage: StorageLike | undefined, mode: UiMode): void {
  try {
    storage?.setItem(UI_MODE_KEY, mode);
  } catch {
    // Not remembered this time; the screen still switches.
  }
}

function browserStorage(): StorageLike | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

let mode: UiMode | null = null;
const listeners = new Set<() => void>();

function current(): UiMode {
  mode ??= readUiMode(browserStorage());
  return mode;
}

export function setUiMode(next: UiMode): void {
  mode = next;
  writeUiMode(browserStorage(), next);
  for (const l of listeners) l();
}

/** The current screen mode, re-rendering when it changes. */
export function useUiMode(): UiMode {
  return useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, current);
}
