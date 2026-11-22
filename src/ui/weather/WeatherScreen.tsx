/**
 * The weather change screen (docs/mockups/Weather.dc.html). Not a pop-up: the
 * whole screen blurs, and the icon, name, what it does and Ready sit on the blur.
 *
 * - The animated icon plays once and holds its last frame (WeatherIcon).
 * - The name, how many days it lasts, then one line (Phase 10.6): "Rain: more
 *   River resources."
 * - Back to Clear shows the sun, "CLEAR SKIES" and nothing else changes.
 */
import { useEffect, useRef } from 'react';
import { ASSETS } from '../../config/assets';
import { WEATHERS } from '../../content/weather';
import type { WeatherId } from '../../engine';
import { WeatherIcon } from './WeatherIcon';
import styles from './WeatherScreen.module.css';

export function WeatherScreen({
  weather,
  days,
  onReady,
}: {
  weather: WeatherId;
  /** How many days it lasts, as far as the forecast shows. */
  days: number;
  onReady(): void;
}) {
  const ready = useRef<HTMLButtonElement>(null);
  useEffect(() => ready.current?.focus(), []);
  const def = WEATHERS[weather];

  return (
    <div
      className={styles.screen}
      role="dialog"
      aria-modal="true"
      aria-label={`The weather changed: ${def.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onReady();
      }}
    >
      <div className={styles.blur} aria-hidden="true" />
      <div className={styles.content}>
        <WeatherIcon weather={weather} />
        <h2 className={styles.name}>{def.title.toUpperCase()}</h2>
        <span className={styles.days}>
          {days === 1 ? 'FOR TODAY' : `FOR THE NEXT ${days} DAYS`}
        </span>
        {def.node ? (
          <div className={styles.effects}>
            <div className={styles.effect}>
              <span className={styles.art}>
                <img src={ASSETS.nodes[def.node]} alt="" />
              </span>
              <div className={styles.words}>
                <span className={styles.effectText}>{def.line}</span>
              </div>
            </div>
          </div>
        ) : (
          <p className={styles.calm}>Nothing changes. A good day to hike.</p>
        )}
        <button ref={ready} type="button" className={styles.ready} onClick={onReady}>
          READY
        </button>
      </div>
    </div>
  );
}
