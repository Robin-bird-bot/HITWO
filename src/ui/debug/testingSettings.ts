/**
 * Settings → Testing (25-challenges-on-the-map.md, section 3.2), shown only
 * with the debug tools on (the dev server, or `?debug`). Remembered on this
 * device, not per run.
 *
 * - **Auto-pass minigames:** a minigame challenge passes everyone without playing.
 * - **Show placed cards:** every tile shows its placed card on the map.
 *
 * Minigames only is in the run's state instead: it changes which cards are placed.
 */
import { deviceSetting, useDeviceSetting } from '../app/deviceSetting';
import { debugEnabled } from './debugEnabled';

export const AUTO_PASS_SETTING = deviceSetting<'on' | 'off'>(
  'hike-in-the-woods/test-auto-pass',
  ['on', 'off'],
  'off',
);

export const SHOW_PLACED_SETTING = deviceSetting<'on' | 'off'>(
  'hike-in-the-woods/test-show-placed',
  ['on', 'off'],
  'off',
);

/**
 * Skip packing (27-packing-screen.md, section 1): hiker select's Start packs
 * at random and goes straight to the hike.
 */
export const SKIP_PACKING_SETTING = deviceSetting<'on' | 'off'>(
  'hike-in-the-woods/test-skip-packing',
  ['on', 'off'],
  'off',
);

/** Skip packing is on (and the debug tools are). */
export function useSkipPacking(): boolean {
  const on = useDeviceSetting(SKIP_PACKING_SETTING) === 'on';
  return on && debugEnabled();
}

/** Auto-pass minigames is on (and the debug tools are). */
export function useAutoPass(): boolean {
  const on = useDeviceSetting(AUTO_PASS_SETTING) === 'on';
  return on && debugEnabled();
}

/** Show placed cards is on (and the debug tools are). */
export function useShowPlaced(): boolean {
  const on = useDeviceSetting(SHOW_PLACED_SETTING) === 'on';
  return on && debugEnabled();
}
