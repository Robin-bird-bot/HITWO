/**
 * Settings → Sound (32-audio-system.md, section 3): Master, Music, Ambience
 * and Sound effects sliders, and a Mute switch, remembered on this device
 * like the other look settings. The Sound effects slider sets the ui, sfx
 * and minigame buses. The packing screen's sound button is the same Mute.
 */
import { BALANCE } from '../config/balance';
import {
  deviceNumber,
  deviceSetting,
  useDeviceSetting,
  type DeviceSetting,
} from '../ui/app/deviceSetting';
import { audio } from './engine';

const D = BALANCE.audio.defaults;

export type VolumeId = 'master' | 'music' | 'ambience' | 'effects';

export const VOLUMES: readonly { id: VolumeId; label: string }[] = [
  { id: 'master', label: 'Master' },
  { id: 'music', label: 'Music' },
  { id: 'ambience', label: 'Ambience' },
  { id: 'effects', label: 'Sound effects' },
];

export const VOLUME_SETTINGS: Record<VolumeId, DeviceSetting<number>> = {
  master: deviceNumber('hike-in-the-woods/volume-master', D.master),
  music: deviceNumber('hike-in-the-woods/volume-music', D.music),
  ambience: deviceNumber('hike-in-the-woods/volume-ambience', D.ambience),
  effects: deviceNumber('hike-in-the-woods/volume-effects', D.effects),
};

export const MUTE_SETTING = deviceSetting<'on' | 'off'>(
  'hike-in-the-woods/sound-mute',
  ['on', 'off'],
  'off',
);

export const useVolume = (id: VolumeId): number => useDeviceSetting(VOLUME_SETTINGS[id]);
export const useMuted = (): boolean => useDeviceSetting(MUTE_SETTING) === 'on';

/** Hands the stored levels to the engine now and whenever one changes. */
export function followSoundSettings(): void {
  const apply = () =>
    audio.setLevels({
      master: VOLUME_SETTINGS.master.get(),
      music: VOLUME_SETTINGS.music.get(),
      ambience: VOLUME_SETTINGS.ambience.get(),
      effects: VOLUME_SETTINGS.effects.get(),
      muted: MUTE_SETTING.get() === 'on',
    });
  apply();
  for (const s of Object.values(VOLUME_SETTINGS)) s.subscribe(apply);
  MUTE_SETTING.subscribe(apply);
}
