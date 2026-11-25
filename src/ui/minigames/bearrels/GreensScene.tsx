/**
 * Bearrels in the GPS greens (docs/design/10-minigames.md, "Art: the GPS
 * greens"), in either version: Detailed pixel (1 px per scene unit, scaled up
 * nearest-neighbor at a whole-number scale) or Drawn 2D (4 px per unit,
 * drawn at a quarter size, smooth). Every position comes from layout.json.
 *
 * Drawn in layout.json's order: background, bear (never below the log),
 * log, barrel shadows, barrels, hikers crouched in front, the foreground
 * grass over them, crosshair, muzzle flash, then effects drawn in code:
 * hikers tipping into the grass, a few splinters, a puff of smoke.
 *
 * The bear hides behind the log, then aims his revolver at the screen: left,
 * middle or right, following the crosshair.
 */
import { useEffect, type CSSProperties } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import type { SceneHiker } from '../../../minigames/bearrels/scene';
import {
  BEAR,
  bearPose,
  crosshairPoint,
  dropAreas,
  FILL,
  FOLDER,
  frameFor,
  hikerSlots,
  muzzlePoint,
  PLACES,
  sceneBarrels,
  SCENE,
  shadowSpot,
  spriteSize,
  barrelRow,
  type ArtStyle,
} from '../../../minigames/bearrels/styles';
import { HIKER_ART } from '../../../minigames/hikers';
import { g } from '../../../minigames/greens';
import type { SceneViewProps } from './sceneView';
import styles from './Bearrels.module.css';

const B = BALANCE.minigames.bearrels;
const T = B.timing;

/** A few splinters flying off a barrel (scene units from its top middle), and a puff of smoke. */
const SPLINTERS = [
  [-7, -5],
  [6, -7],
  [-3, -9],
  [9, -2],
  [-9, 1],
];
const PUFF = [
  [-4, -2],
  [0, -5],
  [3, -1],
  [-1, 1],
  [5, -4],
];

const src = (style: ArtStyle, file: string) => asset(`minigames/bearrels/${FOLDER[style]}/${file}`);

/** Every sprite a version uses, fetched ahead so nothing pops in mid-game. */
function preload(style: ArtStyle) {
  const files = [
    'background.png',
    'foreground.png',
    'log.png',
    'bear-hidden.png',
    'bear-aim-center.png',
    'bear-aim-side.png',
    'crosshair.png',
    'muzzle-flash.png',
    ...[34, 32, 26].flatMap((w) => [`barrel-${w}.png`, `shadow-${w}.png`]),
    ...HIKER_ART.flatMap((id) => [100, 80, 62].map((s) => `hiker-${id}-${s}.png`)),
  ];
  for (const f of files) {
    const img = new Image();
    img.src = src(style, f);
  }
}

export function GreensScene({
  style,
  model,
  frame: measured = FILL,
  onBarrel,
  onHover,
  onHikerDown,
}: SceneViewProps & { style: ArtStyle }) {
  useEffect(() => preload(style), [style]);
  const frame = frameFor(style, measured);
  const u = frame.unit;
  const sprite = style === 'pixel' ? styles.sprite : `${styles.sprite} ${styles.smooth}`;
  const size = (key: string) => spriteSize(style, key);
  const box = (x: number, y: number, w: number, h: number): CSSProperties => ({
    left: x * u,
    top: y * u,
    width: w * u,
    height: h * u,
  });
  const fill = style === 'pixel' ? styles.spriteFill : `${styles.spriteFill} ${styles.smooth}`;
  const img = (file: string, x: number, y: number, key = file, extra?: CSSProperties, cls = '') => {
    const s = size(key);
    return (
      <img
        className={`${sprite} ${cls}`}
        src={src(style, file)}
        alt=""
        draggable={false}
        style={{ ...box(x, y, s.w, s.h), ...extra }}
      />
    );
  };

  const n = model.barrels;
  const row = barrelRow(n);
  const barrels = sceneBarrels(n);
  const hidden = model.bear === 'hidden';
  const cross = model.crosshair === null ? null : crosshairPoint(n, model.crosshair);
  const pose = bearPose(cross?.x ?? null);
  const aim = BEAR.aim[pose];
  const muzzle = muzzlePoint(pose);
  const known = new Set(HIKER_ART);

  const byBarrel = new Map<number, SceneHiker[]>();
  for (const h of model.hikers) byBarrel.set(h.barrel, [...(byBarrel.get(h.barrel) ?? []), h]);
  const placed = [...byBarrel].flatMap(([barrel, list]) => {
    const slots = hikerSlots(style, n, barrel, list.length);
    return list.flatMap((h, i) => (slots[i] ? [{ h, barrel, slot: slots[i] }] : []));
  });
  const burstAt = (i: number | null) => {
    const b = i === null ? undefined : barrels[i];
    return b ? { x: b.x * u, y: b.top * u } : null;
  };
  const splinters = burstAt(model.shaking);
  const smoke = burstAt(model.smoke);
  const outlined = model.outline === null ? undefined : barrels[model.outline];
  const aimSize = size(aim.file);
  const flash = size('muzzle-flash.png');
  const crossSize = size('crosshair.png');

  return (
    <div className={styles.pixelScene} aria-hidden="true" style={{ background: g(8) }}>
      <div
        className={styles.pixelBox}
        style={{ left: frame.x, top: frame.y, width: SCENE.width * u, height: SCENE.height * u }}
      >
        {img('background.png', PLACES.background.x, PLACES.background.y)}

        {/* The bear: never seen below the log. */}
        <div className={styles.bearClip} style={{ height: BEAR.clipBelowY * u }}>
          {img(
            BEAR.hidden.file,
            BEAR.hidden.x,
            BEAR.hidden.y,
            BEAR.hidden.file,
            { opacity: hidden ? 1 : 0, transitionDelay: hidden ? `${T.duckMs}ms` : '0ms' },
            styles.pxBearHidden,
          )}
          <div
            className={`${styles.sprite} ${styles.pxBearUp}`}
            data-hidden={hidden || undefined}
            data-pose={pose}
            style={
              {
                ...box(BEAR.aimAt.x, BEAR.aimAt.y, aimSize.w, aimSize.h),
                transform: `translateY(${hidden ? BEAR.rise * u : 0}px)`,
                opacity: hidden ? 0 : 1,
                '--bear-ms': `${hidden ? T.duckMs : T.bearUpMs}ms`,
                '--op-delay': hidden ? `${T.duckMs}ms` : '0ms',
              } as CSSProperties
            }
          >
            {/* Mirrored for the right-hand pose; the flip itself never animates. */}
            <img
              className={fill}
              src={src(style, aim.file)}
              alt=""
              draggable={false}
              style={aim.mirror ? { transform: 'scaleX(-1)' } : undefined}
            />
          </div>
        </div>
        {img('log.png', PLACES.log.x, PLACES.log.y)}

        {barrels.map((_, i) => {
          const s = shadowSpot(n, i);
          return <span key={`shadow${i}`}>{img(s.file, s.x, s.y)}</span>;
        })}
        {barrels.map((b, i) => (
          <img
            key={`barrel${i}`}
            className={`${sprite} ${styles.pxBarrel}`}
            data-shaking={model.shaking === i || undefined}
            src={src(style, row.file)}
            alt=""
            draggable={false}
            style={box(b.left, b.top, b.width, b.height)}
          />
        ))}

        {placed.map(({ h, barrel, slot }) => {
          const from = model.arriving?.id === h.hiker.id ? model.arriving : null;
          const x = from ? from.x - frame.x - (slot.w * u) / 2 : slot.left * u;
          const y = from ? from.y - frame.y - (slot.h * u) / 2 : slot.top * u;
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
                  width: slot.w * u,
                  height: slot.h * u,
                  transform: `translate(${x}px, ${y}px)`,
                  '--slide-ms': `${T.slideMs}ms`,
                  '--tip': `${B.tipDegrees}deg`,
                } as CSSProperties
              }
            >
              <div className={styles.tip}>
                {known.has(h.hiker.art) ? (
                  <img
                    className={fill}
                    src={src(style, `hiker-${h.hiker.art}-${slot.scale}.png`)}
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

        {/* The tall grass in front hides the hikers' lower half. */}
        <span data-layer="foreground">
          {img('foreground.png', PLACES.foreground.x, PLACES.foreground.y)}
        </span>

        {outlined && (
          <span
            className={styles.pxOutline}
            style={box(
              outlined.left - 2,
              outlined.top - 2,
              outlined.width + 4,
              outlined.height + 4,
            )}
          />
        )}
        {cross && (
          <img
            className={`${sprite} ${styles.crosshair}`}
            src={src(style, 'crosshair.png')}
            alt=""
            draggable={false}
            style={box(
              (style === 'pixel' ? Math.round(cross.x) : cross.x) - crossSize.w / 2,
              cross.y - crossSize.h / 2,
              crossSize.w,
              crossSize.h,
            )}
          />
        )}
        {model.bear === 'fire' && (
          <span data-muzzle={pose}>
            {img('muzzle-flash.png', muzzle.x - flash.w / 2, muzzle.y - flash.h / 2)}
          </span>
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
                    background: g(2),
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
                style={{
                  width: 2 * u,
                  height: 2 * u,
                  background: g(9),
                  left: (dx ?? 0) * u,
                  top: (dy ?? 0) * u,
                }}
              />
            ))}
          </span>
        )}

        {onBarrel &&
          dropAreas(n, frame).map((r, i) => (
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
          placed.map(({ h, barrel, slot }) => (
            <span
              key={`press${h.hiker.id}`}
              className={styles.pressArea}
              style={box(slot.left, slot.top, slot.w, slot.h * 0.55)}
              onPointerDown={(e) => onHikerDown(h.hiker.id, e)}
              onClick={onBarrel ? () => onBarrel(barrel) : undefined}
            />
          ))}
      </div>
    </div>
  );
}
