/**
 * The run clock in the debug panel (29-core-loop.md, section 9): the run's
 * played time next to its difficulty's target, each section's time, and each
 * minigame challenge's time with its name and tier, the longest first.
 */
import { DEFAULT_DIFFICULTY } from '../../config/difficulty';
import type { GameState } from '../../engine';
import { clockText, longestMinigames, targetText } from '../runClock/runClock';
import { useRunClockValue } from '../runClock/store';
import styles from './DebugPanel.module.css';

const TIER = ['I', 'II', 'III', 'IV', 'V'];

export function DebugRunClock({ state }: { state: GameState }) {
  const clock = useRunClockValue();
  const target = targetText(state.difficulty ?? DEFAULT_DIFFICULTY);
  if (!clock || clock.seed !== state.seed) {
    return <p className={styles.note}>The clock starts with this run.</p>;
  }
  const games = longestMinigames(clock, clock.minigames.length);
  return (
    <>
      <div className={styles.row}>
        <span>
          Played <strong>{clockText(clock.totalSec)}</strong>
          {target ? ` · aim ${target}` : ' · no aim for this difficulty yet'}
          {clock.ended ? ' · run over (summary in the console)' : ''}
        </span>
      </div>
      <div className={styles.row}>
        {clock.sections.map((sec, k) => (
          <span key={k} className={styles.note}>
            Section {k + 1}: {clockText(sec)}
          </span>
        ))}
      </div>
      <div className={styles.note}>
        {clock.open && `Playing now: ${clock.open.name}. `}
        {games.length === 0
          ? 'No minigames yet.'
          : `Minigames (${games.length}, longest first): ${games
              .map((m) => `${m.name} ${TIER[m.tier - 1] ?? m.tier} ${clockText(m.sec)}`)
              .join(' · ')}`}
      </div>
    </>
  );
}
