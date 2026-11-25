/**
 * A hiker's token in the puzzle minigames (docs/design/11-minigames-puzzles.md,
 * "Hiker tokens"): a circle in their color with their initial, until
 * portraits are drawn into the games. Waiting; current (lifted, with a light
 * ring); safe (a small check); out (grey with a red slash). Scene units.
 */
import type { CSSProperties, PointerEvent } from 'react';
import type { MinigameHiker } from '../../minigames/types';
import ui from './gpsUi.module.css';

export type TokenState = 'waiting' | 'current' | 'safe' | 'out';

export function HikerToken({
  hiker,
  size = 18,
  state = 'waiting',
  style,
  className,
  onPointerDown,
}: {
  hiker: MinigameHiker;
  size?: number;
  state?: TokenState;
  style?: CSSProperties;
  className?: string;
  onPointerDown?(e: PointerEvent<HTMLSpanElement>): void;
}) {
  return (
    <span
      className={`${ui.token} ${className ?? ''}`}
      data-state={state}
      data-token={hiker.id}
      style={{
        width: size,
        height: size,
        background: hiker.color,
        fontSize: size * 0.48,
        ...style,
      }}
      onPointerDown={onPointerDown}
    >
      {hiker.name.charAt(0).toUpperCase()}
      {state === 'safe' && (
        <span className={ui.check} aria-hidden="true">
          <svg viewBox="0 0 10 10" fill="none" stroke="#1d2918" strokeWidth="2">
            <path d="M2 5.5 4.2 7.5 8 3" />
          </svg>
        </span>
      )}
      {state === 'out' && <span className={ui.slash} aria-hidden="true" />}
    </span>
  );
}
