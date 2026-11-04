import { describe, expect, it, vi } from 'vitest';
import { serialize } from '../engine';
import { fixtureGame } from '../engine/test/fixtures';
import { AUTOSAVE_KEY, browserStorage, type StorageLike } from './autosave';
import { createGameStore } from './gameStore';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: StorageLike & { writes: number } = {
    writes: 0,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      storage.writes += 1;
      data.set(key, value);
    },
    removeItem: (key) => void data.delete(key),
  };
  return storage;
}

const throwingStorage: StorageLike = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

const MOVE = { type: 'move', hikerId: 'ash', toTileId: 'L' } as const;

describe('game store', () => {
  it('starts empty when there is no autosave', () => {
    const store = createGameStore({ storage: memoryStorage() });
    expect(store.getState()).toBeNull();
    expect(store.loadProblem).toBeNull();
    expect(store.dispatch(MOVE)).toEqual({ ok: false, reason: 'There’s no hike in progress.' });
  });

  it('saves after a new game and after every action, and loads it on start', () => {
    const storage = memoryStorage();
    const store = createGameStore({ storage });
    store.newGame(fixtureGame());
    expect(storage.writes).toBe(1);
    expect(store.dispatch(MOVE)).toEqual({ ok: true });
    expect(storage.writes).toBe(2);

    const reopened = createGameStore({ storage });
    expect(reopened.getState()).toEqual(store.getState());
    expect(reopened.getState()?.hikers[0]?.tileId).toBe('L');
  });

  it('returns the reason for an action that isn’t allowed, and changes nothing', () => {
    const storage = memoryStorage();
    const store = createGameStore({ storage });
    store.newGame(fixtureGame());
    const before = store.getState();
    const result = store.dispatch({ type: 'move', hikerId: 'ash', toTileId: 'C' });
    expect(result).toEqual({ ok: false, reason: 'That tile isn’t connected to this one.' });
    expect(store.getState()).toBe(before);
    expect(storage.writes).toBe(1);
  });

  it('tells subscribers about each change', () => {
    const store = createGameStore({ storage: memoryStorage() });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.newGame(fixtureGame());
    store.dispatch(MOVE);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.dispatch({ type: 'endPhase' });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('discards a corrupt autosave without crashing', () => {
    const store = createGameStore({ storage: memoryStorage({ [AUTOSAVE_KEY]: '{oops' }) });
    expect(store.getState()).toBeNull();
    expect(store.loadProblem).toBe('corrupt');
  });

  it('discards a save from a newer version', () => {
    const newer = serialize({ ...fixtureGame(), saveVersion: 999 });
    const store = createGameStore({ storage: memoryStorage({ [AUTOSAVE_KEY]: newer }) });
    expect(store.getState()).toBeNull();
    expect(store.loadProblem).toBe('tooNew');
  });

  it('keeps playing when the browser refuses storage', () => {
    const store = createGameStore({ storage: throwingStorage });
    store.newGame(fixtureGame());
    expect(store.lastSaveFailed()).toBe(true);
    expect(store.dispatch(MOVE)).toEqual({ ok: true });
    expect(store.getState()?.hikers[0]?.tileId).toBe('L');
  });

  it('works with no storage at all', () => {
    expect(browserStorage()).toBeUndefined(); // Node has no window.localStorage
    const store = createGameStore({ storage: undefined });
    store.newGame(fixtureGame());
    expect(store.dispatch(MOVE)).toEqual({ ok: true });
  });
});
