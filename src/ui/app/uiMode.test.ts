import { describe, expect, it } from 'vitest';
import type { StorageLike } from '../../store/autosave';
import { DEFAULT_UI_MODE, readUiMode, UI_MODE_KEY, writeUiMode } from './uiMode';

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const broken: StorageLike = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('full');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

describe('the screen mode setting', () => {
  it('defaults to Simple', () => {
    expect(DEFAULT_UI_MODE).toBe('simple');
    expect(readUiMode(memory())).toBe('simple');
    expect(readUiMode(undefined)).toBe('simple');
  });

  it('is remembered across reloads, as one setting for the whole game', () => {
    const storage = memory();
    writeUiMode(storage, 'informative');
    expect(storage.data.get(UI_MODE_KEY)).toBe('informative');
    expect(readUiMode(storage)).toBe('informative');
    writeUiMode(storage, 'simple');
    expect(readUiMode(storage)).toBe('simple');
  });

  it('ignores junk and survives storage that throws', () => {
    const storage = memory();
    storage.setItem(UI_MODE_KEY, 'fancy');
    expect(readUiMode(storage)).toBe('simple');
    expect(readUiMode(broken)).toBe('simple');
    expect(() => writeUiMode(broken, 'informative')).not.toThrow();
  });
});
