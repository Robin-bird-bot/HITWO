import { ASSETS } from '../../config/assets';
import styles from './TitleScreen.module.css';

interface TitleScreenProps {
  /** A line describing the saved hike ("Day 3 · Afternoon · Meadow"), or null when there's none. */
  saved: string | null;
  /** A gentle note when a saved hike couldn't be read. */
  notice?: string | null;
  onContinue(): void;
  onNewHike(): void;
}

export function TitleScreen({ saved, notice, onContinue, onNewHike }: TitleScreenProps) {
  return (
    <main className={styles.scene}>
      <img className={styles.sun} src={ASSETS.sky.sun} alt="" draggable={false} />
      <img
        className={styles.land}
        src={ASSETS.backgrounds.forestMisty}
        alt=""
        draggable={false}
        decoding="async"
      />
      <div
        className={styles.texture}
        style={{ backgroundImage: `url(${ASSETS.textures.halftone})` }}
        aria-hidden="true"
      />

      <section className={styles.panel} aria-labelledby="game-title">
        <h1 id="game-title" className={styles.title}>
          <span>Hike in</span> <span>the Woods</span>
        </h1>
        <div className={styles.trail} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        {saved ? (
          <>
            <button type="button" className={styles.newHike} onClick={onContinue} autoFocus>
              <span>Continue</span>
              <span className={styles.saved}>{saved}</span>
            </button>
            <button type="button" className={styles.secondary} onClick={onNewHike}>
              New Hike
            </button>
          </>
        ) : (
          <button type="button" className={styles.newHike} onClick={onNewHike} autoFocus>
            New Hike
          </button>
        )}
        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}
      </section>

      <p className={styles.build}>
        BUILD {__BUILD_DATE__} {__BUILD_SHA__}
      </p>
    </main>
  );
}
