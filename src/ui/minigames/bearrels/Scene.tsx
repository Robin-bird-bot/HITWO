/**
 * Bearrels' scene in any of the three art styles (docs/design/10-minigames.md,
 * "Art styles"): one scene model, three renderers. Switching styles mid-round
 * only swaps the renderer; the game itself never changes.
 *
 * Every scene fills a 1280 × 960 box (the 4:3 game screen). `ScaledScreen`
 * draws one smaller, for previews.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { ArtStyle } from '../../../minigames/bearrels/styles';
import { GAME } from '../../../minigames/bearrels/styles';
import { PixelScene } from './PixelScene';
import type { SceneViewProps } from './sceneView';
import { SilhouetteScene } from './SilhouetteScene';
import styles from './Bearrels.module.css';

export function BearrelsScene({ style, ...props }: SceneViewProps & { style: ArtStyle }) {
  return style === 'silhouette' ? (
    <SilhouetteScene {...props} />
  ) : (
    <PixelScene style={style} {...props} />
  );
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
