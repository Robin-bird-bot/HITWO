/**
 * Settings → Map style (Phase 10.5): Classic or Illustrated, remembered on
 * this device (not per run). It only changes how the map is drawn, so it can
 * be switched at any time, mid-run included.
 */
import { MAP_STYLE } from '../../config/mapStyle';
import { deviceSetting, useDeviceSetting } from '../app/deviceSetting';

export type MapStyle = 'classic' | 'illustrated';

export const MAP_STYLES: readonly { id: MapStyle; label: string; text: string }[] = [
  { id: 'classic', label: 'Classic', text: 'Tiles and lines over the landscape.' },
  {
    id: 'illustrated',
    label: 'Illustrated',
    text: 'A painted trail map that fills in as you explore.',
  },
];

export const MAP_STYLE_SETTING = deviceSetting<MapStyle>(
  'hike-in-the-woods/map-style',
  ['classic', 'illustrated'],
  MAP_STYLE.defaultStyle,
);

/** The map style picked on this device, re-rendering when it changes. */
export const useMapStyle = (): MapStyle => useDeviceSetting(MAP_STYLE_SETTING);

/**
 * The style the map is drawn in: the one picked, except Classic for a section
 * whose illustrated land failed or took too long.
 */
export const shownMapStyle = (picked: MapStyle, land: { status: string }): MapStyle =>
  picked === 'illustrated' && land.status !== 'failed' ? 'illustrated' : 'classic';

/**
 * Settings → Map style → Show whole map (Phase 10.6): Illustrated only, off
 * by default. On, the land is fully painted with every place name shown; tiles,
 * nodes and challenges still follow the normal reveal rules.
 */
export const WHOLE_MAP_SETTING = deviceSetting<'on' | 'off'>(
  'hike-in-the-woods/show-whole-map',
  ['on', 'off'],
  'off',
);

/** Whether Show whole map is on, re-rendering when it changes. */
export const useWholeMap = (): boolean => useDeviceSetting(WHOLE_MAP_SETTING) === 'on';
