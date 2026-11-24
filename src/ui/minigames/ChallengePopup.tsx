/**
 * The challenge pop-up (docs/design/10-minigames.md, "The challenge pop-up";
 * docs/mockups/minigames/2-popup-before-start.jpg): a cream window with a red
 * banner, the poster on the left, and on the right the flavor line, the game,
 * Prepare, If hit, who's on the tile, and Start.
 *
 * In test mode (the Minigame testing tab) Prepare is hidden. After a game it
 * shows the result line, then Continue, or in test mode Back to testing and
 * Play again.
 */
import type { CSSProperties } from 'react';
import type { MinigameChallenge } from '../../content/minigameChallenges';
import type { MinigameHiker, MinigameResult } from '../../minigames/types';
import { resultLine } from '../../minigames/bearrels/logic';
import { HikerPortrait } from '../hikers/HikerPortrait';
import { BarrelIcon } from './BarrelIcon';
import styles from './ChallengePopup.module.css';

const ROMAN = ['', 'I', 'II', 'III'] as const;

export function ChallengePopup({
  challenge,
  hikers,
  testMode = false,
  result,
  dimmed = false,
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
  /** The GPS is up in front of it. */
  dimmed?: boolean;
  onStart(): void;
  onContinue?(): void;
  onBack?(): void;
  onPlayAgain?(): void;
}) {
  const roundOf = (id: string) => result?.hit.find((h) => h.hikerId === id)?.round;
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
              <BarrelIcon size={20} />
            </span>
            {challenge.name.toUpperCase()}
            <span className={styles.diamond} aria-hidden="true">
              <BarrelIcon size={20} />
            </span>
          </h2>
          <span className={styles.corner}>{challenge.who.toUpperCase()}</span>
        </header>

        <div className={styles.body}>
          <div className={styles.poster}>
            {challenge.poster ? (
              <img src={challenge.poster} alt="" draggable={false} />
            ) : (
              <span className={styles.noPoster} />
            )}
          </div>

          <div className={styles.column}>
            <p className={styles.flavor}>{challenge.flavor}</p>

            <span className={styles.label}>THE GAME</span>
            <div className={styles.game}>
              <span className={styles.gameIcon}>
                <BarrelIcon size={28} />
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

            <span className={styles.label}>IF HIT</span>
            <div className={styles.ifHit}>
              {challenge.ifHit.map((h) => (
                <span key={h.label} className={styles.hitPart}>
                  <span className={styles.hitMark} data-who={h.who} aria-hidden="true" />
                  <b>{h.label}</b> {h.value}
                </span>
              ))}
            </div>

            <span className={styles.label}>ON THIS TILE</span>
            <div className={styles.hikers}>
              {hikers.map((h) => {
                const round = roundOf(h.id);
                return (
                  <span key={h.id} className={styles.hiker}>
                    <HikerPortrait
                      hikerId={h.id}
                      className={styles.portrait}
                      style={{ boxShadow: `0 0 0 3px ${h.color}` } as CSSProperties}
                    />
                    <span className={styles.hikerName}>{h.name}</span>
                    {result && (
                      <span className={styles.status} data-hit={round !== undefined || undefined}>
                        {round !== undefined ? `Hit in round ${round}` : 'Safe'}
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
                <>
                  <p className={styles.hint}>Then the party GPS slides up and the game starts.</p>
                  <button type="button" className={styles.start} onClick={onStart} autoFocus>
                    START
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
