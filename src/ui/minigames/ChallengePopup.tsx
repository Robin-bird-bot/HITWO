/**
 * The challenge pop-up (docs/design/10-minigames.md, "The challenge pop-up";
 * docs/mockups/minigames/4-vertical-gps-preview-then-turn.jpg): a cream window
 * with a red banner; the poster on the left with the flavor line under it;
 * an empty slot in the middle where the upright party GPS stands (MinigameFlow
 * draws it there, above the dimming); and on the right the game, Prepare,
 * If hit, who's on the tile, and Start.
 *
 * In test mode (the Minigame testing tab) Prepare is hidden. After a game it
 * shows the result line, then Continue, or in test mode Back to testing and
 * Play again.
 */
import type { CSSProperties, Ref } from 'react';
import type { MinigameChallenge } from '../../content/minigameChallenges';
import type { MinigameHiker, MinigameResult } from '../../minigames/types';
import { hikerStatus, resultLine } from '../../minigames/results';
import { HikerPortrait } from '../hikers/HikerPortrait';
import { MinigameIcon } from './MinigameIcon';
import styles from './ChallengePopup.module.css';

const ROMAN = ['', 'I', 'II', 'III'] as const;

export function ChallengePopup({
  challenge,
  hikers,
  testMode = false,
  result,
  dimmed = false,
  gpsSlotRef,
  onStart,
  onContinue,
  onBack,
  onPlayAgain,
}: {
  challenge: MinigameChallenge;
  hikers: readonly MinigameHiker[];
  /** The Minigame testing tab: no Prepare, and its own buttons after a game. */
  testMode?: boolean;
  /** After a game: who was safe and who was hit. */
  result?: MinigameResult | undefined;
  /** The GPS is turned, in front of it. */
  dimmed?: boolean;
  /** The middle slot the upright GPS stands in. */
  gpsSlotRef?: Ref<HTMLDivElement>;
  onStart(): void;
  onContinue?(): void;
  onBack?(): void;
  onPlayAgain?(): void;
}) {
  return (
    <div className={styles.backdrop}>
      <section
        className={styles.window}
        data-dimmed={dimmed || undefined}
        aria-label={`${challenge.name} challenge`}
        aria-hidden={dimmed || undefined}
      >
        <header className={styles.banner}>
          <span className={styles.corner}>CHALLENGE · TIER {ROMAN[challenge.tier]}</span>
          <h2 className={styles.name}>
            <span className={styles.diamond} aria-hidden="true">
              <MinigameIcon id={challenge.minigame} size={20} />
            </span>
            {challenge.name.toUpperCase()}
            <span className={styles.diamond} aria-hidden="true">
              <MinigameIcon id={challenge.minigame} size={20} />
            </span>
          </h2>
          <span className={styles.corner}>{challenge.who.toUpperCase()}</span>
        </header>

        <div className={styles.body}>
          <div className={styles.left}>
            <div className={styles.poster}>
              {challenge.poster ? (
                <img src={challenge.poster} alt="" draggable={false} />
              ) : (
                <span className={styles.noPoster} />
              )}
            </div>
            {challenge.flavor && <p className={styles.flavor}>{challenge.flavor}</p>}
          </div>

          <div ref={gpsSlotRef} className={styles.gpsSlot} />

          <div className={styles.column}>
            <span className={styles.label}>THE GAME</span>
            <div className={styles.game}>
              <span className={styles.gameIcon}>
                <MinigameIcon id={challenge.minigame} size={28} />
              </span>
              <span className={styles.gameWords}>
                <span className={styles.gameName}>{challenge.game.name}</span>
                <span className={styles.gameLine}>{challenge.game.line}</span>
              </span>
              {challenge.game.chip && <span className={styles.chip}>{challenge.game.chip}</span>}
            </div>

            {!testMode && challenge.prepare && challenge.prepare.length > 0 && (
              <>
                <span className={styles.label}>PREPARE</span>
                <div className={styles.prepare}>
                  {challenge.prepare.slice(0, 3).map((p) => (
                    <span key={p.label} className={styles.option}>
                      <b>{p.label}</b>
                      <span>{p.cost}</span>
                    </span>
                  ))}
                </div>
              </>
            )}

            {challenge.ifHit.length > 0 && (
              <>
                <span className={styles.label}>IF HIT</span>
                <div className={styles.ifHit}>
                  {challenge.ifHit.map((h) => (
                    <span key={h.label} className={styles.hitPart}>
                      <span className={styles.hitMark} data-who={h.who} aria-hidden="true" />
                      <b>{h.label}</b> {h.value}
                    </span>
                  ))}
                </div>
              </>
            )}

            <span className={styles.label}>ON THIS TILE</span>
            <div className={styles.hikers}>
              {hikers.map((h) => {
                const status = result ? hikerStatus(result, h.id) : undefined;
                return (
                  <span key={h.id} className={styles.hiker}>
                    <HikerPortrait
                      hikerId={h.id}
                      className={styles.portrait}
                      style={{ boxShadow: `0 0 0 3px ${h.color}` } as CSSProperties}
                    />
                    <span className={styles.hikerName}>{h.name}</span>
                    {status && (
                      <span className={styles.status} data-hit={status.bad || undefined}>
                        {status.text}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>

            <div className={styles.footer}>
              {result ? (
                <>
                  <p className={styles.resultLine} role="status">
                    {resultLine(result)}
                  </p>
                  {testMode ? (
                    <span className={styles.buttons}>
                      <button type="button" className={styles.secondary} onClick={onBack}>
                        BACK TO TESTING
                      </button>
                      <button type="button" className={styles.start} onClick={onPlayAgain}>
                        PLAY AGAIN
                      </button>
                    </span>
                  ) : (
                    <button type="button" className={styles.start} onClick={onContinue}>
                      CONTINUE
                    </button>
                  )}
                </>
              ) : (
                <button type="button" className={styles.start} onClick={onStart} autoFocus>
                  START
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
