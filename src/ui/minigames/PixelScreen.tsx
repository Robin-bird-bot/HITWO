/**
 * The puzzle minigames' screen (docs/design/11-minigames-puzzles.md, "Screen"):
 * a 320 × 240 scene, scaled up at a whole-number scale where it fits (like
 * Bearrels' Detailed pixel), on the screen's own green so any letterbox
 * doesn't show. Everything inside is laid out in scene units: CSS `zoom`
 * scales it, so sprites stay nearest-neighbor and text stays sharp.
 */
import { forwardRef, useRef, type ReactNode } from 'react';
import { SCENE } from '../../minigames/bearrels/styles';
import { SCREEN_GREEN } from '../../minigames/greens';
import { usePixelFrame } from './usePixelFrame';
import styles from './PixelScreen.module.css';

export const PixelScreen = forwardRef<
  HTMLDivElement,
  {
    /** Measure the whole-number scale (the game); previews just fill. */
    measure?: boolean;
    children: ReactNode;
    className?: string;
  }
>(function PixelScreen({ measure = true, children, className }, sceneRef) {
  const outer = useRef<HTMLDivElement>(null);
  const frame = usePixelFrame(outer, measure);
  return (
    <div
      ref={outer}
      className={`${styles.screen} ${className ?? ''}`}
      style={{ background: SCREEN_GREEN }}
    >
      <div
        className={styles.frame}
        style={{
          left: frame.x,
          top: frame.y,
          width: SCENE.width * frame.unit,
          height: SCENE.height * frame.unit,
        }}
      >
        <div ref={sceneRef} className={styles.scene} style={{ zoom: frame.unit }}>
          {children}
        </div>
      </div>
    </div>
  );
});
