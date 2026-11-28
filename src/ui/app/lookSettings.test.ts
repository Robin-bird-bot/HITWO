import { describe, expect, it } from 'vitest';
import type { StorageLike } from '../../store/autosave';
import {
  ACTIONS_SETTING,
  CRAFTING_LOOK_SETTING,
  LOADING_LOOK_SETTING,
  LOOK_SETTINGS,
  SCAVENGE_REVEAL_SETTING,
} from './lookSettings';

const storage = (values: Record<string, string>): StorageLike => ({
  getItem: (k) => values[k] ?? null,
  setItem: (k, v) => {
    values[k] = v;
  },
  removeItem: (k) => {
    delete values[k];
  },
});

describe('the four look settings (35-ui-overhaul.md, section 1)', () => {
  it('start at Wyatt’s defaults', () => {
    const empty = storage({});
    expect(ACTIONS_SETTING.read(empty)).toBe('wheel');
    expect(SCAVENGE_REVEAL_SETTING.read(empty)).toBe('deal');
    expect(CRAFTING_LOOK_SETTING.read(empty)).toBe('paper');
    expect(LOADING_LOOK_SETTING.read(empty)).toBe('runner');
  });

  it('read what was stored, and fall back on a bad value', () => {
    const values: Record<string, string> = {};
    const s = storage(values);
    ACTIONS_SETTING.write(s, 'grid');
    SCAVENGE_REVEAL_SETTING.write(s, 'brush');
    CRAFTING_LOOK_SETTING.write(s, 'trailmate');
    LOADING_LOOK_SETTING.write(s, 'nodeWheel');
    expect(ACTIONS_SETTING.read(s)).toBe('grid');
    expect(SCAVENGE_REVEAL_SETTING.read(s)).toBe('brush');
    expect(CRAFTING_LOOK_SETTING.read(s)).toBe('trailmate');
    expect(LOADING_LOOK_SETTING.read(s)).toBe('nodeWheel');
    for (const look of LOOK_SETTINGS) {
      values[look.setting.key] = 'sideways';
      expect(look.setting.read(s)).toBe(look.choices[0]?.id);
    }
  });

  it('each have their own key and two choices', () => {
    expect(new Set(LOOK_SETTINGS.map((l) => l.setting.key)).size).toBe(4);
    for (const l of LOOK_SETTINGS) expect(l.choices).toHaveLength(2);
  });
});
