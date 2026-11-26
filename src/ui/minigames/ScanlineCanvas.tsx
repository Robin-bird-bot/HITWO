/**
 * The GPS screen's scanlines on a canvas at device pixels (section 2.1 of
 * docs/design/20-challenge-popup.md). It measures the screen's on-screen
 * size (every scale and transform included) and redraws on resize, when the
 * screen settles after turning, and when devicePixelRatio changes (browser
 * zoom, or moving to another screen). While a game plays, the lines drift
 * down one period at a time.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BALANCE } from '../../config/balance';
import { drawScanlines, scanlineLayout } from './scanlines';
import styles from './PartyGps.module.css';

const S = BALANCE.minigames.gps.scanlines;

export function ScanlineCanvas({ drift, settleKey }: { drift: boolean; settleKey: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [period, setPeriod] = useState({ css: 3, every: 3 });
  const [dpr, setDpr] = useState(() =>
    typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
  );

  // devicePixelRatio changes (zoom, another screen): a resolution query fires once, then re-arms.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const q = window.matchMedia(`(resolution: ${dpr}dppx)`);
    const onChange = () => setDpr(window.devicePixelRatio || 1);
    q.addEventListener?.('change', onChange);
    return () => q.removeEventListener?.('change', onChange);
  }, [dpr]);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    const draw = () => {
      const r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const ratio = window.devicePixelRatio || 1;
      const { width, height, every } = scanlineLayout(r.width, r.height, ratio);
      // One extra period tall, so the drift never shows a gap.
      canvas.width = width;
      canvas.height = height + every;
      drawScanlines(canvas, every);
      // The canvas's CSS size is the host's layout size (its transforms scale it on screen).
      const k = host.offsetWidth / r.width;
      setPeriod({ css: (every / ratio) * k, every });
    };
    draw();
    // After a turn or zoom settles, and on every resize.
    const later = window.setTimeout(draw, BALANCE.minigames.gps.turnMs + 60);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(draw);
    observer?.observe(host);
    window.addEventListener('resize', draw);
    return () => {
      window.clearTimeout(later);
      observer?.disconnect();
      window.removeEventListener('resize', draw);
    };
  }, [dpr, settleKey]);

  return (
    <canvas
      ref={ref}
      className={styles.scanCanvas}
      data-drift={drift || undefined}
      aria-hidden="true"
      style={
        {
          '--period': `${period.css}px`,
          '--scan-ms': `${(S.everyPx / S.driftPxPerSec) * 1000}ms`,
        } as CSSProperties
      }
    />
  );
}
