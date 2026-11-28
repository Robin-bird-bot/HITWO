/**
 * The party's level in the top bar (Phase 10.7): "PARTY LV 3", a small bar
 * to the next level, and a "2 POINTS" badge while there are points to spend.
 * It shows the bar as of the last night camp recap, so a level-up is the
 * night's surprise (35-ui-overhaul.md, section 7). A click opens the hiker
 * picker.
 */
import type { CSSProperties } from 'react';
import type { GameState } from '../../engine';
import { pointsWords, shownProgress } from './partyProgress';
import styles from './Trails.module.css';

export function PartyLevel({
  state,
  onOpen,
  style,
}: {
  state: GameState;
  onOpen(): void;
  style: CSSProperties;
}) {
  const { level, points, fill } = shownProgress(state);
  return (
    <button
      type="button"
      className={styles.partyPill}
      style={style}
      onClick={onOpen}
      aria-label={`Party level ${level}.${points ? ` ${pointsWords(points)}.` : ''} Open the skill trails.`}
    >
      <span className={styles.partyWord}>PARTY LV {level}</span>
      <span className={styles.partyTrack}>
        <span style={{ width: `${fill * 100}%` }} />
      </span>
      {points > 0 && (
        <span className={styles.partyPoints}>
          {points} POINT{points === 1 ? '' : 'S'}
        </span>
      )}
    </button>
  );
}
