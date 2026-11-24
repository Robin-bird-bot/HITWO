/**
 * Bearrels' scene (docs/design/10-minigames.md, "Layout of the scene"): an
 * SVG with a 1280 × 720 view. Back to front: the background (Wyatt's file),
 * the bear behind its rock, the hikers, the barrels, then the crosshair and
 * what a shot leaves (splinters or a puff of smoke).
 */
import type { CSSProperties } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { hikerSpots, SCENE, type BarrelBox } from '../../../minigames/bearrels/logic';
import type { MinigameHiker } from '../../../minigames/types';
import { Barrel, Bear, Crosshair, HikerSilhouette, Rock, Smoke, Splinters } from './parts';
import { BEAR_HIDDEN_Y } from './geometry';
import styles from './Bearrels.module.css';

const BACKGROUND = asset('minigames/bearrels/background.svg');
const T = BALANCE.minigames.bearrels;

export type BearPose = 'hidden' | 'up' | 'fire';

/** A hiker in the scene: behind which barrel, and whether they were just hit or are gone. */
export interface SceneHiker {
  hiker: MinigameHiker;
  barrel: number;
  state: 'in' | 'hit' | 'gone';
}

export function BearrelsScene({
  barrels,
  hikers,
  bear,
  crosshair,
  outline,
  shaking,
  smoke,
  onBarrel,
  onHover,
  className,
}: {
  barrels: readonly BarrelBox[];
  hikers: readonly SceneHiker[];
  bear: BearPose;
  /** Where the crosshair is (scene x, over the barrels), or none. */
  crosshair?: number | null;
  /** The barrel with a dashed cream outline (hovered, or the keyboard's). */
  outline?: number | null;
  /** The barrel that was just hit: it shakes, with splinters. */
  shaking?: number | null;
  /** The barrel a shot missed everyone at: a puff of smoke. */
  smoke?: number | null;
  onBarrel?(index: number): void;
  onHover?(index: number | null): void;
  className?: string;
}) {
  const cross = crosshair ?? null;
  const crossY = barrels[0] ? barrels[0].top + barrels[0].height / 2 : 0;
  // Hikers by barrel, in token order, for their spots.
  const byBarrel = new Map<number, SceneHiker[]>();
  for (const h of hikers) {
    if (h.state === 'gone') continue;
    byBarrel.set(h.barrel, [...(byBarrel.get(h.barrel) ?? []), h]);
  }
  return (
    <svg
      className={className ?? styles.scene}
      viewBox={`0 0 ${SCENE.width} ${SCENE.height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
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
              transform: `translateY(${bear === 'hidden' ? BEAR_HIDDEN_Y : 0}px)`,
              '--bear-ms': `${T.timing.bearUpMs}ms`,
            } as CSSProperties
          }
        >
          <Bear firing={bear === 'fire'} />
        </g>
      </g>
      <Rock />
      {[...byBarrel].flatMap(([barrel, list]) => {
        const box = barrels[barrel];
        if (!box) return [];
        const spots = hikerSpots(box, list.length);
        return list.map((h, i) => {
          const spot = spots[i]!;
          return (
            <g
              key={h.hiker.id}
              className={styles.hiker}
              data-state={h.state}
              style={
                {
                  transform: `translate(${spot.x}px, ${spot.y}px) scale(${spot.scale})`,
                  '--slide-ms': `${T.timing.slideMs}ms`,
                  '--tip': `${T.tipDegrees}deg`,
                } as CSSProperties
              }
            >
              <g className={styles.tip}>
                <HikerSilhouette shape={h.hiker.shape} color={h.hiker.color} />
              </g>
            </g>
          );
        });
      })}
      {barrels.map((b, i) => (
        <g
          key={i}
          className={styles.barrel}
          data-shaking={shaking === i || undefined}
          data-clickable={!!onBarrel || undefined}
          onClick={onBarrel ? () => onBarrel(i) : undefined}
          onPointerEnter={onHover ? () => onHover(i) : undefined}
          onPointerLeave={onHover ? () => onHover(null) : undefined}
          style={{ transformOrigin: `${b.x}px ${b.top + b.height}px` }}
        >
          <Barrel box={b} outline={outline === i} />
          {/* A larger hit area, so a tap near a barrel counts. */}
          <rect
            x={b.x - b.width / 2 - 10}
            y={b.top - 80}
            width={b.width + 20}
            height={b.height + 100}
            fill="transparent"
          />
        </g>
      ))}
      {shaking !== null && shaking !== undefined && barrels[shaking] && (
        <g
          className={styles.burst}
          transform={`translate(${barrels[shaking].x} ${barrels[shaking].top + 40})`}
        >
          <Splinters />
        </g>
      )}
      {smoke !== null && smoke !== undefined && barrels[smoke] && (
        <g
          className={styles.burst}
          transform={`translate(${barrels[smoke].x} ${barrels[smoke].top + 30})`}
        >
          <Smoke />
        </g>
      )}
      {cross !== null && (
        <g transform={`translate(${cross} ${crossY})`} className={styles.crosshair}>
          <Crosshair />
        </g>
      )}
    </svg>
  );
}
