import { useState } from 'react';
import { ASSETS } from '../../config/assets';
import styles from './TitleScreen.module.css';

export function TitleScreen() {
  // placeholder: Phase 3 replaces this note with New / Continue.
  const [showNotice, setShowNotice] = useState(false);

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
        <button type="button" className={styles.newHike} onClick={() => setShowNotice(true)}>
          New Hike
        </button>
        <p className={styles.notice} role="status">
          {showNotice ? "The trail isn't built yet. Check back soon!" : ''}
        </p>
      </section>

      <p className={styles.build}>
        BUILD {__BUILD_DATE__} {__BUILD_SHA__}
      </p>
    </main>
  );
}
