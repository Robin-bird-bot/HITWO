/**
 * The Trial pop-up (BUILD_PLAN Phase 5, "Trials"): the challenge window in
 * orange. The deadline sits where the scope would be, the goal and penalty
 * replace the cost, and "Got it" starts the countdown. Opened again from a
 * countdown chip, it shows the same card read-only, with who's done so far.
 */
import { useEffect, useRef } from 'react';
import { ASSETS, cardArt } from '../../config/assets';
import { CARDS } from '../../content';
import {
  deadlineOf,
  timeLeft,
  type CardRolls,
  type GameState,
  type HikerId,
  type OpenChallenge,
  type TileId,
  type TrialDef,
} from '../../engine';
import { Icon } from '../icons/Icon';
import { NODE_IMAGE } from '../map/looks';
import { tileName } from '../panels/hikerInfo';
import { resourceName } from '../scavenge/cardLook';
import { cardText } from './cardText';
import { Drift, Face } from './ChallengeWindow';
import styles from './ChallengeWindow.module.css';
import trialStyles from './TrialWindow.module.css';

const TIER_WORD = { 1: 'I', 2: 'II', 3: 'III' } as const;
const PARTY_GOALS = ['together', 'apart', 'abundance'];

interface TrialView {
  cardId: string;
  tileId: TileId;
  hikerIds: HikerId[];
  rolls: CardRolls;
  scale: number;
  tier: 1 | 2 | 3;
  targetTile?: TileId;
  resource?: string;
  /** Read-only: who has met their part so far. */
  done?: HikerId[];
}

/** A freshly revealed Trial: "Got it" starts it. */
export function NewTrial({
  state,
  open,
  onAccept,
}: {
  state: GameState;
  open: OpenChallenge;
  onAccept(): void;
}) {
  const card = CARDS[open.cardId];
  if (card?.kind !== 'trial') return null;
  const time = timeLeft(state, { endsAt: deadlineOf(state, card.deadline, open) });
  return (
    <TrialWindow
      state={state}
      card={card}
      view={{
        cardId: open.cardId,
        tileId: open.tileId,
        hikerIds: open.hikerIds,
        rolls: open.rolls,
        scale: open.scale,
        tier: open.tier,
        ...(open.trial?.targetTile ? { targetTile: open.trial.targetTile } : {}),
        ...(open.trial?.resource ? { resource: open.trial.resource } : {}),
      }}
      time={time}
      button="GOT IT"
      buttonSub="START THE COUNTDOWN"
      onButton={onAccept}
    />
  );
}

/** A Trial in progress, reopened from its chip. */
export function TrialDetails({
  state,
  uid,
  onClose,
}: {
  state: GameState;
  uid: string;
  onClose(): void;
}) {
  const trial = state.trials?.find((t) => t.uid === uid);
  const card = trial && CARDS[trial.cardId];
  if (!trial || card?.kind !== 'trial') return null;
  return (
    <TrialWindow
      state={state}
      card={card}
      view={{
        cardId: trial.cardId,
        tileId: trial.tileId,
        hikerIds: trial.hikers,
        rolls: trial.rolls,
        scale: 1,
        tier: card.tier,
        done: trial.done,
        ...(trial.targetTile ? { targetTile: trial.targetTile } : {}),
        ...(trial.resource ? { resource: trial.resource } : {}),
      }}
      time={timeLeft(state, trial)}
      button="CLOSE"
      buttonSub="THE COUNTDOWN KEEPS GOING"
      onButton={onClose}
    />
  );
}

function TrialWindow({
  state,
  card,
  view,
  time,
  button,
  buttonSub,
  onButton,
}: {
  state: GameState;
  card: TrialDef;
  view: TrialView;
  time: string;
  button: string;
  buttonSub: string;
  onButton(): void;
}) {
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => ok.current?.focus(), []);
  const tile = state.section.tiles[view.tileId];
  const nodes = [
    ...new Set((tile?.nodes ?? []).flatMap((n) => (n.type === 'caps' ? [] : [n.type]))),
  ];
  const opts = { rolls: view.rolls, scale: view.scale };
  const party = PARTY_GOALS.includes(card.goal.kind);
  const covered = party
    ? state.hikers.filter((h) => h.status !== 'abandoned')
    : state.hikers.filter((h) => view.hikerIds.includes(h.id));
  const target = view.targetTile ? state.section.tiles[view.targetTile] : undefined;
  const wants = card.goal.kind === 'rangerRequest' ? 'The ranger wants' : 'Rocco wants';
  const penalty = cardText(card, card.penaltyText, opts);

  return (
    <div className={styles.overlay} data-kind="trial">
      <Drift />
      <div
        className={styles.dialog}
        // Lower than the challenge pop-up: there are no packs under it.
        style={{ top: 150, height: 'auto' }}
        role="dialog"
        aria-modal="true"
        aria-label={`Trial: ${card.name}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') onButton();
        }}
      >
        <div className={styles.window}>
          <header className={styles.banner}>
            <span className={styles.bannerSide}>
              <Icon name="sign" size={20} color="#FFF6EC" strokeWidth={2.5} />
              TRIAL · TIER {TIER_WORD[view.tier]}
            </span>
            <span className={styles.titleRow}>
              {nodes.map((n) => (
                <img key={`l-${n}`} className={styles.node} src={NODE_IMAGE[n]} alt="" />
              ))}
              <h2 className={styles.title}>{card.name.toUpperCase()}</h2>
              {nodes.map((n) => (
                <img key={`r-${n}`} className={styles.node} src={NODE_IMAGE[n]} alt="" />
              ))}
            </span>
            <span className={`${styles.bannerSide} ${styles.bannerRight}`}>
              <Icon name="sunrise" size={17} color="#FFF6EC" strokeWidth={2} />
              {time}
            </span>
          </header>

          <div className={styles.body}>
            {/* Taller than the art when there's a target and a reward to show. */}
            <div className={styles.top} style={{ height: 'auto', minHeight: 288 }}>
              <div className={styles.art}>
                <img src={cardArt(card)} alt={card.name} draggable={false} />
              </div>
              <div className={styles.words}>
                {card.quote && <p className={styles.quote}>“{card.quote}”</p>}
                <p className={styles.cost}>{cardText(card, card.goalText, opts)}</p>
                {target && (
                  <p className={trialStyles.target} data-tone="red">
                    <span className={trialStyles.swatch} />
                    Rocco’s tile ({tileName(target)}) is marked in red on the map.
                  </p>
                )}
                {view.resource && (
                  <p className={trialStyles.target}>
                    <img src={ASSETS.resources[view.resource]} alt="" />
                    {wants}: {resourceName(view.resource)}
                  </p>
                )}
                <div className={styles.spacer} />
                {card.rewardText?.length ? (
                  <div className={styles.reward}>
                    <span className={styles.rewardIcon}>
                      <Icon name="star" size={28} color="#A6DDBC" strokeWidth={2.5} />
                    </span>
                    <span className={styles.penaltyWords}>
                      <span className={styles.rewardLabel}>REWARD</span>
                      <span className={styles.penaltyText}>
                        {cardText(card, card.rewardText, opts)}
                      </span>
                    </span>
                  </div>
                ) : null}
                {penalty && (
                  <div className={styles.penalty}>
                    <span className={styles.penaltyIcon}>
                      <Icon name="alert" size={28} color="#F39A86" strokeWidth={2.5} />
                    </span>
                    <span className={styles.penaltyWords}>
                      <span className={styles.penaltyLabel}>IF NOT</span>
                      <span className={styles.penaltyText}>{penalty}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className={trialStyles.footer}>
              <span className={trialStyles.covers}>{party ? 'THE WHOLE PARTY' : 'COVERS'}</span>
              {covered.map((h) => (
                <span key={h.id} className={trialStyles.who}>
                  <Face hikerId={h.id} size={30} />
                  {h.name.toUpperCase()}
                  {view.done?.includes(h.id) && (
                    <Icon name="check" size={16} color="#A6DDBC" strokeWidth={3} />
                  )}
                </span>
              ))}
              <span className={styles.spacer} />
              <button ref={ok} type="button" className={trialStyles.button} onClick={onButton}>
                <span className={styles.continueLabel}>{button}</span>
                <span className={styles.continueSub}>{buttonSub}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
