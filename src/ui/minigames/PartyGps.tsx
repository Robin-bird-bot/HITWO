/**
 * The party GPS (docs/design/10-minigames.md, "The party GPS";
 * docs/mockups/minigames/3-gps-lifted-placing.jpg): a yellow landscape
 * handheld the whole party shares. Minigames play on its 16:9 screen, laid
 * out at 1280 × 720 and scaled to fit, under scanlines, a soft inner shadow,
 * a glass sheen and a warm glow.
 *
 * It lifts from below over 600 ms with a small overshoot and lowers over
 * 400 ms. With reduced motion it fades in and out at full size. The D-pad and
 * buttons are decoration for now. Drawn in CSS and SVG: no image files.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { BALANCE } from '../../config/balance';
import { useReducedMotion } from '../app/useReducedMotion';
import { useStage } from '../stage/StageContext';
import { gpsSize, SCREEN } from './gpsLayout';
import styles from './PartyGps.module.css';

const G = BALANCE.minigames.gps;

export function PartyGps({
  up,
  onLowered,
  children,
}: {
  /** Lifted (true), or lowering away (false). */
  up: boolean;
  /** It has finished lowering: unmount it. */
  onLowered?(): void;
  /** The minigame, laid out at 1280 × 720. */
  children: ReactNode;
}) {
  const fit = useStage();
  const reduced = useReducedMotion();
  const size = gpsSize(fit.scale < G.phoneBelowScale);
  // It mounts below and lifts on the next frame, so the transition runs.
  const [lifted, setLifted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setLifted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  // Lowering: when it's down, it can go.
  useEffect(() => {
    if (up) return;
    const timer = setTimeout(() => onLowered?.(), G.lowerMs);
    return () => clearTimeout(timer);
  }, [up, onLowered]);
  const shown = up && lifted;

  const vars = {
    '--lift-ms': `${G.liftMs}ms`,
    '--lower-ms': `${G.lowerMs}ms`,
    width: size.width,
    height: size.height,
  } as CSSProperties;
  return (
    <div
      className={styles.layer}
      data-shown={shown || undefined}
      data-reduced={reduced || undefined}
    >
      <div className={styles.gps} style={vars} role="region" aria-label="Party GPS">
        <span className={styles.antenna} aria-hidden="true" />
        <span className={styles.topButtons} aria-hidden="true">
          <span />
          <span />
        </span>
        <div className={styles.face} style={{ inset: size.rim, padding: `${size.pad}px 0 0` }}>
          <div className={styles.side} style={{ width: size.side }} aria-hidden="true">
            <svg viewBox="0 0 60 60" width={Math.min(78, size.side * 0.66)} className={styles.dpad}>
              <path d="M22 4h16v18h18v16H38v18H22V38H4V22h18z" />
            </svg>
          </div>
          <div className={styles.middle}>
            <div className={styles.bezel} style={{ padding: size.bezel }}>
              <div
                className={styles.screen}
                style={{ width: size.screenWidth, height: size.screenHeight }}
              >
                <div
                  className={styles.viewport}
                  style={{ transform: `scale(${size.screenWidth / SCREEN.width})` }}
                >
                  {children}
                </div>
                <span className={styles.scanlines} aria-hidden="true" />
                <span className={styles.sheen} aria-hidden="true" />
                <span className={styles.inner} aria-hidden="true" />
              </div>
            </div>
            <span className={styles.brand} style={{ height: size.label }} aria-hidden="true">
              TRAILMATE
            </span>
          </div>
          <div className={styles.side} style={{ width: size.side }} aria-hidden="true">
            <span
              className={styles.buttonYellow}
              style={{ width: size.side * 0.42, height: size.side * 0.42 }}
            />
            <span
              className={styles.buttonDark}
              style={{ width: size.side * 0.36, height: size.side * 0.36 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
