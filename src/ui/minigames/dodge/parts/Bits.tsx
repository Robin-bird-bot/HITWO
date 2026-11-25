/**
 * Small pieces Dodge's parts are drawn with: a sprite placed by its middle,
 * a "!" mark, and an arrow. Scene units.
 */
import ui from '../../gpsUi.module.css';
import styles from '../Dodge.module.css';
import { art, deg } from './drawTypes';

/** A sprite from the dodge art folder, placed by its middle, turned and mirrored as asked. */
export function Sprite({
  file,
  x,
  y,
  w,
  h,
  turn = 0,
  flipX = false,
  flipY = false,
  opacity,
}: {
  file: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees. */
  turn?: number;
  flipX?: boolean;
  flipY?: boolean;
  opacity?: number;
}) {
  const t = [
    turn ? `rotate(${turn.toFixed(1)}deg)` : '',
    flipX ? 'scaleX(-1)' : '',
    flipY ? 'scaleY(-1)' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <img
      className={`${ui.sprite} ${styles.part}`}
      src={art(file)}
      alt=""
      draggable={false}
      style={{
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        transform: t || undefined,
        opacity,
      }}
    />
  );
}

/** A "!" warning mark, by its middle. */
export function Bang({ x, y }: { x: number; y: number }) {
  return (
    <span className={styles.mark} style={{ left: x - 3.5, top: y - 3.5 }}>
      !
    </span>
  );
}

/** A warning arrow pointing along `angle` (degrees), by its middle. */
export function Arrow({
  x,
  y,
  angle,
  size = 6,
}: {
  x: number;
  y: number;
  angle: number;
  size?: number;
}) {
  return (
    <span
      className={styles.arrow}
      style={{
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        transform: `rotate(${angle.toFixed(1)}deg)`,
      }}
    />
  );
}

/** The sword (sword.png, drawn at 2×): its hilt, where it turns, in the 14 × 128 image. */
const HILT = { x: 6, y: 12 };

/** The sword at 2×, its hilt at (x, y), the blade pointing along `angle` (radians, 0 = right). */
export function Sword({
  x,
  y,
  angle,
  opacity,
  ghost = false,
}: {
  x: number;
  y: number;
  angle: number;
  opacity?: number;
  ghost?: boolean;
}) {
  return (
    <img
      className={`${ui.sprite} ${styles.sword} ${ghost ? styles.ghost : ''}`}
      src={art('sword.png')}
      alt=""
      draggable={false}
      style={{
        left: x - HILT.x,
        top: y - HILT.y,
        transform: `rotate(${(deg(angle) - 90).toFixed(1)}deg)`,
        opacity,
      }}
    />
  );
}
