/**
 * What sits on the illustrated map besides tiles and paths (Phase 10.5,
 * sections 7 and 10):
 *
 * - **Place names** in Fraunces italic with a cream halo, each one showing
 *   only once the paint covers its spot, fading in with it.
 * - **Map furniture**, fixed to the screen: a compass rose, a title box
 *   ("MEADOW", "SECTION I · TIER I · DAY 3") with a scale bar, and a Legend
 *   button that opens the line legend.
 */
import { useState } from 'react';
import { MAP_STYLE } from '../../../config/mapStyle';
import type { BiomeId } from '../../../engine';
import { ROW_STEP } from '../mapLayout';
import type { Place } from './land/features';
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

export function MapFurniture({
  biome,
  sectionIndex,
  tier,
  day,
  zoom,
  hikerColors,
}: {
  biome: BiomeId;
  sectionIndex: number;
  tier: number;
  day: number;
  zoom: number;
  hikerColors: readonly string[];
}) {
  const [legend, setLegend] = useState(false);
  // The scale bar: one move (a row of the trail) at this zoom.
  const move = Math.round(ROW_STEP * zoom);
  return (
    <>
      <Compass />
      <div className={styles.titleBox} aria-label="Map title">
        <span className={styles.title}>{BIOME_TITLE[biome]}</span>
        <span className={styles.subtitle}>
          SECTION {roman(sectionIndex + 1)} · TIER {roman(tier)} · DAY {day}
        </span>
        <div className={styles.scale}>
          <div className={styles.scaleBar} style={{ width: move }}>
            <span />
            <span />
            <span />
          </div>
          <span className={styles.scaleText}>one move</span>
        </div>
      </div>
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

function Compass() {
  const arm = (r: number) =>
    `M0 -${r} L6 -6 L0 0 Z M0 ${r} L-6 6 L0 0 Z M${r} 0 L6 6 L0 0 Z M-${r} 0 L-6 -6 L0 0 Z`;
  const dark = (r: number) =>
    `M0 -${r} L-6 -6 L0 0 Z M0 ${r} L6 6 L0 0 Z M${r} 0 L6 -6 L0 0 Z M-${r} 0 L-6 6 L0 0 Z`;
  return (
    <svg className={styles.compass} viewBox="-45 -55 90 100" aria-label="North is up" role="img">
      <circle r={24} fill="none" stroke="#F7F1E4" strokeOpacity={0.8} strokeWidth={1.5} />
      <circle r={20} fill="none" stroke="#F7F1E4" strokeOpacity={0.5} strokeDasharray="2 3" />
      <g transform="rotate(45) scale(.6)">
        <path d={arm(34)} fill="#F7F1E4" fillOpacity={0.85} />
        <path d={dark(34)} fill="#1D2220" fillOpacity={0.6} />
      </g>
      <path d={arm(34)} fill="#F7F1E4" />
      <path d={dark(34)} fill="#1D2220" />
      <text
        y={-40}
        textAnchor="middle"
        className={styles.compassN}
        fill="#F7F1E4"
        stroke="#1D2220"
        strokeWidth={3}
        paintOrder="stroke"
      >
        N
      </text>
    </svg>
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
