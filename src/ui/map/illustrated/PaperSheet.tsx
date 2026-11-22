/**
 * The paper sheet under the illustrated land, and its fold lines over it
 * (Phase 10.6, MapEdge.jpg). In world pixels; the sheet is drawn once per land.
 */
import { useEffect, useRef } from 'react';
import { MAP_STYLE, u } from '../../../config/mapStyle';
import { paintSheet, sheetPad, type SheetRect } from './sheet';
import styles from './Illustrated.module.css';

export function Sheet({ rect, scale }: { rect: SheetRect; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(rect);
  useEffect(() => {
    if (ref.current) paintSheet(ref.current, rect, scale);
    // Drawn again only when the sheet itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, scale]);
  const pad = sheetPad();
  return (
    <canvas
      ref={ref}
      className={styles.land}
      data-sheet=""
      style={{
        left: rect.x0 - pad,
        top: rect.y0 - pad,
        width: rect.width + 2 * pad,
        height: rect.height + 2 * pad,
      }}
      aria-hidden="true"
    />
  );
}

/** Faint fold lines at the sheet's vertical thirds and its horizontal middle, over the land too. */
export function Folds({ rect }: { rect: SheetRect }) {
  const F = MAP_STYLE.sheet.fold;
  const w = u(F.width);
  const shade = `rgba(40, 30, 20, ${F.alpha})`;
  const v = `linear-gradient(90deg, transparent, ${shade}, transparent)`;
  const h = `linear-gradient(180deg, transparent, ${shade}, transparent)`;
  return (
    <>
      {[1 / 3, 2 / 3].map((t) => (
        <div
          key={t}
          className={styles.fold}
          style={{
            left: rect.x0 + rect.width * t - w / 2,
            top: rect.y0,
            width: w,
            height: rect.height,
            background: v,
          }}
        />
      ))}
      <div
        className={styles.fold}
        style={{
          left: rect.x0,
          top: rect.y0 + rect.height / 2 - w / 2,
          width: rect.width,
          height: w,
          background: h,
        }}
      />
    </>
  );
}
