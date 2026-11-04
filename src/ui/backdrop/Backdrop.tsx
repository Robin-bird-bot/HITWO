/**
 * The layered landscape behind the map (docs/mockups/Backdrop.dc.html):
 * a sky gradient that crossfades with the phase, the sun or moon, Edit Undo
 * stars at night, the biome's land layers with parallax, and a cream wash so
 * tiles stay readable by day.
 */
import { useMemo, type CSSProperties } from 'react';
import { ASSETS } from '../../config/assets';
import { PHASES, type BiomeId, type Phase } from '../../engine';
import { useReducedMotion } from '../app/useReducedMotion';
import styles from './Backdrop.module.css';
import { makeStars } from './stars';

interface PhaseLook {
  sky: string;
  /** Sun or moon position and size, as fractions of the 1600-wide stage. */
  body: { x: number; y: number; size: number };
  /** Same function list in every phase so the browser can fade between them. */
  land: string;
  tint: string;
}

const PHASE_LOOK: Record<Phase, PhaseLook> = {
  morning: {
    sky: 'linear-gradient(to bottom, #3F8FD6 0%, #8EC3EA 45%, #CFE9F5 75%)',
    body: { x: 0.6, y: 0.05, size: 0.19 },
    land: 'sepia(0) saturate(1) brightness(1)',
    tint: 'rgba(242, 166, 94, 0)',
  },
  afternoon: {
    sky: 'linear-gradient(to bottom, #4C8FCF 0%, #8FBBE0 24%, #E7C6A4 46%, #F2B07A 70%)',
    body: { x: 0.7, y: 0.17, size: 0.19 },
    land: 'sepia(0.14) saturate(1.06) brightness(1)',
    tint: 'rgba(242, 166, 94, 0.06)',
  },
  night: {
    sky: 'linear-gradient(to bottom, #0B1229 0%, #1A2547 50%, #2E3A63 80%)',
    body: { x: 0.68, y: 0.09, size: 0.09 },
    land: 'sepia(0) saturate(0.6) brightness(0.44)',
    tint: 'rgba(27, 42, 85, 0.22)',
  },
};

/** Land layers back to front, with how fast each moves when the map scrolls (docs/ASSETS.md). */
const LAND: Record<BiomeId, { src: string; parallax: number }[]> = {
  meadow: [
    { src: ASSETS.land.blueMountains, parallax: 0.15 },
    { src: ASSETS.land.greenRidge, parallax: 0.3 },
    { src: ASSETS.land.grassHills, parallax: 0.5 },
  ],
  // Phase 11 adds the Rainforest and Alpine layers.
  temperateRainforest: [],
  alpine: [],
};
const SKY_PARALLAX = 0.05;

const WASH_DAY =
  'linear-gradient(to bottom, rgba(236,230,215,0.08) 0%, rgba(236,230,215,0.34) 45%, rgba(236,230,215,0.20) 75%, rgba(20,30,26,0.10) 100%)';
const WASH_NIGHT =
  'linear-gradient(to bottom, rgba(236,230,215,0) 0%, rgba(236,230,215,0.10) 50%, rgba(20,30,26,0.10) 100%)';

const W = 1600;
const H = 1000;

export interface BackdropProps {
  phase: Phase;
  biome: BiomeId;
  /** How far the map has scrolled up from the trailhead, in stage pixels. */
  scrollY?: number;
}

export function Backdrop({ phase, biome, scrollY = 0 }: BackdropProps) {
  const reduced = useReducedMotion();
  const stars = useMemo(() => makeStars(), []);
  const night = phase === 'night';
  const look = PHASE_LOOK[phase];
  const shift = (factor: number) => `translateY(${reduced ? 0 : scrollY * factor}px)`;
  const body = (b: PhaseLook['body']): CSSProperties => ({
    left: W * b.x,
    top: H * b.y,
    width: W * b.size,
    height: W * b.size,
  });

  return (
    <div className={styles.backdrop} aria-hidden="true">
      {PHASES.map((p) => (
        <div
          key={p}
          className={styles.fade}
          style={{ background: PHASE_LOOK[p].sky, opacity: p === phase ? 1 : 0 }}
        />
      ))}

      <div className={styles.layer} style={{ transform: shift(SKY_PARALLAX) }}>
        <div className={styles.fade} style={{ opacity: night ? 1 : 0 }}>
          {stars.map((s, i) => (
            <span
              key={i}
              className={styles.star}
              style={
                {
                  left: s.x,
                  top: s.y,
                  fontSize: s.size,
                  opacity: s.opacity,
                  '--o': s.opacity,
                  animationDuration: `${s.duration}s`,
                  animationDelay: `${s.delay}s`,
                } as CSSProperties
              }
            >
              *
            </span>
          ))}
        </div>
        <img
          className={styles.body}
          src={ASSETS.sky.sun}
          alt=""
          draggable={false}
          style={{ ...body(night ? PHASE_LOOK.afternoon.body : look.body), opacity: night ? 0 : 1 }}
        />
        <img
          className={styles.body}
          src={ASSETS.sky.moon}
          alt=""
          draggable={false}
          style={{ ...body(PHASE_LOOK.night.body), opacity: night ? 1 : 0 }}
        />
      </div>

      {LAND[biome].map((layer) => (
        <img
          key={layer.src}
          className={styles.land}
          src={layer.src}
          alt=""
          draggable={false}
          style={{ transform: shift(layer.parallax), filter: look.land }}
        />
      ))}

      <div className={styles.fade} style={{ backgroundColor: look.tint }} />
      <div className={styles.fade} style={{ background: WASH_DAY, opacity: night ? 0 : 1 }} />
      <div className={styles.fade} style={{ background: WASH_NIGHT, opacity: night ? 1 : 0 }} />
      <div
        className={styles.texture}
        style={{ backgroundImage: `url(${ASSETS.textures.halftone})` }}
      />
    </div>
  );
}
