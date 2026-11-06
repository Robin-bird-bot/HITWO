/**
 * The countdown chips (BUILD_PLAN Phase 5, "Trials"): one orange chip per
 * Trial in progress, near the day bar in both modes, with its name and time
 * left. Clicking one reopens the Trial's details.
 */
import type { CSSProperties } from 'react';
import { CARDS } from '../../content';
import { timeLeft, type GameState } from '../../engine';
import { Icon } from '../icons/Icon';
import styles from './TrialWindow.module.css';

export function TrialChips({
  state,
  style,
  onOpen,
}: {
  state: GameState;
  style: CSSProperties;
  onOpen(uid: string): void;
}) {
  if (!state.trials?.length) return null;
  return (
    <div className={styles.chips} style={style}>
      {state.trials.map((t) => {
        const name = CARDS[t.cardId]?.name ?? 'Trial';
        const time = timeLeft(state, t);
        return (
          <button
            key={t.uid}
            type="button"
            className={styles.chip}
            aria-label={`Trial: ${name}, ${time.toLowerCase()}. Show its details`}
            onClick={() => onOpen(t.uid)}
          >
            <Icon name="sign" size={16} strokeWidth={2.5} />
            {name.toUpperCase()}
            <span className={styles.chipTime}>{time}</span>
          </button>
        );
      })}
    </div>
  );
}
