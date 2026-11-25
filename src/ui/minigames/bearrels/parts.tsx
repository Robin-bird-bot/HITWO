/**
 * Bearrels' scene parts (look C, layered silhouettes), drawn in code from
 * Wyatt's SVG parts in public/assets/minigames/bearrels/ (the same shapes and
 * inks), so each hiker's rim light and bandana can be their own color. All in
 * the Silhouette style's scene units: a 1280 × 720 view (shown at 4:3).
 */
import type { ReactNode } from 'react';
import { INKS } from '../../../minigames/hikers';
import type { SilhouetteShape } from '../../../minigames/types';
import type { BarrelBox } from '../../../minigames/bearrels/logic';
import { BARREL, barrelTransform, ROCK } from './geometry';

const ink = (k: string) => INKS[k] ?? '#2A0A18';

// ── Barrel ─────────────────────────────────────────────────────────────────

export function Barrel({ box, outline = false }: { box: BarrelBox; outline?: boolean }) {
  return (
    <g transform={barrelTransform(box)}>
      <ellipse cx="100" cy="606" rx="104" ry="12" fill={ink('bear')} />
      <path d={BARREL} fill={ink('rim')} transform="translate(6 -4)" />
      <path d={BARREL} fill={ink('sil')} />
      <path d="M14 471 Q100 489 186 471" stroke={ink('hoop')} strokeWidth="7" fill="none" />
      <path d="M14 557 Q100 575 186 557" stroke={ink('hoop')} strokeWidth="7" fill="none" />
      {outline && (
        <path
          d={BARREL}
          fill="none"
          stroke={ink('cream')}
          strokeWidth="6"
          strokeDasharray="18 12"
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 10px rgba(255, 241, 214, 0.85))' }}
        />
      )}
    </g>
  );
}

// ── Hikers ─────────────────────────────────────────────────────────────────

/** Each silhouette's shapes (hiker-*.svg), centered on the head. */
function shapeParts(shape: SilhouetteShape): ReactNode {
  const body = <ellipse cx="0" cy="52" rx="44" ry="26" />;
  switch (shape) {
    case 'dog-floppy':
      return (
        <>
          {body}
          <ellipse cx="-34" cy="-2" rx="16" ry="30" transform="rotate(18 -34 -2)" />
          <ellipse cx="34" cy="-2" rx="16" ry="30" transform="rotate(-18 34 -2)" />
          <circle cx="0" cy="0" r="38" />
          <ellipse cx="0" cy="22" rx="20" ry="16" />
        </>
      );
    case 'dog-fluffy':
      return (
        <>
          {body}
          <path d="M-36 -10 L-30 -52 L-8 -30Z M36 -10 L30 -52 L8 -30Z" />
          <circle cx="0" cy="0" r="40" />
          <circle cx="-30" cy="18" r="16" />
          <circle cx="30" cy="18" r="16" />
          <ellipse cx="0" cy="24" rx="18" ry="14" />
        </>
      );
    case 'hat':
      return (
        <>
          {body}
          <circle cx="0" cy="6" r="34" />
          <ellipse cx="0" cy="-22" rx="70" ry="13" />
          <path d="M-34 -24 Q0 -78 34 -24Z" />
        </>
      );
    case 'messy':
      return (
        <>
          {body}
          <circle cx="0" cy="4" r="34" />
          <path d="M-38 -6 L-30 -40 L-16 -28 L-6 -50 L6 -32 L20 -48 L26 -26 L40 -32 L36 -2Z" />
        </>
      );
    case 'curly':
      return (
        <>
          {body}
          <circle cx="0" cy="6" r="33" />
          {[
            [-28, -6],
            [-24.2, -19],
            [-14, -28.5],
            [0, -32],
            [14, -28.5],
            [24.2, -19],
            [28, -6],
          ].map(([x, y]) => (
            <circle key={`${x}`} cx={x} cy={y} r="13" />
          ))}
        </>
      );
    case 'bald':
      return (
        <>
          {body}
          <circle cx="0" cy="4" r="34" />
          <ellipse cx="-34" cy="10" rx="8" ry="12" />
          <ellipse cx="34" cy="10" rx="8" ry="12" />
        </>
      );
  }
}

const GLASSES: ReadonlySet<SilhouetteShape> = new Set(['curly', 'bald']);

/** A hiker's silhouette: rim-lit in their color, with a bandana in it. Centered on the head. */
export function HikerSilhouette({ shape, color }: { shape: SilhouetteShape; color: string }) {
  return (
    <g>
      <g fill={color} transform="translate(6 -5)">
        {shapeParts(shape)}
      </g>
      <g fill={ink('sil')}>{shapeParts(shape)}</g>
      <path
        d="M-30 34 Q0 50 30 34"
        stroke={color}
        strokeWidth="11"
        fill="none"
        strokeLinecap="round"
      />
      {GLASSES.has(shape) && (
        <g stroke={ink('rim')} strokeWidth="3" fill="none" opacity=".9">
          <circle cx="-12" cy="6" r="8" />
          <circle cx="12" cy="6" r="8" />
          <path d="M-4 6 h8" />
        </g>
      )}
    </g>
  );
}

// ── The bear and its rock ──────────────────────────────────────────────────

function bearShapes(): ReactNode {
  return (
    <>
      <circle cx="570" cy="128" r="32" />
      <circle cx="710" cy="128" r="32" />
      <ellipse cx="640" cy="190" rx="96" ry="86" />
      <ellipse cx="640" cy="326" rx="124" ry="100" />
      <ellipse cx="528" cy="334" rx="32" ry="48" transform="rotate(-20 528 334)" />
      <ellipse cx="752" cy="334" rx="32" ry="48" transform="rotate(20 752 334)" />
      <rect x="518" y="342" width="228" height="24" rx="8" />
      <rect x="740" y="336" width="28" height="36" rx="6" />
    </>
  );
}

/** The bear (bear-up.svg), its popgun, and the fire frame's muzzle flash. Drawn at its "up" place. */
export function Bear({ firing }: { firing: boolean }) {
  return (
    <g>
      <g fill={ink('rim')} transform="translate(6 -5)">
        {bearShapes()}
      </g>
      <g fill={ink('bear')}>{bearShapes()}</g>
      <rect x="524" y="348" width="214" height="6" rx="3" fill={ink('rim')} opacity=".7" />
      <circle cx="608" cy="182" r="6" fill="#FFD9A0" />
      <circle cx="672" cy="182" r="6" fill="#FFD9A0" />
      {firing && (
        <g transform="translate(768 354)">
          <circle r="34" fill={ink('cream')} opacity=".85" />
          <path
            d="M0 -50 L10 -12 L46 -20 L16 4 L40 34 L4 16 L-8 50 L-12 12 L-48 18 L-18 -4 L-40 -36 L-4 -14Z"
            fill="#FFF7E6"
          />
        </g>
      )}
    </g>
  );
}

export function Rock() {
  return <path d={ROCK} fill={ink('rock')} />;
}

// ── The crosshair, splinters and smoke ─────────────────────────────────────

export function Crosshair() {
  return (
    <g stroke={ink('cream')} strokeWidth="7" fill="none">
      <circle cx="0" cy="0" r="64" />
      <path d="M0 -92 v42 M0 50 v42 M-92 0 h42 M50 0 h42" />
    </g>
  );
}

/** Splinters flying off a barrel that was hit. */
export function Splinters() {
  const bits = [
    [-70, -40, 20],
    [60, -50, -30],
    [-40, -80, 50],
    [80, -10, 10],
    [-90, 10, -40],
    [30, -90, 70],
  ];
  return (
    <g fill={ink('rim')}>
      {bits.map(([x, y, r]) => (
        <rect
          key={`${x},${y}`}
          x={x}
          y={y}
          width="16"
          height="5"
          rx="2"
          transform={`rotate(${r} ${x} ${y})`}
        />
      ))}
    </g>
  );
}

/** A puff of smoke from a shot that hit nobody. */
export function Smoke() {
  return (
    <g fill={ink('cream')} opacity=".75">
      <circle cx="-26" cy="-6" r="24" />
      <circle cx="10" cy="-22" r="30" />
      <circle cx="36" cy="4" r="22" />
      <circle cx="0" cy="14" r="20" />
    </g>
  );
}
