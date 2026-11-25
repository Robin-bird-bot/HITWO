/**
 * The results card every minigame ends with (docs/design/10-minigames.md,
 * "Results"; 11-minigames-puzzles.md, "Results"): "1 safe, 2 hit" or "2
 * passed, 1 failed", a line per hiker, then Continue and Play again. Laid out
 * on the 1280 × 960 game screen.
 */
import { hikerStatus, resultLine } from '../../minigames/results';
import type { MinigameHiker, MinigameResult } from '../../minigames/types';
import { HikerPortrait } from '../hikers/HikerPortrait';
import styles from './ResultsCard.module.css';

export function ResultsCard({
  result,
  hikers,
  onContinue,
  onPlayAgain,
}: {
  result: MinigameResult;
  /** In the order to list them (the line-up order for the puzzle games). */
  hikers: readonly MinigameHiker[];
  onContinue(): void;
  onPlayAgain(): void;
}) {
  return (
    <div className={styles.results}>
      <div className={styles.card} role="dialog" aria-label="Results">
        <h3 className={styles.cardTitle}>{resultLine(result)}</h3>
        {hikers.map((h) => {
          const status = hikerStatus(result, h.id);
          return (
            <div key={h.id} className={styles.row}>
              <HikerPortrait
                hikerId={h.id}
                className={styles.rowPortrait}
                style={{ boxShadow: `0 0 0 3px ${h.color}` }}
              />
              <span className={styles.rowName}>
                {h.name}
                {result.energy === h.id && <span className={styles.energy}>+1 Energy</span>}
              </span>
              <span className={styles.rowState} data-hit={status.bad || undefined}>
                {status.text}
              </span>
            </div>
          );
        })}
        <div className={styles.cardButtons}>
          <button type="button" className={styles.continue} onClick={onContinue} autoFocus>
            Continue
          </button>
          <button type="button" className={styles.again} onClick={onPlayAgain}>
            Play again
          </button>
        </div>
      </div>
    </div>
  );
}
