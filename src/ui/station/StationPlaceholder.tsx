/**
 * Everyone has checked in (Phase 9 step 1): a stand-in for the ranger station
 * until its screen is built (step 3). It shows who made it and how.
 */
import { useEffect, useRef } from 'react';
import { ASSETS } from '../../config/assets';
import { characterFor } from '../../content/characters';
import type { GameState, Hiker } from '../../engine';
import styles from '../hike/HikeOverScreen.module.css';

export function StationPlaceholder({ state, onTitle }: { state: GameState; onTitle(): void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  const checkpoint = state.station?.checkpoint ?? state.sectionIndex + 1;
  const here = (state.arrivals ?? []).filter((a) => a.section === state.sectionIndex);
  const how = (h: Hiker) => {
    if (h.status === 'abandoned') return 'Left the hike';
    const arrival = here.find((a) => a.hikerId === h.id);
    if (!arrival) return 'Checked in';
    if (arrival.carried) return 'Carried in';
    return arrival.injuries > 0
      ? `Checked in · ${arrival.injuries} injur${arrival.injuries === 1 ? 'y' : 'ies'}`
      : 'Checked in';
  };
  return (
    <div
      className={styles.screen}
      role="dialog"
      aria-modal="true"
      aria-label={`Ranger station, checkpoint ${checkpoint}`}
    >
      <div className={styles.blur} aria-hidden="true" />
      <div className={styles.content}>
        <span className={styles.kicker}>
          CHECKPOINT {checkpoint} · DAY {state.day}
        </span>
        <h2 className={styles.title}>RANGER STATION</h2>
        <p className={styles.text}>
          Everyone has checked in. The station opens here soon: the shop, the workbench and a free
          night.
        </p>
        <ul className={styles.party}>
          {state.hikers.map((h) => (
            <li key={h.id} className={styles.hiker}>
              <img
                src={ASSETS.portraits.placeholder}
                alt=""
                draggable={false}
                style={{ boxShadow: `0 0 0 3px ${characterFor(h.id).color}` }}
              />
              <span className={styles.name}>{h.name.toUpperCase()}</span>
              <span className={styles.ended} data-status={h.status}>
                {how(h)}
              </span>
            </li>
          ))}
        </ul>
        <div className={styles.buttons}>
          <button ref={first} type="button" className={styles.secondary} onClick={onTitle}>
            BACK TO THE TITLE
          </button>
        </div>
      </div>
    </div>
  );
}
