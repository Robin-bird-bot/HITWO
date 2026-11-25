/**
 * Bearrels' scene in either version of the GPS greens (docs/design/10-minigames.md,
 * "Art: the GPS greens"): one scene model, drawn from Detailed pixel or
 * Drawn 2D art. Switching versions mid-round only redraws; the game itself
 * never changes.
 *
 * Every scene fills a 1280 × 960 box (the 4:3 game screen). `ScaledScreen`
 * draws one smaller, for previews.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { ArtStyle } from '../../../minigames/bearrels/styles';
import { GAME } from '../../../minigames/bearrels/styles';
import { GreensScene } from './GreensScene';
import type { SceneViewProps } from './sceneView';
import styles from './Bearrels.module.css';

export function BearrelsScene({ style, ...props }: SceneViewProps & { style: ArtStyle }) {
  return <GreensScene style={style} {...props} />;
}

/** The 1280 × 960 game screen drawn `width` wide (a preview thumbnail). */
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
