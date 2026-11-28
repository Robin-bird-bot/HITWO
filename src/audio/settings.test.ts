import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import type { StorageLike } from '../store/autosave';
import { MUTE_SETTING, VOLUME_SETTINGS } from './settings';

const storage = (values: Record<string, string>): StorageLike => ({
  getItem: (k) => values[k] ?? null,
  setItem: (k, v) => {
    values[k] = v;
  },
  removeItem: (k) => {
    delete values[k];
  },
});

describe('Settings → Sound (32-audio-system.md, section 3)', () => {
  it('starts at the default levels, unmuted', () => {
    const empty = storage({});
    expect(VOLUME_SETTINGS.master.read(empty)).toBe(BALANCE.audio.defaults.master);
    expect(VOLUME_SETTINGS.music.read(empty)).toBe(BALANCE.audio.defaults.music);
    expect(VOLUME_SETTINGS.ambience.read(empty)).toBe(BALANCE.audio.defaults.ambience);
    expect(VOLUME_SETTINGS.effects.read(empty)).toBe(BALANCE.audio.defaults.effects);
    expect(MUTE_SETTING.read(empty)).toBe('off');
  });

  it('remembers a level and the mute, and falls back on a bad value', () => {
    const values: Record<string, string> = {};
    const s = storage(values);
    VOLUME_SETTINGS.music.write(s, 0.35);
    MUTE_SETTING.write(s, 'on');
    expect(VOLUME_SETTINGS.music.read(s)).toBe(0.35);
    expect(MUTE_SETTING.read(s)).toBe('on');

    values[VOLUME_SETTINGS.music.key] = 'loud';
    expect(VOLUME_SETTINGS.music.read(s)).toBe(BALANCE.audio.defaults.music);
    values[VOLUME_SETTINGS.music.key] = '';
    expect(VOLUME_SETTINGS.music.read(s)).toBe(BALANCE.audio.defaults.music);
    values[VOLUME_SETTINGS.music.key] = '3';
    expect(VOLUME_SETTINGS.music.read(s)).toBe(1);
    values[MUTE_SETTING.key] = 'maybe';
    expect(MUTE_SETTING.read(s)).toBe('off');
  });

  it('never throws when storage does', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
    };
    expect(VOLUME_SETTINGS.effects.read(broken)).toBe(BALANCE.audio.defaults.effects);
    expect(() => VOLUME_SETTINGS.effects.write(broken, 0.2)).not.toThrow();
  });
});
