/**
 * Wind on the illustrated map (Phase 10.6): a few leaves drift across the
 * land. A light layer of CSS-animated leaves in world space, clipped to the
 * land; no color grade. Not drawn at all under reduced motion.
 */
import type { CSSProperties } from 'react';
import { MAP_STYLE } from '../../../config/mapStyle';
import styles from './Illustrated.module.css';

const L = MAP_STYLE.leaves;
const LEAF_COLORS = ['#C77A2E', '#D9A441', '#9C6A2F', '#B5532B', '#7E9A4A'];

/** A fixed spread of leaves (no randomness needed: they're only a look). */
function leafAt(i: number) {
  const f = (n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
  return {
    top: f(1) * 100,
    seconds: L.seconds.min + f(2) * (L.seconds.max - L.seconds.min),
    delay: -f(3) * L.seconds.max,
    size: L.size.min + f(4) * (L.size.max - L.size.min),
    color: LEAF_COLORS[i % LEAF_COLORS.length] ?? '#C77A2E',
    spin: 2 + f(5) * 3,
  };
}

export function Leaves({
  rect,
}: {
  rect: { x0: number; y0: number; width: number; height: number };
}) {
  return (
    <div
      className={styles.leaves}
      style={{ left: rect.x0, top: rect.y0, width: rect.width, height: rect.height }}
      aria-hidden="true"
    >
      {Array.from({ length: L.count }, (_, i) => {
        const leaf = leafAt(i);
        const vars = {
          top: `${leaf.top}%`,
          '--w': `${rect.width + 80}px`,
          '--drop': `${L.drop}px`,
          animationDuration: `${leaf.seconds}s`,
          animationDelay: `${leaf.delay}s`,
        } as CSSProperties;
        return (
          <div key={i} className={styles.leaf} style={vars}>
            <svg
              className={styles.leafSpin}
              style={{ animationDuration: `${leaf.spin}s` }}
              width={leaf.size}
              height={leaf.size}
              viewBox="-10 -10 20 20"
            >
              <path
                d="M0 -9 C6 -5 6 4 0 9 C-6 4 -6 -5 0 -9 Z M0 -7 V8"
                fill={leaf.color}
                stroke="#5E4422"
                strokeWidth={0.8}
                strokeOpacity={0.6}
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
