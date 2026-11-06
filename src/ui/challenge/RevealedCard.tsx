/**
 * A card revealed early (Old Firewatch Tower; Wyatt, Nov 6): a small pop-up with
 * just the banner and the card's text, opened from the icon on its tile. The
 * numbers show as ranges, since they're rolled when someone lands there.
 */
import { useEffect, useRef } from 'react';
import { CARDS } from '../../content';
import type { GameState, TileId } from '../../engine';
import { Icon } from '../icons/Icon';
import { tileName } from '../panels/hikerInfo';
import { cardText } from './cardText';
import styles from './RevealedCard.module.css';

const TIER_WORD = { 1: 'I', 2: 'II', 3: 'III' } as const;

export function RevealedCard({
  state,
  tileId,
  onClose,
}: {
  state: GameState;
  tileId: TileId;
  onClose(): void;
}) {
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => ok.current?.focus(), []);
  const tile = state.section.tiles[tileId];
  const shown = tile?.revealedCard;
  const card = shown && CARDS[shown.cardId];
  if (!tile || !shown || !card) return null;
  const other = shown.alternative ? CARDS[shown.alternative] : undefined;
  const kind =
    card.kind === 'trial' ? 'trial' : card.kind === 'opportunity' ? 'opportunity' : 'challenge';
  const label = kind === 'trial' ? 'TRIAL' : kind === 'opportunity' ? 'OPPORTUNITY' : 'CHALLENGE';
  const opts = { scale: shown.scale };
  const ask = card.kind === 'trial' ? card.goalText : card.costText;
  const outcome = card.kind === 'opportunity' ? (card.rewardText ?? []) : card.penaltyText;

  return (
    <div className={styles.overlay} onPointerDown={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={`${label.toLowerCase()} on ${tileName(tile)}: ${card.name}`}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || e.key === 'Enter') onClose();
        }}
      >
        <header className={styles.banner} data-kind={kind}>
          <span className={styles.kind}>
            {label} · TIER {TIER_WORD[shown.tier]} · {tileName(tile).toUpperCase()}
          </span>
          <h2 className={styles.name}>{card.name.toUpperCase()}</h2>
          {other && <span className={styles.kind}>OR {other.name.toUpperCase()} (CHOICE)</span>}
        </header>
        <div className={styles.body}>
          <p className={styles.ask}>{cardText(card, ask, opts)}</p>
          {outcome.length > 0 && (
            <p className={styles.outcome} data-kind={kind}>
              <Icon name={kind === 'opportunity' ? 'star' : 'alert'} size={18} strokeWidth={2.5} />
              {cardText(card, outcome, opts)}
            </p>
          )}
          <p className={styles.note}>
            It opens when someone lands here. The numbers are rolled then.
          </p>
          <button ref={ok} type="button" className={styles.ok} onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
