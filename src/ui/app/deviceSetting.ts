/**
 * A choice remembered on this device (localStorage, with try/catch), outside
 * any hike: the selection screen's sort, debug toggles. Reading or writing
 * never throws; when storage is off, the choice lasts until the page reloads.
 */
import { useSyncExternalStore } from 'react';
import type { StorageLike } from '../../store/autosave';

export interface DeviceSetting<T extends string> {
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

export function deviceSetting<T extends string>(
  key: string,
  values: readonly T[],
  fallback: T,
): DeviceSetting<T> {
  let value: T | null = null;
  const listeners = new Set<() => void>();
  const setting: DeviceSetting<T> = {
    key,
    read(storage) {
      try {
        const stored = storage?.getItem(key);
        return values.find((v) => v === stored) ?? fallback;
      } catch {
        return fallback;
      }
    },
    write(storage, next) {
      try {
        storage?.setItem(key, next);
      } catch {
        // Not remembered this time; the screen still changes.
      }
    },
    get() {
      value ??= setting.read(browserStorage());
      return value;
    },
    set(next) {
      value = next;
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

/** The setting's value, re-rendering when it changes. */
export function useDeviceSetting<T extends string>(setting: DeviceSetting<T>): T {
  return useSyncExternalStore(setting.subscribe, setting.get, setting.get);
}
