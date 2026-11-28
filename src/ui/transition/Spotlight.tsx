/**
 * The spotlight's overlay (35-ui-overhaul.md, section 10; the prototype's
 * `#iris` and `#doors`): black with a round hole, its middle and size in
 * CSS variables, over the whole window; and, checking in, the station's
 * front doors with its sign, which swing open. Mounted once by the app.
 */
import { useEffect, useSyncExternalStore, type CSSProperties } from 'react';
import { ASSETS } from '../../config/assets';
import { noteClicks, spotlightView } from './transition';
import styles from './Spotlight.module.css';

export function Spotlight() {
  useEffect(() => noteClicks(), []);
  const view = useSyncExternalStore(spotlightView.subscribe, spotlightView.get);
  if (!view.active) return null;
  const doors = view.doors;
  return (
    <div className={styles.overlay} aria-hidden="true">
      {doors && (
        <div className={styles.doorway}>
          <div
            className={styles.doors}
            data-open={doors.open || undefined}
            style={
              doors.rect
                ? {
                    left: doors.rect.left,
                    top: doors.rect.top,
                    width: doors.rect.width,
                    height: doors.rect.height,
                  }
                : undefined
            }
          >
            <div className={styles.glow} />
            <div
              className={`${styles.door} ${styles.left}`}
              style={{ backgroundImage: `url(${ASSETS.ui.doorLeft})` }}
            />
            <div
              className={`${styles.door} ${styles.right}`}
              style={{ backgroundImage: `url(${ASSETS.ui.doorRight})` }}
            />
            <div className={styles.sign}>{doors.sign}</div>
          </div>
        </div>
      )}
      {view.fade === null ? (
        <div
          className={styles.iris}
          style={
            {
              '--ix': `${view.x}px`,
              '--iy': `${view.y}px`,
              '--ir': `${view.r}px`,
            } as CSSProperties
          }
        />
      ) : (
        <div className={styles.fade} style={{ opacity: view.fade }} />
      )}
    </div>
  );
}
