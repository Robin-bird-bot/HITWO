/**
 * Bearrels in the Earthy pixel and Teal pixel styles (docs/design/10-minigames.md,
 * "Art styles"): the 280 × 210 scene built from Wyatt's sprites, each placed
 * exactly where that style's layout.json says, and scaled up nearest-neighbor
 * (`frame`: a whole-number scale, letterboxed, when the game has measured it).
 *
 * Drawn in layout.json's order: background, bear (hidden or up), log, hikers
 * (so the barrel hides their lower half), barrel shadows, barrels, crosshair,
 * muzzle flash, effects. Effects are drawn in code at the same pixel scale:
 * hikers tipping over, a few splinter pixels, a puff of smoke.
 */
import { useEffect, type CSSProperties } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import type { SceneHiker } from '../../../minigames/bearrels/scene';
import {
  bearRise,
  crosshairPoint,
  dropAreas,
  FILL,
  HIKER_SPRITES,
  MUZZLE_SIZE,
  PIXEL,
  PIXEL_LAYOUTS,
  PIXEL_SPRITES,
  pixelBarrels,
  pixelHikers,
  type PixelStyle,
} from '../../../minigames/bearrels/styles';
import type { SceneViewProps } from './sceneView';
import styles from './Bearrels.module.css';

const B = BALANCE.minigames.bearrels;
const T = B.timing;

/** The effects' colors: splinters in the barrels' wood, smoke in the sky's light. */
const INKS: Record<PixelStyle, { splinter: string; smoke: string }> = {
  earth: { splinter: '#9A5B2E', smoke: '#F6EBD8' },
  teal: { splinter: '#4F8F84', smoke: '#E6F3EF' },
};

/** A few splinter pixels flying off a barrel (pixels from its top middle). */
const SPLINTERS = [
  [-7, -5],
  [6, -7],
  [-3, -9],
  [9, -2],
  [-9, 1],
];
/** A puff of smoke: a few 2-pixel squares. */
const PUFF = [
  [-4, -2],
  [0, -5],
  [3, -1],
  [-1, 1],
  [5, -4],
];

const folder = (style: PixelStyle) => `minigames/bearrels/pixel-${style}/`;

/** Every sprite a style uses, fetched ahead so nothing pops in mid-game. */
function preload(style: PixelStyle) {
  const L = PIXEL_LAYOUTS[style];
  const files = [
    L.background,
    L.bear.up.file,
    L.bear.hidden.file,
    L.bear.muzzle_flash.file,
    L.log.file,
    L.crosshair.file,
    ...Object.keys(PIXEL_SPRITES[style].shadows),
    ...new Set(Object.values(L.barrels).flatMap((row) => row.map((b) => b.file))),
    ...Object.keys(L.hikers.colors).flatMap((id) =>
      Object.keys(HIKER_SPRITES).map((scale) => `hiker-${id}-${scale}.png`),
    ),
  ];
  for (const f of files) {
    const img = new Image();
    img.src = asset(folder(style) + f);
  }
}

export function PixelScene({
  style,
  model,
  frame = FILL,
  onBarrel,
  onHover,
  onHikerDown,
}: SceneViewProps & { style: PixelStyle }) {
  useEffect(() => preload(style), [style]);
  const L = PIXEL_LAYOUTS[style];
  const S = PIXEL_SPRITES[style];
  const u = frame.unit;
  const src = (file: string) => asset(folder(style) + file);
  const box = (x: number, y: number, w: number, h: number): CSSProperties => ({
    left: x * u,
    top: y * u,
    width: w * u,
    height: h * u,
  });
  const n = model.barrels;
  const barrels = pixelBarrels(style, n);
  const hidden = model.bear === 'hidden';
  const known = new Set(Object.keys(L.hikers.colors));

  const byBarrel = new Map<number, SceneHiker[]>();
  for (const h of model.hikers) byBarrel.set(h.barrel, [...(byBarrel.get(h.barrel) ?? []), h]);
  const placed = [...byBarrel].flatMap(([barrel, list]) => {
    const b = barrels[barrel];
    if (!b) return [];
    const spots = pixelHikers(b, list.length);
    return list.map((h, i) => ({ h, barrel, spot: spots[i]! }));
  });

  const cross =
    model.crosshair === null
      ? null
      : crosshairPoint(style, n, model.crosshair, { x: 0, y: 0, unit: 1 });
  const burstAt = (i: number | null) => {
    const b = i === null ? undefined : barrels[i];
    return b ? { x: (b.center[0] ?? 0) * u, y: b.y * u } : null;
  };
  const splinters = burstAt(model.shaking);
  const smoke = burstAt(model.smoke);
  const muzzle = L.bear.muzzle_flash.center;
  const outlined = model.outline === null ? undefined : barrels[model.outline];
  const hiddenDelay = `${T.duckMs}ms`;

  return (
    <div className={styles.pixelScene} aria-hidden="true">
      <div
        className={styles.pixelBox}
        style={{ left: frame.x, top: frame.y, width: PIXEL.width * u, height: PIXEL.height * u }}
      >
        <img
          className={styles.sprite}
          src={src(L.background)}
          alt=""
          draggable={false}
          style={box(0, 0, PIXEL.width, PIXEL.height)}
        />

        {/* The bear rises from behind the log: never seen below its bottom edge. */}
        <div className={styles.bearClip} style={{ height: (L.log.y + S.log.h) * u }}>
          <img
            className={`${styles.sprite} ${styles.pxBearHidden}`}
            src={src(L.bear.hidden.file)}
            alt=""
            draggable={false}
            style={{
              ...box(L.bear.hidden.x, L.bear.hidden.y, S.bear.w, S.bear.h),
              opacity: hidden ? 1 : 0,
              transitionDelay: hidden ? hiddenDelay : '0ms',
            }}
          />
          <img
            className={`${styles.sprite} ${styles.pxBearUp}`}
            src={src(L.bear.up.file)}
            alt=""
            draggable={false}
            data-hidden={hidden || undefined}
            style={
              {
                ...box(L.bear.up.x, L.bear.up.y, S.bear.w, S.bear.h),
                transform: `translateY(${hidden ? bearRise(style) * u : 0}px)`,
                opacity: hidden ? 0 : 1,
                '--bear-ms': `${hidden ? T.duckMs : T.bearUpMs}ms`,
                '--op-delay': hidden ? hiddenDelay : '0ms',
              } as CSSProperties
            }
          />
        </div>
        <img
          className={styles.sprite}
          src={src(L.log.file)}
          alt=""
          draggable={false}
          style={box(L.log.x, L.log.y, S.log.w, S.log.h)}
        />

        {placed.map(({ h, barrel, spot }) => {
          const from = model.arriving?.id === h.hiker.id ? model.arriving : null;
          const x = from ? from.x - frame.x - (spot.w * u) / 2 : spot.left * u;
          const y = from ? from.y - frame.y - (spot.h * u) / 2 : spot.top * u;
          return (
            <div
              key={h.hiker.id}
              className={styles.hiker}
              data-state={h.state}
              data-hiker={h.hiker.id}
              data-barrel={barrel}
              data-arriving={from ? true : undefined}
              style={
                {
                  width: spot.w * u,
                  height: spot.h * u,
                  transform: `translate(${x}px, ${y}px)`,
                  '--slide-ms': `${T.slideMs}ms`,
                  '--tip': `${B.tipDegrees}deg`,
                } as CSSProperties
              }
            >
              <div className={styles.tip}>
                {known.has(h.hiker.art) ? (
                  <img
                    className={styles.spriteFill}
                    src={src(`hiker-${h.hiker.art}-${spot.scale}.png`)}
                    alt=""
                    draggable={false}
                  />
                ) : (
                  <span className={styles.pxBlob} style={{ background: h.hiker.color }} />
                )}
              </div>
            </div>
          );
        })}

        {barrels.map((b, i) => {
          const shadow = S.shadows[b.shadow.file as keyof typeof S.shadows] as
            { w: number; h: number } | undefined;
          return shadow ? (
            <img
              key={`shadow${i}`}
              className={styles.sprite}
              src={src(b.shadow.file)}
              alt=""
              draggable={false}
              style={box(b.shadow.x, b.shadow.y, shadow.w, shadow.h)}
            />
          ) : null;
        })}
        {barrels.map((b, i) => (
          <img
            key={`barrel${i}`}
            className={`${styles.sprite} ${styles.pxBarrel}`}
            data-shaking={model.shaking === i || undefined}
            src={src(b.file)}
            alt=""
            draggable={false}
            style={box(b.x, b.y, b.w, b.h)}
          />
        ))}
        {outlined && (
          <span
            className={styles.pxOutline}
            style={box(outlined.x - 2, outlined.y - 2, outlined.w + 4, outlined.h + 4)}
          />
        )}

        {cross && (
          <img
            className={`${styles.sprite} ${styles.crosshair}`}
            src={src(L.crosshair.file)}
            alt=""
            draggable={false}
            style={box(
              Math.round(cross.x) - L.crosshair.size / 2,
              Math.round(cross.y) - L.crosshair.size / 2,
              L.crosshair.size,
              L.crosshair.size,
            )}
          />
        )}
        {model.bear === 'fire' && (
          <img
            className={styles.sprite}
            src={src(L.bear.muzzle_flash.file)}
            alt=""
            draggable={false}
            style={box(
              (muzzle[0] ?? 0) - Math.floor(MUZZLE_SIZE / 2),
              (muzzle[1] ?? 0) - Math.floor(MUZZLE_SIZE / 2),
              MUZZLE_SIZE,
              MUZZLE_SIZE,
            )}
          />
        )}
        {splinters && (
          <span
            key={`s${model.shaking}`}
            className={styles.pxBurst}
            style={{ left: splinters.x, top: splinters.y }}
          >
            {SPLINTERS.map(([dx, dy]) => (
              <span
                key={`${dx},${dy}`}
                className={styles.pxSplinter}
                style={
                  {
                    width: u,
                    height: u,
                    background: INKS[style].splinter,
                    '--dx': `${(dx ?? 0) * u}px`,
                    '--dy': `${(dy ?? 0) * u}px`,
                  } as CSSProperties
                }
              />
            ))}
          </span>
        )}
        {smoke && (
          <span
            key={`m${model.smoke}`}
            className={styles.pxBurst}
            style={{ left: smoke.x, top: smoke.y }}
          >
            {PUFF.map(([dx, dy]) => (
              <span
                key={`${dx},${dy}`}
                className={styles.pxSmoke}
                style={
                  {
                    width: 2 * u,
                    height: 2 * u,
                    background: INKS[style].smoke,
                    left: (dx ?? 0) * u,
                    top: (dy ?? 0) * u,
                  } as CSSProperties
                }
              />
            ))}
          </span>
        )}

        {onBarrel &&
          dropAreas(style, n, frame).map((r, i) => (
            <span
              key={`tap${i}`}
              className={styles.tapArea}
              data-barrel={i}
              style={{
                left: r.left - frame.x,
                top: r.top - frame.y,
                width: r.width,
                height: r.height,
              }}
              onClick={() => onBarrel(i)}
              onPointerEnter={onHover ? () => onHover(i) : undefined}
              onPointerLeave={onHover ? () => onHover(null) : undefined}
            />
          ))}
        {onHikerDown &&
          placed.map(({ h, barrel, spot }) => (
            <span
              key={`press${h.hiker.id}`}
              className={styles.pressArea}
              style={box(spot.left - 1, spot.top - 1, spot.w + 2, spot.h * 0.6 + 2)}
              onPointerDown={(e) => onHikerDown(h.hiker.id, e)}
              onClick={onBarrel ? () => onBarrel(barrel) : undefined}
            />
          ))}
      </div>
    </div>
  );
}
