/**
 * Bearrels in the Silhouette style (docs/design/10-minigames.md, "Art
 * styles"): the first version's flat layered silhouettes, shown at 4:3. The
 * 1280 × 720 scene sits in a 0 −120 1280 960 view, with a sky strip above
 * and a ground strip below (layout.json `extend_for_4x3`).
 *
 * Back to front: the background (Wyatt's file), the bear behind its rock,
 * the hikers, the barrels, the crosshair and what a shot leaves (splinters
 * or smoke). Then the tap areas and, on top, a press area on each hiker.
 */
import type { CSSProperties } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { barrelLayout, hikerSpots } from '../../../minigames/bearrels/logic';
import type { SceneHiker } from '../../../minigames/bearrels/scene';
import {
  crosshairPoint,
  dropAreas,
  SILHOUETTE_STRIPS,
  SILHOUETTE_TOP,
  SILHOUETTE_VIEW,
} from '../../../minigames/bearrels/styles';
import { BEAR_HIDDEN_Y } from './geometry';
import { Barrel, Bear, Crosshair, HikerSilhouette, Rock, Smoke, Splinters } from './parts';
import type { SceneViewProps } from './sceneView';
import styles from './Bearrels.module.css';

const BACKGROUND = asset('minigames/bearrels/background.svg');
const B = BALANCE.minigames.bearrels;

export function SilhouetteScene({ model, onBarrel, onHover, onHikerDown }: SceneViewProps) {
  const n = model.barrels;
  const barrels = barrelLayout(n);
  // Everything below is in the 1280 × 720 scene; the game screen is 120 lower.
  const cross = model.crosshair === null ? null : crosshairPoint('silhouette', n, model.crosshair);
  const byBarrel = new Map<number, SceneHiker[]>();
  for (const h of model.hikers) byBarrel.set(h.barrel, [...(byBarrel.get(h.barrel) ?? []), h]);
  const placed = [...byBarrel].flatMap(([barrel, list]) => {
    const box = barrels[barrel];
    if (!box) return [];
    const spots = hikerSpots(box, list.length);
    return list.map((h, i) => ({ h, barrel, spot: spots[i]! }));
  });
  const arriving = model.arriving;
  const shot = model.shaking === null ? undefined : barrels[model.shaking];
  const puff = model.smoke === null ? undefined : barrels[model.smoke];
  return (
    <svg
      className={styles.sceneSvg}
      viewBox={SILHOUETTE_VIEW}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {SILHOUETTE_STRIPS.map((s) => (
        <rect
          key={s.fill + s.rect[1]}
          x={s.rect[0]}
          y={s.rect[1]}
          width={s.rect[2]}
          height={s.rect[3]}
          fill={s.fill}
        />
      ))}
      <svg x="0" y="0" width="1280" height="720" viewBox="0 0 1280 720" overflow="visible">
        <defs>
          {/* Below the rock's bottom the bear is never seen. */}
          <clipPath id="bear-clip">
            <rect x="0" y="-200" width="1280" height="640" />
          </clipPath>
        </defs>
        <image href={BACKGROUND} x="0" y="0" width="1280" height="720" />
        <g clipPath="url(#bear-clip)">
          <g
            className={styles.bear}
            style={
              {
                transform: `translateY(${model.bear === 'hidden' ? BEAR_HIDDEN_Y : 0}px)`,
                '--bear-ms': `${model.bear === 'hidden' ? B.timing.duckMs : B.timing.bearUpMs}ms`,
              } as CSSProperties
            }
          >
            <Bear firing={model.bear === 'fire'} />
          </g>
        </g>
        <Rock />
        {placed.map(({ h, barrel, spot }) => {
          const from = arriving?.id === h.hiker.id ? arriving : null;
          const x = from ? from.x : spot.x;
          const y = from ? from.y - SILHOUETTE_TOP : spot.y;
          return (
            <g
              key={h.hiker.id}
              className={styles.hiker}
              data-state={h.state}
              data-hiker={h.hiker.id}
              data-barrel={barrel}
              data-arriving={from ? true : undefined}
              style={
                {
                  transform: `translate(${x}px, ${y}px) scale(${spot.scale})`,
                  '--slide-ms': `${B.timing.slideMs}ms`,
                  '--tip': `${B.tipDegrees}deg`,
                } as CSSProperties
              }
            >
              <g className={styles.tip}>
                <HikerSilhouette shape={h.hiker.shape} color={h.hiker.color} />
              </g>
            </g>
          );
        })}
        {barrels.map((b, i) => (
          <g
            key={i}
            className={styles.barrel}
            data-shaking={model.shaking === i || undefined}
            style={{ transformOrigin: `${b.x}px ${b.top + b.height}px` }}
          >
            <Barrel box={b} outline={model.outline === i} />
          </g>
        ))}
        {shot && (
          <g className={styles.burst} transform={`translate(${shot.x} ${shot.top + 40})`}>
            <Splinters />
          </g>
        )}
        {puff && (
          <g className={styles.burst} transform={`translate(${puff.x} ${puff.top + 30})`}>
            <Smoke />
          </g>
        )}
        {cross && (
          <g
            transform={`translate(${cross.x} ${cross.y - SILHOUETTE_TOP})`}
            className={styles.crosshair}
          >
            <Crosshair />
          </g>
        )}
        {onBarrel &&
          dropAreas('silhouette', n).map((r, i) => (
            <rect
              key={i}
              className={styles.tapArea}
              data-barrel={i}
              x={r.left}
              y={r.top - SILHOUETTE_TOP}
              width={r.width}
              height={r.height}
              fill="transparent"
              onClick={() => onBarrel(i)}
              onPointerEnter={onHover ? () => onHover(i) : undefined}
              onPointerLeave={onHover ? () => onHover(null) : undefined}
            />
          ))}
        {onHikerDown &&
          placed.map(({ h, barrel, spot }) => (
            <circle
              key={h.hiker.id}
              className={styles.pressArea}
              cx={spot.x}
              cy={spot.y}
              r={58 * spot.scale}
              fill="transparent"
              onPointerDown={(e) => onHikerDown(h.hiker.id, e)}
              onClick={onBarrel ? () => onBarrel(barrel) : undefined}
            />
          ))}
      </svg>
    </svg>
  );
}
