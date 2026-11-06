/**
 * What just happened, after a card whose outcome is random: a Risk roll, a
 * Challenge space's rewards, or what an opportunity gave. The lines are the
 * trail log's, from the challenge's own line on. Other challenges skip this:
 * their outcome was decided in the pop-up, and they should stay quick.
 */
import { useEffect, useRef } from 'react';
import { CARDS } from '../../content';
import type { GameState } from '../../engine';
import type { ResultToShow } from './showsResult';
import { Icon } from '../icons/Icon';
import { describeLog } from '../log/describeLog';
import styles from './ChallengeResult.module.css';

export function ChallengeResult({
  state,
  result,
  onClose,
}: {
  state: GameState;
  result: ResultToShow;
  onClose(): void;
}) {
  const card = CARDS[result.cardId];
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => ok.current?.focus(), []);
  const lines = describeLog(state, 80).filter((l) => l.id >= result.fromId && l.tone !== 'debug');
  const blue = card?.kind === 'opportunity';
  return (
    <div className={styles.overlay}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={`${card?.name} result`}
      >
        <header className={styles.head} data-kind={blue ? 'opportunity' : 'challenge'}>
          <Icon name={blue ? 'star' : 'dice'} size={20} color="#FFF6EC" strokeWidth={2.5} />
          <h2 className={styles.title}>{card?.name.toUpperCase()}</h2>
        </header>
        <ul className={styles.lines}>
          {lines.flatMap((l) => {
            // The challenge's own line lists every hiker: one line each here.
            const parts = l.tone === 'challenge' ? afterName(l.text).split(' · ') : [l.text];
            return parts.map((part, i) => (
              <li key={`${l.id}-${i}`} data-tone={l.tone}>
                {l.tone === 'challenge' ? `${capitalize(part.replace(/\.$/, ''))}.` : part}
              </li>
            ));
          })}
        </ul>
        <button ref={ok} type="button" className={styles.ok} onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
}

/** "Thin Ice: Hiker 2 was safe · …" → "Hiker 2 was safe · …" (the title already names the card). */
function afterName(text: string): string {
  const at = text.indexOf(': ');
  return at < 0 ? text : text.slice(at + 2);
}

const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
