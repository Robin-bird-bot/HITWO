/**
 * Trait warnings (Nov 20 update, section 4): how much the screen says about
 * what traits are about to do. "off" says nothing; "simple" (the default)
 * colors the Morale badges and dims traits that aren't working; "informative"
 * also tags portraits and checks before an action or the end of the day that
 * would cost someone Morale. Remembered on this device, like the screen mode.
 */
import { useSyncExternalStore } from 'react';
import type { StorageLike } from '../../store/autosave';

export type TraitWarnings = 'off' | 'simple' | 'informative';

export const TRAIT_WARNINGS_KEY = 'hike-in-the-woods/trait-warnings';
export const DEFAULT_TRAIT_WARNINGS: TraitWarnings = 'simple';

export function readTraitWarnings(storage: StorageLike | undefined): TraitWarnings {
  try {
    const value = storage?.getItem(TRAIT_WARNINGS_KEY);
    return value === 'off' || value === 'simple' || value === 'informative'
      ? value
      : DEFAULT_TRAIT_WARNINGS;
  } catch {
    return DEFAULT_TRAIT_WARNINGS;
  }
}

function browserStorage(): StorageLike | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

let warnings: TraitWarnings | null = null;
const listeners = new Set<() => void>();
const current = () => (warnings ??= readTraitWarnings(browserStorage()));

export function setTraitWarnings(next: TraitWarnings): void {
  warnings = next;
  try {
    browserStorage()?.setItem(TRAIT_WARNINGS_KEY, next);
  } catch {
    // Not remembered this time; the screen still switches.
  }
  for (const l of listeners) l();
}

/** The current setting, re-rendering when it changes. */
export function useTraitWarnings(): TraitWarnings {
  return useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, current);
}

/**
 * "Don't ask again this run": the checks before acting stay quiet for this
 * hike (by its seed), on this device.
 */
const QUIET_KEY = 'hike-in-the-woods/trait-checks-quiet';

export function checksQuiet(seed: number): boolean {
  try {
    return browserStorage()?.getItem(QUIET_KEY) === String(seed);
  } catch {
    return false;
  }
}

export function quietChecks(seed: number): void {
  try {
    browserStorage()?.setItem(QUIET_KEY, String(seed));
  } catch {
    // Not remembered; the checks come back after a reload.
  }
}
