/**
 * Where the run clock is kept (29-core-loop.md, section 9): one record, for
 * the run being played, in localStorage. The game screen updates it every
 * second; the debug panel reads it.
 */
import { useSyncExternalStore } from 'react';
import type { StorageLike } from '../../store/autosave';
import type { RunClock } from './runClock';

export const RUN_CLOCK_KEY = 'hike-in-the-woods/run-clock';

/** A kept clock, or null when there's none (or it can't be read). */
function read(storage: StorageLike | undefined): RunClock | null {
  try {
    const raw = storage?.getItem(RUN_CLOCK_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<RunClock>;
    if (typeof c.seed !== 'number' || typeof c.totalSec !== 'number') return null;
    if (!Array.isArray(c.sections) || !Array.isArray(c.minigames)) return null;
    return c as RunClock;
  } catch {
    return null;
  }
}

export class RunClockStore {
  private clock: RunClock | null;
  private readonly storage: StorageLike | undefined;
  private readonly listeners = new Set<() => void>();

  constructor(storage: StorageLike | undefined) {
    this.storage = storage;
    this.clock = read(storage);
  }

  get = (): RunClock | null => this.clock;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set(clock: RunClock): void {
    this.clock = clock;
    try {
      this.storage?.setItem(RUN_CLOCK_KEY, JSON.stringify(clock));
    } catch {
      // Storage full or blocked: the clock still runs for this visit.
    }
    for (const l of this.listeners) l();
  }
}

export const runClockStore = new RunClockStore(
  typeof localStorage === 'undefined' ? undefined : localStorage,
);

/** The run clock, kept up to date (the debug panel). */
export const useRunClockValue = (): RunClock | null =>
  useSyncExternalStore(runClockStore.subscribe, runClockStore.get);
