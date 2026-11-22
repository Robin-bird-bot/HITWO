/**
 * Debug views drawn over the land (Phase 10.5, section 11): the land types or
 * the height as a flat picture of the field grid, and boxes around stamps.
 */
import { useEffect, useRef } from 'react';
import type { LandResult } from './generate';
import { stampBox } from './land/features';
import { LAND } from './land/model';
import styles from './Illustrated.module.css';

const TYPE_COLORS: Record<number, [number, number, number]> = {
  [LAND.meadowA]: [196, 214, 120],
  [LAND.meadowB]: [150, 184, 96],
  [LAND.forest]: [38, 92, 62],
  [LAND.rock]: [150, 120, 160],
  [LAND.bank]: [214, 196, 150],
  [LAND.water]: [52, 140, 190],
};

export function FieldView({ result, view }: { result: LandResult; view: 'type' | 'height' }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const { gw, gh, type, heightN } = result.debug;
    c.width = gw;
    c.height = gh;
    const img = ctx.createImageData(gw, gh);
    for (let i = 0; i < gw * gh; i++) {
      const v = Math.round(heightN[i]! * 255);
      const rgb = view === 'type' ? (TYPE_COLORS[type[i]!] ?? [255, 0, 255]) : [v, v, v];
      img.data.set([...rgb, 255], i * 4);
    }
    ctx.putImageData(img, 0, 0);
  }, [result, view]);
  return (
    <canvas
      ref={ref}
      className={styles.land}
      data-debug-view={view}
      style={{
        left: result.x0,
        top: result.y0,
        width: result.width,
        height: result.height,
        imageRendering: 'pixelated',
      }}
      aria-hidden="true"
    />
  );
}

export function StampBoxes({ result }: { result: LandResult }) {
  return (
    <svg
      className={styles.land}
      style={{ left: result.x0, top: result.y0, width: result.width, height: result.height }}
      viewBox={`${result.x0} ${result.y0} ${result.width} ${result.height}`}
      aria-hidden="true"
    >
      {result.features.stamps.map((s, i) => {
        const b = stampBox(s);
        return (
          <g key={i}>
            <rect
              x={b.x0}
              y={b.y0}
              width={b.x1 - b.x0}
              height={b.y1 - b.y0}
              fill="none"
              stroke="#E5624A"
              strokeWidth={1.5}
            />
            <text x={b.x0 + 2} y={b.y0 - 3} fontSize={11} fill="#E5624A">
              {s.kind}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
