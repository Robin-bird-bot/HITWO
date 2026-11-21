/**
 * The hiker selection screen's swirling background, behind the whole window
 * (backgroundGl.ts). The bend follows the pointer and drifts when it's away.
 * `data-state` on the canvas says what it's doing: running, still (reduced
 * motion) or fallback (no WebGL2).
 */
import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../app/useReducedMotion';
import { BG_FALLBACK, startBackground, type BackgroundEnv } from './backgroundGl';
import styles from './SelectBackground.module.css';

const browserEnv = (reducedMotion: boolean): BackgroundEnv => ({
  reducedMotion,
  pixelRatio: () => window.devicePixelRatio || 1,
  requestFrame: (draw) => requestAnimationFrame(draw),
  cancelFrame: (id) => cancelAnimationFrame(id),
  hidden: () => document.visibilityState === 'hidden',
});

export function SelectBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const bg = startBackground(canvas, browserEnv(reducedMotion));
    canvas.dataset.state = !bg ? 'fallback' : reducedMotion ? 'still' : 'running';
    if (!bg) return;

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      bg.point({ x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height });
    };
    // Off the window, or a finger lifted: the bend drifts again.
    const onAway = () => bg.point(null);
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') bg.point(null);
    };
    const root = document.documentElement;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('blur', onAway);
    root.addEventListener('pointerleave', onAway);
    document.addEventListener('visibilitychange', bg.refresh);
    const resize = new ResizeObserver(() => bg.refresh());
    resize.observe(canvas);
    return () => {
      bg.stop();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('blur', onAway);
      root.removeEventListener('pointerleave', onAway);
      document.removeEventListener('visibilitychange', bg.refresh);
      resize.disconnect();
    };
  }, [reducedMotion]);

  return (
    <div className={styles.backdrop} style={{ background: BG_FALLBACK }} aria-hidden="true">
      <canvas ref={ref} className={styles.canvas} />
    </div>
  );
}
