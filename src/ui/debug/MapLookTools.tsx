/**
 * The debug panel's illustrated-map tools (Phase 10.5, section 11): the style,
 * a new land seed, reveal all or none, replaying a reveal, the land-type,
 * height and mask views, the generation time, forced night and weather, the
 * route view, stamp boxes, and a forced failure. Every one only changes the
 * look; none touches the game state.
 */
import { useState } from 'react';
import type { GameState } from '../../engine';
import { failNextLand, redrawLand, useLandTimings } from '../map/illustrated/landService';
import { revealedTiles } from '../map/illustrated/land/mask';
import {
  resetMapDebug,
  setMapDebug,
  useMapDebug,
  type MapDebug,
} from '../map/illustrated/mapDebug';
import { MAP_STYLES, MAP_STYLE_SETTING, useMapStyle } from '../map/mapStyleSetting';
import styles from './DebugPanel.module.css';

const VIEWS: { id: NonNullable<MapDebug['view']>; label: string }[] = [
  { id: 'land', label: 'Land' },
  { id: 'mask', label: 'Mask' },
  { id: 'type', label: 'Land types' },
  { id: 'height', label: 'Height' },
];

const WEATHER = [
  { id: undefined, label: 'Game weather' },
  { id: 'clear', label: 'Clear' },
  { id: 'rain', label: 'Rain' },
  { id: 'storm', label: 'Storm' },
  { id: 'snow', label: 'Snow' },
  { id: 'heatwave', label: 'Heat' },
] as const;

export function MapLookTools({ state }: { state: GameState }) {
  const style = useMapStyle();
  const d = useMapDebug();
  const timings = useLandTimings();
  const revealed = revealedTiles(state.section);
  const [tile, setTile] = useState(revealed[0] ?? '');
  const toggle = (on: boolean) => (on ? true : undefined);
  const grade = d.grade ?? {};
  return (
    <section className={styles.group}>
      <h3 className={styles.heading}>Map look</h3>
      <div className={styles.row}>
        {MAP_STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={styles.button}
            aria-pressed={style === s.id}
            onClick={() => MAP_STYLE_SETTING.set(s.id)}
          >
            {s.label}
          </button>
        ))}
        <span className={styles.note}>
          {timings
            ? `Drawn in ${Math.round(timings.land + timings.features + timings.paint)} ms (land ${Math.round(timings.land)}, features ${Math.round(timings.features)}, paint ${Math.round(timings.paint)})`
            : 'Not drawn yet'}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.note}>Land seed {d.seed ?? state.seed}</span>
        <button
          type="button"
          className={styles.button}
          onClick={() => setMapDebug({ seed: (d.seed ?? state.seed) + 1 })}
        >
          New land seed
        </button>
        <button
          type="button"
          className={styles.button}
          disabled={d.seed === undefined}
          onClick={() => setMapDebug({ seed: undefined })}
        >
          Run’s seed
        </button>
      </div>
      <div className={styles.row}>
        <span className={styles.note}>Paint:</span>
        {(
          [
            [undefined, 'As revealed'],
            ['all', 'Reveal all'],
            ['none', 'Hide all'],
          ] as const
        ).map(([reveal, label]) => (
          <button
            key={label}
            type="button"
            className={styles.button}
            aria-pressed={d.reveal === reveal}
            onClick={() => setMapDebug({ reveal })}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <select
          className={styles.button}
          aria-label="Tile to replay"
          value={tile}
          onChange={(e) => setTile(e.target.value)}
        >
          {revealed.map((id) => (
            <option key={id} value={id}>
              {id}
              {id === state.section.trailheadId ? ' (trailhead)' : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.button}
          disabled={!tile}
          onClick={() => setMapDebug({ replay: { tileId: tile, at: performance.now() } })}
        >
          Replay its reveal
        </button>
      </div>
      <div className={styles.row}>
        <span className={styles.note}>View:</span>
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={styles.button}
            aria-pressed={(d.view ?? 'land') === v.id}
            onClick={() => setMapDebug({ view: v.id === 'land' ? undefined : v.id })}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.button}
          aria-pressed={grade.night === true}
          onClick={() =>
            setMapDebug({ grade: { ...grade, night: grade.night ? undefined : true } })
          }
        >
          Force night
        </button>
        {WEATHER.map((w) => (
          <button
            key={w.label}
            type="button"
            className={styles.button}
            aria-pressed={grade.weather === w.id}
            onClick={() => setMapDebug({ grade: { ...grade, weather: w.id } })}
          >
            {w.label}
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.button}
          aria-pressed={!!d.routes}
          onClick={() => setMapDebug({ routes: toggle(!d.routes) })}
        >
          Route view
        </button>
        <button
          type="button"
          className={styles.button}
          aria-pressed={!!d.stampBoxes}
          onClick={() => setMapDebug({ stampBoxes: toggle(!d.stampBoxes) })}
        >
          Stamp boxes
        </button>
        <button type="button" className={styles.button} onClick={redrawLand}>
          Draw again
        </button>
        <button
          type="button"
          className={styles.button}
          title="The next drawing fails, so this section uses the classic map with a note"
          onClick={() => {
            failNextLand();
            redrawLand();
          }}
        >
          Fail the drawing
        </button>
        <button type="button" className={styles.button} onClick={resetMapDebug}>
          Reset these
        </button>
      </div>
    </section>
  );
}
