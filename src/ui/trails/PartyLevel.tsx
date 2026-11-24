/**
 * The party's level in the top bar (Phase 10.7): "PARTY LV 3", a small bar
 * to the next level, and "2 points to spend" when there are any. A click
 * opens Skill Trails.
 */
import type { CSSProperties } from 'react';
import type { GameState } from '../../engine';
import { partyProgress, pointsWords } from './partyProgress';
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
  const { level, points, fill } = partyProgress(state);
  return (
    <button
      type="button"
      className={styles.partyPill}
      style={style}
      onClick={onOpen}
      aria-label={`Party level ${level}.${points ? ` ${pointsWords(points)}.` : ''} Open Skill Trails.`}
    >
      <span className={styles.partyWord}>PARTY LV {level}</span>
      <span className={styles.partyTrack}>
        <span style={{ width: `${fill * 100}%` }} />
      </span>
      {points > 0 && <span className={styles.partyPoints}>{pointsWords(points)}</span>}
    </button>
  );
}

/** "Party level 3! +1 point", for a moment after the party levels up. */
export function PartyToast({ text }: { text: string }) {
  return (
    <div className={styles.toast} role="status">
      {text}
    </div>
  );
}
