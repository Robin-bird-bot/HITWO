/**
 * What sits on the illustrated map besides tiles and paths (Phase 10.5,
 * sections 7 and 10):
 *
 * - **Place names** in Fraunces italic with a cream halo, each one showing
 *   only once the paint covers its spot, fading in with it.
 * - **The corner pieces**, printed on the map (map-corners update): the
 *   section box ("MEADOW", "SECTION I · TIER I", a scale bar) in the land's
 *   bottom-left corner and the compass rose in its top-right.
 * - **The Legend button**, fixed to the screen, opening the line legend.
 */
import { useState } from 'react';
import { MAP_STYLE, u } from '../../../config/mapStyle';
import type { BiomeId } from '../../../engine';
import type { Place } from './land/features';
import { cornerBoxes } from './land/corners';
import { pathStrokes } from './pathLook';
import styles from './Illustrated.module.css';

export function PlaceLabels({
  places,
  shown,
}: {
  places: readonly Place[];
  /** The names whose spot is painted. */
  shown: ReadonlySet<string>;
}) {
  const halo = MAP_STYLE.labels.halo;
  return (
    <>
      {places.map((p) => (
        <div
          key={p.name}
          className={styles.label}
          data-shown={shown.has(p.name) || undefined}
          aria-hidden={!shown.has(p.name)}
          style={{
            left: p.x,
            top: p.y,
            fontSize: p.size,
            color: p.color,
            transform: `translate(-50%, -50%) rotate(${p.rot.toFixed(1)}deg)`,
            textShadow: `0 0 3px ${halo}, 0 0 3px ${halo}, 0 0 6px ${halo}`,
          }}
        >
          {p.name}
        </div>
      ))}
    </>
  );
}

const BIOME_TITLE: Record<BiomeId, string> = {
  meadow: 'MEADOW',
  temperateRainforest: 'RAINFOREST',
  alpine: 'ALPINE',
};
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const roman = (n: number) => ROMAN[n] ?? String(n);

/** The Legend button, fixed to the screen (the compass and section box are on the map now). */
export function MapFurniture({ hikerColors }: { hikerColors: readonly string[] }) {
  const [legend, setLegend] = useState(false);
  return (
    <>
      <button
        type="button"
        className={styles.legendButton}
        aria-expanded={legend}
        onClick={() => setLegend((on) => !on)}
      >
        LEGEND
      </button>
      {legend && <Legend hikerColors={hikerColors} onClose={() => setLegend(false)} />}
    </>
  );
}

const INK = '#1D2220';
const CREAM = '#F4EDDA';

/**
 * The section box (bottom left) and the compass rose (top right), printed on
 * the map: they pan and zoom with it, the same over paint or pencil.
 */
export function MapCorners({
  land,
  biome,
  sectionIndex,
  tier,
}: {
  land: { x0: number; y0: number; width: number; height: number };
  biome: BiomeId;
  sectionIndex: number;
  tier: number;
}) {
  const { section, compass } = cornerBoxes(land);
  const k = u(1);
  const bw = section.x1 - section.x0;
  const bh = section.y1 - section.y0;
  const size = compass.x1 - compass.x0;
  const R = size / 2;
  const cx = compass.x0 + R;
  const cy = compass.y1 - R;
  const point = (deg: number, len: number, half: number) => {
    const a = (deg * Math.PI) / 180;
    const tip = [Math.sin(a) * len, -Math.cos(a) * len];
    const l = [Math.sin(a - Math.PI / 2) * half, -Math.cos(a - Math.PI / 2) * half];
    const r = [Math.sin(a + Math.PI / 2) * half, -Math.cos(a + Math.PI / 2) * half];
    return {
      light: `M${tip[0]} ${tip[1]} L${l[0]} ${l[1]} L0 0 Z`,
      dark: `M${tip[0]} ${tip[1]} L${r[0]} ${r[1]} L0 0 Z`,
    };
  };
  const longs = [0, 90, 180, 270].map((d) => point(d, R, 8 * k));
  const shorts = [45, 135, 225, 315].map((d) => point(d, R * 0.55, 5 * k));
  const block = (bw * 0.6) / 3;
  return (
    <>
      <svg
        className={styles.corner}
        style={{ left: section.x0, top: section.y0, width: bw, height: bh }}
        viewBox={`0 0 ${bw} ${bh}`}
        aria-label={`${BIOME_TITLE[biome]}, section ${roman(sectionIndex + 1)}, tier ${roman(tier)}`}
        role="img"
      >
        <rect
          x={1 * k}
          y={1 * k}
          width={bw - 2 * k}
          height={bh - 2 * k}
          fill={CREAM}
          stroke={INK}
          strokeWidth={2 * k}
        />
        <rect
          x={5 * k}
          y={5 * k}
          width={bw - 10 * k}
          height={bh - 10 * k}
          fill="none"
          stroke={INK}
          strokeWidth={1 * k}
        />
        <text
          x={bw / 2}
          y={bh * 0.38}
          textAnchor="middle"
          className={styles.cornerTitle}
          style={{ fontSize: 22 * k }}
          fill={INK}
        >
          {BIOME_TITLE[biome]}
        </text>
        <text
          x={bw / 2}
          y={bh * 0.6}
          textAnchor="middle"
          className={styles.cornerSub}
          style={{ fontSize: 9 * k }}
          fill="#5E5648"
        >
          SECTION {roman(sectionIndex + 1)} · TIER {roman(tier)}
        </text>
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={bw * 0.2 + i * block}
            y={bh * 0.74}
            width={block}
            height={5 * k}
            fill={i % 2 === 0 ? INK : CREAM}
            stroke={INK}
            strokeWidth={1 * k}
          />
        ))}
      </svg>
      <svg
        className={styles.corner}
        style={{ left: compass.x0, top: compass.y0, width: size, height: compass.y1 - compass.y0 }}
        viewBox={`${compass.x0} ${compass.y0} ${size} ${compass.y1 - compass.y0}`}
        aria-label="North is up"
        role="img"
      >
        <g transform={`translate(${cx} ${cy})`}>
          <circle r={R * 0.7} fill="none" stroke={INK} strokeWidth={1 * k} />
          {[...shorts, ...longs].map((p, i) => (
            <g key={i}>
              <path
                d={p.light}
                fill={CREAM}
                stroke={INK}
                strokeWidth={0.8 * k}
                strokeLinejoin="round"
              />
              <path
                d={p.dark}
                fill={INK}
                stroke={INK}
                strokeWidth={0.8 * k}
                strokeLinejoin="round"
              />
            </g>
          ))}
          <text
            y={-R - 4 * k}
            textAnchor="middle"
            className={styles.cornerTitle}
            style={{ fontSize: 14 * k }}
            fill={INK}
            stroke={CREAM}
            strokeWidth={3 * k}
            paintOrder="stroke"
          >
            N
          </text>
        </g>
      </svg>
    </>
  );
}

/** The line legend (MapTopDown.jpg): trail, steep/muddy/rough, paved, and walked colors. */
function Legend({ hikerColors, onClose }: { hikerColors: readonly string[]; onClose(): void }) {
  const sample = (kind: 'normal' | 'steep' | 'paved') => (
    <svg width={76} height={24} viewBox="0 0 76 24" aria-hidden="true">
      {pathStrokes(kind, undefined).map((s, i) => (
        <path
          key={i}
          d="M6 12 L70 12"
          stroke={s.color}
          strokeWidth={s.width * 0.8}
          strokeOpacity={s.opacity}
          strokeDasharray={s.dash}
          strokeLinecap={s.cap}
          fill="none"
        />
      ))}
    </svg>
  );
  return (
    <div className={styles.legend} role="dialog" aria-label="Legend" onClick={onClose}>
      <span className={styles.legendTitle}>LEGEND</span>
      <div className={styles.legendRow}>
        {sample('normal')}
        <b>Trail</b>
        <span>dashed</span>
      </div>
      <div className={styles.legendRow}>
        {sample('steep')}
        <b>Steep, muddy, rough</b>
        <span>dotted + cost badge</span>
      </div>
      <div className={styles.legendRow}>
        {sample('paved')}
        <b>Paved</b>
        <span>solid, free</span>
      </div>
      <div className={styles.legendRow}>
        <div className={styles.legendDots}>
          {hikerColors.map((c, i) => (
            <span key={i} style={{ background: c }} />
          ))}
        </div>
        <b>Walked</b>
        <span>first hiker’s color, solid</span>
      </div>
    </div>
  );
}
