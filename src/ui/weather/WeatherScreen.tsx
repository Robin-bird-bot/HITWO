/**
 * The weather change screen (docs/mockups/Weather.dc.html). Not a pop-up: the
 * whole screen blurs, and the icon, name, effects and Ready sit on the blur.
 *
 * - The animated icon plays once and holds its last frame (WeatherIcon).
 * - The name, how many days it lasts, then its two effects: the hikers' one
 *   "from tomorrow" (the grace day) and the nodes' one "starts now".
 * - Back to Clear shows the sun, "CLEAR SKIES" and no effects.
 */
import { useEffect, useRef } from 'react';
import { WEATHERS } from '../../content/weather';
import type { WeatherId } from '../../engine';
import { Icon } from '../icons/Icon';
import { WeatherIcon } from './WeatherIcon';
import { HIKER_EFFECT_ICON, NODE_EFFECT_ART } from './weatherLook';
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
  const node = def.node && NODE_EFFECT_ART[def.node.kind];

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
        {(def.hiker || def.node) && (
          <div className={styles.effects}>
            {def.hiker && (
              <div className={styles.effect}>
                <span className={styles.art}>
                  <Icon name={HIKER_EFFECT_ICON[def.hiker.kind]} size={30} strokeWidth={2.5} />
                </span>
                <div className={styles.words}>
                  <span className={styles.effectHead}>
                    <span className={styles.effectName}>{def.hiker.name.toUpperCase()}</span>
                    <span className={styles.when}>FROM TOMORROW</span>
                  </span>
                  <span className={styles.effectText}>{def.hiker.text}</span>
                </div>
              </div>
            )}
            {def.node && (
              <div className={styles.effect}>
                <span className={styles.art}>
                  {node?.image ? (
                    <img src={node.image} alt="" />
                  ) : (
                    <Icon name={node?.icon ?? 'cloud'} size={30} strokeWidth={2.5} />
                  )}
                </span>
                <div className={styles.words}>
                  <span className={styles.effectHead}>
                    <span className={styles.effectName}>{def.node.name.toUpperCase()}</span>
                    <span className={styles.when}>STARTS NOW</span>
                  </span>
                  <span className={styles.effectText}>{def.node.text}</span>
                </div>
              </div>
            )}
          </div>
        )}
        {!def.hiker && !def.node && (
          <p className={styles.calm}>No weather effects. A good day to hike.</p>
        )}
        <button ref={ready} type="button" className={styles.ready} onClick={onReady}>
          READY
        </button>
      </div>
    </div>
  );
}
