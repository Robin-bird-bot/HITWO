/**
 * The 1280 × 960 game screen drawn smaller (the testing tab's preview
 * thumbnail).
 */
import type { CSSProperties, ReactNode } from 'react';
import { GAME } from '../../minigames/screen';
import styles from './ScaledScreen.module.css';

/** The 1280 × 960 game screen drawn `width` wide. */
export function ScaledScreen({
  width,
  className,
  style,
  children,
}: {
  width: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const k = width / GAME.width;
  return (
    <div
      className={`${styles.scaled} ${className ?? ''}`}
      style={{ width, height: GAME.height * k, ...style }}
    >
      <div className={styles.screen} style={{ transform: `scale(${k})` }}>
        {children}
      </div>
    </div>
  );
}
