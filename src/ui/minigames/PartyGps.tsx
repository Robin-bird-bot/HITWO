/**
 * The party GPS (docs/design/10-minigames.md, "The party GPS";
 * docs/mockups/minigames/4-vertical-gps-preview-then-turn.jpg): a yellow,
 * vertical handheld the whole party shares. Drawn in CSS: no image files.
 *
 * - **Upright** in its slot in the pop-up, its 3:4 screen loops a preview of
 *   the game (the 4:3 scene cropped to the middle).
 * - **Turned:** on Start it turns 90° clockwise and grows to the middle of
 *   the window (700 ms); the game plays on its now 4:3 screen, laid out at
 *   1280 × 960 and turned back so it reads upright. On Continue it turns back
 *   and shrinks (500 ms). With reduced motion it crossfades instead.
 *
 * It's drawn at its turned size and only its transform changes, so it's
 * sharp once it settles. The knob and buttons are decoration for now.
 */
import type { CSSProperties, ReactNode } from 'react';
import { BALANCE } from '../../config/balance';
import { useReducedMotion } from '../app/useReducedMotion';
import { GAME } from '../../minigames/screen';
import {
  DEVICE,
  gpsMotion,
  gpsTransform,
  gpsUpright,
  scanlineMotion,
  type Rect,
  type TurnedGps,
} from './gpsLayout';
import styles from './PartyGps.module.css';

export function PartyGps({
  turned,
  slot,
  layout,
  mode,
  showContent,
  moved,
  playing = false,
  content,
}: {
  /** Turned sideways to play (true), or upright in the pop-up. */
  turned: boolean;
  /** The slot in the pop-up it stands in when upright (stage pixels). */
  slot: Rect;
  /** Its turned size and place (gpsTurned). */
  layout: TurnedGps;
  /** What the screen shows: the upright preview, or the game turned to read upright. */
  mode: 'preview' | 'game';
  /** False while it turns: the screen goes dark. */
  showContent: boolean;
  /** It has turned at least once (reduced motion: no fade when the pop-up first opens). */
  moved: boolean;
  /** A game is being played: the scanlines drift and a band sweeps across. */
  playing?: boolean;
  /** Laid out at 1280 × 960. */
  content: ReactNode;
}) {
  const reduced = useReducedMotion();
  const u = layout.unit;
  const pose = turned ? 'turned' : 'upright';
  const motion = gpsMotion(reduced, pose);
  const scan = scanlineMotion(playing, reduced);
  const S = BALANCE.minigames.gps.scanlines;
  const w = DEVICE.width * u;
  const h = DEVICE.height * u;
  const screenH = DEVICE.screen.h * u;
  const contentTransform =
    mode === 'game'
      ? `translate(-50%, -50%) rotate(-90deg) scale(${screenH / GAME.width})`
      : `translate(-50%, -50%) scale(${screenH / GAME.height})`;
  return (
    <div className={styles.layer}>
      <div
        className={styles.device}
        data-turned={turned || undefined}
        data-motion={motion.kind}
        data-moved={moved || undefined}
        role="region"
        aria-label="Party GPS"
        style={
          {
            left: layout.center.x - w / 2,
            top: layout.center.y - h / 2,
            width: w,
            height: h,
            transform: gpsTransform(pose, gpsUpright(layout, slot)),
            '--u': u,
            '--ms': `${motion.ms}ms`,
            '--scan-dark': S.dark,
            '--scan-every': `${S.everyPx}px`,
            '--scan-ms': `${(S.everyPx / S.driftPxPerSec) * 1000}ms`,
            '--band-share': `${S.bandShare * 100}%`,
            '--band-ms': `${S.bandEveryMs}ms`,
          } as CSSProperties
        }
      >
        <span className={styles.nub} aria-hidden="true" />
        <span className={styles.sideLeft} aria-hidden="true" />
        <span className={styles.sideLeftSmall} aria-hidden="true" />
        <span className={styles.sideRight} aria-hidden="true" />
        <div className={styles.body}>
          <div className={styles.face} />
          <div className={styles.bezel}>
            <div className={styles.screen}>
              {showContent && (
                <div
                  key={mode}
                  className={styles.content}
                  data-mode={mode}
                  style={{ transform: contentTransform }}
                >
                  {content}
                </div>
              )}
              <span
                className={styles.scanlines}
                data-drift={scan.drift || undefined}
                aria-hidden="true"
              />
              {scan.band && <span className={styles.band} aria-hidden="true" />}
              <span className={styles.sheen} aria-hidden="true" />
              <span className={styles.inner} aria-hidden="true" />
            </div>
          </div>
          <span className={styles.brand} aria-hidden="true">
            TRAILMATE
          </span>
          <span className={styles.knob} aria-hidden="true">
            <span />
          </span>
          <span className={styles.buttonLeft} aria-hidden="true" />
          <span className={styles.buttonRight} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
