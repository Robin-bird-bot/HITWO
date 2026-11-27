/**
 * Small pieces Dodge's parts are drawn with: a sprite placed by its middle,
 * a "!" mark, a warning arrow, the sword and a paw. Scene units.
 *
 * Marks and arrows go through `markSpot`: if one would sit under a HUD or
 * off the screen, it moves just inside the box edge on a light background.
 */
import { BALANCE } from '../../../../config/balance';
import type { MoveArrow } from '../../../../minigames/dodge/arrows';
import { markSpot, type Box } from '../../../../minigames/dodge/logic';
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

/** A "!" warning mark, by its middle, kept clear of the HUDs (`box` is the box now). */
export function Bang({ x, y, box }: { x: number; y: number; box: Box }) {
  const at = markSpot({ x, y }, box);
  return (
    <span
      className={styles.mark}
      data-inside={at.inside || undefined}
      style={{ left: at.x - 3.5, top: at.y - 3.5 }}
    >
      !
    </span>
  );
}

/** A warning arrow pointing along `angle` (degrees), by its middle, kept clear of the HUDs. */
export function Arrow({
  x,
  y,
  angle,
  box,
  size = 6,
}: {
  x: number;
  y: number;
  angle: number;
  box: Box;
  size?: number;
}) {
  const at = markSpot({ x, y }, box, size / 2);
  return (
    <span
      className={styles.arrow}
      data-inside={at.inside || undefined}
      style={{
        left: at.x - size / 2,
        top: at.y - size / 2,
        width: size,
        height: size,
        transform: `rotate(${angle.toFixed(1)}deg)`,
      }}
    />
  );
}

/**
 * Red arrows showing which way an attack will move across the box
 * (26-fixes-and-wyatt-trees.md, section 3.1): the warning red with a dark
 * outline, blinking [4] times a second, fading as the attack starts.
 */
export function MoveArrows({
  arrows,
  box,
  opacity,
}: {
  arrows: readonly MoveArrow[];
  box: Box;
  opacity: number;
}) {
  return (
    <span
      className={styles.moveArrows}
      style={{
        opacity,
        ['--blink' as string]: `${1 / BALANCE.minigames.dodge.arrows.blinkPerSec}s`,
      }}
    >
      {arrows.map((a, k) => {
        const at = markSpot({ x: a.x, y: a.y }, box, 4);
        return (
          <svg
            key={k}
            className={styles.moveArrow}
            viewBox="0 0 10 6"
            style={{ left: at.x - 5, top: at.y - 3, transform: `rotate(${a.angle.toFixed(1)}deg)` }}
          >
            <path d="M0.6 2.2H5.4V0.6L9.4 3L5.4 5.4V3.8H0.6Z" />
          </svg>
        );
      })}
    </span>
  );
}

/**
 * A bear's paw (placeholder, drawn in code): a pad with three toes, turned
 * by `turn` degrees around its wrist (0 is pointing down).
 */
export function Paw({ x, y, turn }: { x: number; y: number; turn: number }) {
  return (
    <span
      className={styles.paw}
      style={{ left: x - 4.5, top: y, transform: `rotate(${turn.toFixed(1)}deg)` }}
    >
      <span />
      <span />
      <span />
    </span>
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

/**
 * A Sword Volley sword (sword.png, 7 × 64), its blade as long as the part
 * that hits, drawn by its tip and pointing along `angle`.
 */
export function ShortSword({ x, y, angle }: { x: number; y: number; angle: number }) {
  const h = BALANCE.minigames.dodge.volley.length * SWORD_PER_BLADE;
  const w = (h * 7) / 64;
  return (
    <img
      className={`${ui.sprite} ${styles.part}`}
      src={art('sword.png')}
      alt=""
      draggable={false}
      style={{
        left: x - w / 2,
        top: y - h,
        width: w,
        height: h,
        transformOrigin: `${w / 2}px ${h}px`,
        transform: `rotate(${(deg(angle) - 90).toFixed(1)}deg)`,
      }}
    />
  );
}

/** sword.png's whole length over its blade's (the hilt and guard take the top 12 of its 64 rows). */
const SWORD_PER_BLADE = 64 / 52;

/** The thrown sword spinning (sword.png, 7 × 64, scaled to its length), by its middle. */
export function Spinning({
  x,
  y,
  angle,
  opacity,
}: {
  x: number;
  y: number;
  angle: number;
  opacity?: number;
}) {
  const h = BALANCE.minigames.dodge.thrown.length;
  const w = (h * 7) / 64;
  return (
    <img
      className={`${ui.sprite} ${styles.part}`}
      src={art('sword.png')}
      alt=""
      draggable={false}
      style={{
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        transform: `rotate(${(deg(angle) - 90).toFixed(1)}deg)`,
        opacity,
      }}
    />
  );
}
