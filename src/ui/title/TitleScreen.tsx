import { ASSETS } from '../../config/assets';
import styles from './TitleScreen.module.css';

/** Continue (and a confirm before replacing a saved hike) arrive in Phase 3, step 4. */
export function TitleScreen({ onNewHike }: { onNewHike(): void }) {
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
        <button type="button" className={styles.newHike} onClick={onNewHike}>
          New Hike
        </button>
      </section>

      <p className={styles.build}>
        BUILD {__BUILD_DATE__} {__BUILD_SHA__}
      </p>
    </main>
  );
}
