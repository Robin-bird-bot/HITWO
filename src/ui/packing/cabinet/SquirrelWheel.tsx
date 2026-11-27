/**
 * The cabinet's squirrel in its wheel (assets/packing/squirrel-wheel.svg,
 * Wyatt's pick): a squirrel runs to power the reels. Its parts are drawn in
 * SVG so they animate in code: two leg frames, the bobbing body and the
 * flicking tail, a peek, panting (tongue and a sweat drop) and blinking.
 */
import { useId, type Ref } from 'react';
import styles from './Cabinet.module.css';

export type SquirrelMood = 'sit' | 'run' | 'tired';

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

/** The rungs around the wheel's rim. */
const RUNGS = Array.from({ length: 28 }, (_, k) => {
  const a = (k / 28) * Math.PI * 2;
  return {
    x1: 120 + 92 * Math.cos(a),
    y1: 120 + 92 * Math.sin(a),
    x2: 120 + 103 * Math.cos(a),
    y2: 120 + 103 * Math.sin(a),
  };
});

export function SquirrelWheel({
  wheelRef,
  bodyRef,
  mood,
  frame,
  peek,
  blink,
}: {
  wheelRef: Ref<SVGGElement>;
  bodyRef: Ref<SVGGElement>;
  mood: SquirrelMood;
  /** The second leg frame while running. */
  frame: boolean;
  peek: boolean;
  blink: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const bg = `${id}-wbg`;
  const fur = `${id}-fur`;
  const tail = `${id}-tail`;
  return (
    <svg viewBox="0 0 240 240" width="240" height="240" aria-hidden="true">
      <defs>
        <radialGradient id={bg} cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#4a2c17" />
          <stop offset="1" stopColor="#2a170c" />
        </radialGradient>
        <linearGradient id={fur} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d4824a" />
          <stop offset="1" stopColor="#a95a2c" />
        </linearGradient>
        <linearGradient id={tail} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c06a36" />
          <stop offset="1" stopColor="#8c4520" />
        </linearGradient>
      </defs>
      <circle cx="120" cy="120" r="104" fill={`url(#${bg})`} />
      <g ref={wheelRef} className={styles.wheel}>
        <circle cx="120" cy="120" r="104" fill="none" stroke="#8a5a2e" strokeWidth="10" />
        <circle
          cx="120"
          cy="120"
          r="104"
          fill="none"
          stroke="#c48a4a"
          strokeWidth="3"
          strokeDasharray="2 14"
        />
        <circle cx="120" cy="120" r="92" fill="none" stroke="#6e4422" strokeWidth="3" />
        <g stroke="#7a4c26" strokeWidth="5" strokeLinecap="round">
          <line x1="120" y1="120" x2="120" y2="30" />
          <line x1="120" y1="120" x2="198" y2="165" />
          <line x1="120" y1="120" x2="42" y2="165" />
        </g>
        <g stroke="#e0b070" strokeWidth="3">
          {RUNGS.map((r, k) => (
            <line key={k} {...r} />
          ))}
        </g>
      </g>
      <circle cx="120" cy="120" r="13" fill="#e8c55a" stroke="#7a5418" strokeWidth="3" />
      <circle cx="120" cy="120" r="4" fill="#7a5418" />
      <g
        className={join(
          styles.sq,
          mood === 'run' && styles.run,
          mood === 'run' && frame && styles.f2,
          mood === 'tired' && styles.tired,
          peek && styles.peek,
          blink && styles.blink,
        )}
        transform="translate(46 115) scale(1.35)"
      >
        <g ref={bodyRef} className={styles.body}>
          <path
            className={styles.tail}
            d="M32 52 C2 54 -12 28 -2 6 C8 -14 38 -14 42 6 C45 20 32 28 24 21 C34 34 44 42 32 52Z"
            fill={`url(#${tail})`}
            stroke="#3b1f10"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M4 14 C10 0 28 -2 34 8"
            fill="none"
            stroke="#e8a06a"
            strokeWidth="3"
            strokeLinecap="round"
            opacity=".8"
          />
          <g className={styles.legsA} stroke="#3b1f10" strokeWidth="2.5" strokeLinejoin="round">
            <path d="M34 56 L22 70 L30 72 L40 60Z" fill="#a95a2c" />
            <path d="M78 58 L90 70 L82 72 L72 62Z" fill="#a95a2c" />
          </g>
          <g className={styles.legsB} stroke="#3b1f10" strokeWidth="2.5" strokeLinejoin="round">
            <path d="M36 58 L44 72 L52 70 L44 56Z" fill="#a95a2c" />
            <path d="M76 58 L68 72 L76 73 L84 60Z" fill="#a95a2c" />
          </g>
          <g className={styles.legsSit} stroke="#3b1f10" strokeWidth="2.5" strokeLinejoin="round">
            <ellipse cx="40" cy="64" rx="13" ry="8" fill="#a95a2c" />
            <path d="M74 58 L76 72 L84 72 L80 58Z" fill="#a95a2c" />
          </g>
          <ellipse
            cx="56"
            cy="48"
            rx="28"
            ry="17"
            fill={`url(#${fur})`}
            stroke="#3b1f10"
            strokeWidth="2.5"
          />
          <ellipse cx="64" cy="54" rx="15" ry="9" fill="#f3d6ac" />
          <g className={styles.head}>
            <path
              d="M74 22 L76 6 L86 18Z"
              fill="#c06a36"
              stroke="#3b1f10"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path d="M77 18 L78 10 L83 17Z" fill="#f0a6a0" />
            <circle
              cx="86"
              cy="32"
              r="16"
              fill={`url(#${fur})`}
              stroke="#3b1f10"
              strokeWidth="2.5"
            />
            <ellipse
              cx="98"
              cy="37"
              rx="9"
              ry="7"
              fill="#f3d6ac"
              stroke="#3b1f10"
              strokeWidth="2"
            />
            <circle cx="105" cy="34" r="3" fill="#3b1f10" />
            <ellipse cx="84" cy="40" rx="4" ry="2.6" fill="#f08a7a" opacity=".55" />
            <g className={styles.eyeOpen}>
              <circle cx="90" cy="28" r="3.6" fill="#1b0f08" />
              <circle cx="91.3" cy="26.6" r="1.2" fill="#fff" />
            </g>
            <path
              className={styles.eyeShut}
              d="M86 28 Q90 31 94 28"
              fill="none"
              stroke="#1b0f08"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M98 42 Q101 45 104 42"
              fill="none"
              stroke="#3b1f10"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              className={styles.tongue}
              d="M99 43 Q101 51 104 44Z"
              fill="#e8606a"
              stroke="#3b1f10"
              strokeWidth="1.4"
            />
          </g>
          <path
            d="M74 46 L84 54 L80 58 L70 50Z"
            fill="#a95a2c"
            stroke="#3b1f10"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            className={styles.sweat}
            d="M70 6 Q73 12 70 15 Q67 12 70 6Z"
            fill="#9fd4f2"
            stroke="#3b7aa8"
            strokeWidth="1.2"
          />
        </g>
      </g>
      <circle cx="120" cy="120" r="104" fill="none" stroke="#3b1f10" strokeWidth="3" />
    </svg>
  );
}
