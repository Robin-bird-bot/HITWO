/**
 * A choice remembered on this device (localStorage, with try/catch), outside
 * any hike: the selection screen's sort, debug toggles, the sound levels.
 * Reading or writing never throws; when storage is off, the choice lasts
 * until the page reloads.
 */
import { useSyncExternalStore } from 'react';
import type { StorageLike } from '../../store/autosave';

export interface DeviceSetting<T> {
  readonly key: string;
  /** The stored value, or the fallback when it's missing, unknown or unreadable. */
  read(storage: StorageLike | undefined): T;
  write(storage: StorageLike | undefined, value: T): void;
  get(): T;
  set(value: T): void;
  subscribe(listener: () => void): () => void;
}

function browserStorage(): StorageLike | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** A setting stored as text: `parse` turns the stored text into a value (undefined: use the fallback). */
function storedSetting<T>(
  key: string,
  parse: (stored: string | null | undefined) => T | undefined,
  fallback: T,
): DeviceSetting<T> {
  let value: { current: T } | null = null;
  const listeners = new Set<() => void>();
  const setting: DeviceSetting<T> = {
    key,
    read(storage) {
      try {
        return parse(storage?.getItem(key)) ?? fallback;
      } catch {
        return fallback;
      }
    },
    write(storage, next) {
      try {
        storage?.setItem(key, String(next));
      } catch {
        // Not remembered this time; the screen still changes.
      }
    },
    get() {
      value ??= { current: setting.read(browserStorage()) };
      return value.current;
    },
    set(next) {
      value = { current: next };
      setting.write(browserStorage(), next);
      for (const l of listeners) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return setting;
}

/** One of a few named choices. */
export function deviceSetting<T extends string>(
  key: string,
  values: readonly T[],
  fallback: T,
): DeviceSetting<T> {
  return storedSetting(key, (stored) => values.find((v) => v === stored), fallback);
}

/** A number from `min` to `max` (a volume slider). Anything else stored reads as the fallback. */
export function deviceNumber(
  key: string,
  fallback: number,
  min = 0,
  max = 1,
): DeviceSetting<number> {
  return storedSetting(
    key,
    (stored) => {
      if (stored === null || stored === undefined || stored.trim() === '') return undefined;
      const n = Number(stored);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined;
    },
    fallback,
  );
}

/** The setting's value, re-rendering when it changes. */
export function useDeviceSetting<T>(setting: DeviceSetting<T>): T {
  return useSyncExternalStore(setting.subscribe, setting.get, setting.get);
}
