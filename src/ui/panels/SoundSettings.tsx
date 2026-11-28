/**
 * Settings → Sound (32-audio-system.md, section 3): a slider for Master,
 * Music, Ambience and Sound effects, and a Mute switch. Dragging the Sound
 * effects slider plays a tick at the new level, so you hear it.
 */
import { sfx } from '../../audio/engine';
import {
  MUTE_SETTING,
  VOLUMES,
  VOLUME_SETTINGS,
  useMuted,
  useVolume,
  type VolumeId,
} from '../../audio/settings';
import styles from './SoundSettings.module.css';
import top from './TopBar.module.css';

function VolumeSlider({ id, label }: { id: VolumeId; label: string }) {
  const percent = Math.round(useVolume(id) * 100);
  return (
    <label className={styles.slider}>
      <span className={styles.name}>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={percent}
        aria-valuetext={`${percent}%`}
        onChange={(e) => {
          VOLUME_SETTINGS[id].set(Number(e.target.value) / 100);
          if (id === 'effects') sfx('ui.slider');
        }}
      />
      <span className={styles.value}>{percent}</span>
    </label>
  );
}

export function SoundSettings() {
  const muted = useMuted();
  return (
    <div className={top.setting}>
      <span className={top.settingName}>Sound</span>
      <div className={styles.sliders} data-muted={muted}>
        {VOLUMES.map((v) => (
          <VolumeSlider key={v.id} id={v.id} label={v.label} />
        ))}
      </div>
      <label className={top.switchRow}>
        <input
          type="checkbox"
          checked={muted}
          onChange={(e) => MUTE_SETTING.set(e.target.checked ? 'on' : 'off')}
        />
        <span>Mute</span>
      </label>
    </div>
  );
}
