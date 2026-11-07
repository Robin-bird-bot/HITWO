/**
 * The hike is over (Wyatt, Nov 7): no hiker can act any more, because
 * everyone has passed out or left. Like the weather change screen, the whole
 * screen blurs and the words sit on top: the day reached, where each hiker
 * ended up, and New hike or back to the title. Scoring arrives in Phase 12.
 */
import { useEffect, useRef } from 'react';
import { ASSETS } from '../../config/assets';
import { characterFor } from '../../content/characters';
import type { GameState, Hiker } from '../../engine';
import styles from './HikeOverScreen.module.css';

const ENDED: Record<Hiker['status'], string> = {
  active: 'Still going',
  passedOut: 'Passed out',
  abandoned: 'Left the hike',
  checkedIn: 'Checked in',
};

export function HikeOverScreen({
  state,
  onNewHike,
  onTitle,
}: {
  state: GameState;
  onNewHike?(): void;
  onTitle(): void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <div className={styles.screen} role="dialog" aria-modal="true" aria-label="The hike is over">
      <div className={styles.blur} aria-hidden="true" />
      <div className={styles.content}>
        <span className={styles.kicker}>DAY {state.day}</span>
        <h2 className={styles.title}>THE HIKE IS OVER</h2>
        <p className={styles.text}>No one is left who can keep hiking.</p>
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
                {ENDED[h.status]}
              </span>
            </li>
          ))}
        </ul>
        <div className={styles.buttons}>
          {onNewHike && (
            <button ref={first} type="button" className={styles.primary} onClick={onNewHike}>
              NEW HIKE
            </button>
          )}
          <button
            ref={onNewHike ? undefined : first}
            type="button"
            className={styles.secondary}
            onClick={onTitle}
          >
            TITLE SCREEN
          </button>
        </div>
      </div>
    </div>
  );
}
