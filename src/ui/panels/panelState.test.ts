import { describe, expect, it } from 'vitest';
import type { StorageLike } from '../../store/autosave';
import { PANEL_KEY, readCollapsed, writeCollapsed } from './panelState';

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

describe('collapsed panels', () => {
  it('start with only the trail log shrunk, as in the mockup', () => {
    expect([...readCollapsed(memory())]).toEqual(['log']);
  });

  it('are remembered across reloads', () => {
    const storage = memory();
    writeCollapsed(storage, new Set(['party', 'objective']));
    expect(storage.data.get(PANEL_KEY)).toBe('["objective","party"]');
    expect(readCollapsed(storage)).toEqual(new Set(['party', 'objective']));
  });

  it('survive storage that throws or holds junk', () => {
    expect(() => writeCollapsed(broken, new Set(['party']))).not.toThrow();
    expect([...readCollapsed(broken)]).toEqual(['log']);
    const junk = memory();
    junk.setItem(PANEL_KEY, '{nope');
    expect([...readCollapsed(junk)]).toEqual(['log']);
  });
});
