/**
 * The big animated weather icons (docs/mockups/WeatherIcons.dc.html), in the
 * simple style of a phone weather app.
 *
 * - Rain and Snow: the sun slides out as a cloud slides in, then rain falls
 *   or snowflakes drift down.
 * - Wind (Phase 10.6, a placeholder): three curved gusts sweep in and drift.
 * - Heatwave: the sun swells while its rays shrink and spin faster.
 * - Clear: the sun turns once.
 *
 * In the game it plays once and holds its last frame (the mockup loops). Each
 * final frame is the element's base style, so with no animation (reduced
 * motion) the icon simply shows how it ends.
 */
import type { CSSProperties } from 'react';
import type { WeatherId } from '../../engine';
import styles from './WeatherIcon.module.css';

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
  const r = (deg * Math.PI) / 180;
  return {
    x1: 78 + 42 * Math.cos(r),
    y1: 78 + 42 * Math.sin(r),
    x2: 78 + 54 * Math.cos(r),
    y2: 78 + 54 * Math.sin(r),
  };
});

const SUN = '#FFC23D';

function Sun({ raysClass, coreClass }: { raysClass?: string; coreClass?: string }) {
  return (
    <>
      <g className={raysClass}>
        {RAYS.map((l, i) => (
          <line key={i} {...l} stroke={SUN} strokeWidth={7} strokeLinecap="round" />
        ))}
      </g>
      <circle cx={78} cy={78} r={30} fill={SUN} className={coreClass} />
    </>
  );
}

function Cloud() {
  return (
    <g className={styles.cloudIn}>
      <circle cx={94} cy={110} r={28} fill="#F4F6F9" />
      <circle cx={128} cy={98} r={36} fill="#F4F6F9" />
      <circle cx={158} cy={118} r={22} fill="#F4F6F9" />
      <rect x={70} y={112} width={110} height={30} rx={15} fill="#F4F6F9" />
      <rect x={74} y={128} width={102} height={14} rx={7} fill="#DCE2EA" />
    </g>
  );
}

const DROPS = [98, 122, 146, 110, 134];
/** Wind's three gusts, each ending in a curl. */
const GUSTS = [
  'M24 70 H118 C140 70 148 46 132 36 C118 28 104 40 110 52',
  'M24 104 H154 C176 104 184 128 168 138 C154 146 140 134 146 122',
  'M48 138 H104 C120 138 126 156 114 164 C104 170 94 162 98 152',
];
const FLAKES = [96, 124, 152, 110, 138];
/** Each drop or flake lands a little after the last. */
const after = (i: number): CSSProperties => ({ animationDelay: `${3.1 + i * 0.14}s` });

export function WeatherIcon({ weather, size = 230 }: { weather: WeatherId; size?: number }) {
  return (
    <svg className={styles.wx} width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
      {weather === 'clear' && (
        <g transform="translate(22 22)">
          <Sun raysClass={styles.spinIn} />
        </g>
      )}
      {weather === 'heatwave' && (
        <g transform="translate(22 22)">
          <Sun raysClass={styles.heatRays} coreClass={styles.heatCore} />
        </g>
      )}
      {weather === 'wind' && (
        <g>
          {GUSTS.map((d, i) => (
            <path
              key={i}
              className={styles.gust}
              style={{ animationDelay: `${i * 0.25}s` }}
              d={d}
              fill="none"
              stroke="#DCEAF2"
              strokeWidth={9}
              strokeLinecap="round"
            />
          ))}
        </g>
      )}
      {(weather === 'rain' || weather === 'snow') && (
        <>
          <g className={styles.sunOut}>
            <Sun />
          </g>
          <g transform="translate(-22 0)">
            <Cloud />
            {weather === 'rain' && (
              <g className={styles.after}>
                {DROPS.map((x, i) => (
                  <line
                    key={x}
                    className={styles.fall}
                    style={after(i)}
                    x1={x}
                    y1={152}
                    x2={x - 5}
                    y2={166}
                    stroke="#6FB3F2"
                    strokeWidth={6}
                    strokeLinecap="round"
                  />
                ))}
              </g>
            )}
            {weather === 'snow' && (
              <g className={styles.after}>
                {FLAKES.map((x, i) => (
                  <g key={x} className={styles.drift} style={after(i)}>
                    {[0, 60, 120].map((deg) => (
                      <line
                        key={deg}
                        x1={x}
                        y1={153}
                        x2={x}
                        y2={167}
                        stroke="#FFFFFF"
                        strokeWidth={3}
                        strokeLinecap="round"
                        transform={`rotate(${deg} ${x} 160)`}
                      />
                    ))}
                  </g>
                ))}
              </g>
            )}
          </g>
        </>
      )}
    </svg>
  );
}
