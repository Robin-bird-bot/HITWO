/**
 * A hiker's picture (Phase 10b): the portrait window with its forest
 * backdrop and pixel pattern, then Wyatt's portrait drawn at the window's
 * full size from the top-left, never cropped or moved one by one.
 *
 * - `window` shows the whole window (the hiker card's front).
 * - `strip` fills a wider box with the window at full width, shifted so the
 *   face (`faceY`) sits in the middle (the card back, the selection spots).
 * - `face` zooms in on the face for small round views (tokens, party cards).
 *
 * The box takes its size, shape and ring from `className` and `style`.
 */
import type { CSSProperties } from 'react';
import { ASSETS } from '../../config/assets';
import styles from './HikerPortrait.module.css';
import { cropWindow, familyIconSrc, portraitArt, type FamilyIcon } from './portraitArt';

/** How far the `face` view zooms in: the window is this many times the box's width. */
const FACE_ZOOM = 1.6;

const WINDOW_BG = { backgroundImage: `url(${ASSETS.cards.forest})` };
const PATTERN_BG = { backgroundImage: `url(${ASSETS.cards.pattern})` };

export function HikerPortrait({
  hikerId,
  view = 'face',
  aspect = 1,
  className,
  style,
}: {
  /** A hiker in the run, or a roster id on the selection screen. */
  hikerId: string;
  view?: 'window' | 'strip' | 'face';
  /** The box's width over its height, for `strip` and `face` (1 for a circle). */
  aspect?: number;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}) {
  const art = portraitArt(hikerId);
  const cls = className ? `${styles.box} ${className}` : styles.box;
  if (art.kind === 'image') {
    return (
      <span className={cls} style={style} aria-hidden="true">
        <img className={styles.fill} src={art.src} alt="" draggable={false} />
      </span>
    );
  }
  const crop =
    view === 'window'
      ? { left: 0, top: 0, width: 100 }
      : cropWindow(
          aspect,
          view === 'face' ? FACE_ZOOM : 1,
          art.kind === 'portrait' ? art.faceY : 0.5,
        );
  return (
    <span className={cls} style={style} data-view={view} aria-hidden="true">
      <span
        className={styles.window}
        style={{
          ...WINDOW_BG,
          left: `${crop.left}%`,
          top: `${crop.top}%`,
          width: `${crop.width}%`,
        }}
      >
        <span className={styles.pattern} style={PATTERN_BG} />
        {art.kind === 'portrait' && (
          <img className={styles.portrait} src={art.src} alt="" draggable={false} />
        )}
      </span>
      {art.kind === 'icon' && <FamilyMark icon={art.icon} className={styles.standIn} />}
    </span>
  );
}

/**
 * A family icon (or the variant star), drawn through a mask in `#1A1A1A`.
 * Size it with `className` or `style`.
 */
export function FamilyMark({
  icon,
  className,
  style,
}: {
  icon: FamilyIcon;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}) {
  const url = `url(${familyIconSrc(icon)})`;
  return (
    <span
      className={className ? `${styles.mark} ${className}` : styles.mark}
      style={{ maskImage: url, WebkitMaskImage: url, ...style }}
      aria-hidden="true"
    />
  );
}
