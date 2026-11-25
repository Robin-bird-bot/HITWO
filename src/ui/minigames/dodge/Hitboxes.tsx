/**
 * "Show hitboxes" (docs/design/12-minigames-dodge.md, section 12): every
 * shape that can hit right now, outlined over the scene, plus the sprite's
 * own hit circle. For tuning; testing only.
 */
import { BALANCE } from '../../../config/balance';
import type { Point, Shape } from '../../../minigames/dodge/logic';
import { arcPath } from './parts/drawTypes';
import styles from './Dodge.module.css';

const RED = '#ff5a4a';
const GREEN = '#7fe0a0';

function Outline({ shape }: { shape: Shape }) {
  switch (shape.kind) {
    case 'circle':
      return (
        <circle
          cx={shape.x}
          cy={shape.y}
          r={shape.r}
          fill="rgba(255,90,74,0.25)"
          stroke={RED}
          strokeWidth={0.5}
        />
      );
    case 'segment':
      return (
        <line
          x1={shape.x1}
          y1={shape.y1}
          x2={shape.x2}
          y2={shape.y2}
          stroke={RED}
          strokeOpacity={0.55}
          strokeWidth={Math.max(0.5, shape.half * 2)}
          strokeLinecap="round"
        />
      );
    case 'rect':
      return (
        <rect
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          fill="rgba(255,90,74,0.25)"
          stroke={RED}
          strokeWidth={0.5}
        />
      );
    case 'ellipse':
      return (
        <ellipse
          cx={shape.cx}
          cy={shape.cy}
          rx={shape.rx}
          ry={shape.ry}
          fill="rgba(255,90,74,0.25)"
          stroke={RED}
          strokeWidth={0.5}
        />
      );
    case 'arc':
      return (
        <path
          d={arcPath(
            shape.cx,
            shape.cy,
            shape.r,
            shape.at - shape.spread / 2,
            shape.at + shape.spread / 2,
          )}
          fill="none"
          stroke={RED}
          strokeOpacity={0.55}
          strokeWidth={shape.half * 2}
          strokeLinecap="round"
        />
      );
    case 'triangle':
      return (
        <polygon
          points={shape.points.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ')}
          fill="rgba(255,90,74,0.25)"
          stroke={RED}
          strokeWidth={0.5}
        />
      );
  }
}

export function Hitboxes({ shapes, sprite }: { shapes: readonly Shape[]; sprite: Point }) {
  return (
    <svg className={styles.hitboxes} viewBox="0 0 320 240" aria-hidden="true">
      {shapes.map((s, i) => (
        <Outline key={i} shape={s} />
      ))}
      <circle
        cx={sprite.x}
        cy={sprite.y}
        r={BALANCE.minigames.dodge.hitRadius}
        fill="none"
        stroke={GREEN}
        strokeWidth={0.6}
      />
    </svg>
  );
}
