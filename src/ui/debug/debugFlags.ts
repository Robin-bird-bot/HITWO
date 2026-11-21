/**
 * Debug-only switches, remembered on this device. They do nothing unless the
 * debug panel is available (the dev server, or ?debug on the live site).
 */
import { deviceSetting, useDeviceSetting } from '../app/deviceSetting';
import { debugEnabled } from './debugEnabled';

/** Each hiker's hidden 1–10 difficulty in their card's corner (selection screen). */
export const SHOW_DIFFICULTY = deviceSetting<'off' | 'on'>(
  'hike-in-the-woods/debug-show-difficulty',
  ['off', 'on'],
  'off',
);

export function useShowDifficulty(): boolean {
  return useDeviceSetting(SHOW_DIFFICULTY) === 'on' && debugEnabled();
}
