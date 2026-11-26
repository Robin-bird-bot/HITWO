/**
 * Hooks the quick games share: the fixed-step game loop, reporting how the
 * game ended once (after the last frame has stayed up a moment), and keys.
 */
import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { BALANCE } from '../../../config/balance';
import type { MinigameResult } from '../../../minigames/types';

const FIXED = 1 / 120;

/** Runs `tick` at a fixed step while `running` (catching up after a slow frame, up to 0.25 s). */
export function useFixedLoop<S extends { over: boolean }>(
  running: boolean,
  setGame: Dispatch<SetStateAction<S>>,
  tick: (s: S, dt: number) => S,
): void {
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  });
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let spare = 0;
    let frame = requestAnimationFrame(function loop(now) {
      spare = Math.min(0.25, spare + (now - last) / 1000);
      last = now;
      const steps = Math.floor(spare / FIXED);
      spare -= steps * FIXED;
      if (steps > 0) {
        setGame((s) => {
          let out = s;
          for (let i = 0; i < steps && !out.over; i++) out = tickRef.current(out, FIXED);
          return out;
        });
      }
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, [running, setGame]);
}

/** Once the game is over, reports its result after the last frame has stayed up a moment. */
export function useReportOnce<S extends { over: boolean }>(
  game: S,
  still: boolean,
  onDone: (r: MinigameResult) => void,
  result: (s: S) => MinigameResult,
): void {
  const reported = useRef(false);
  useEffect(() => {
    if (!game.over || still || reported.current) return;
    const id = window.setTimeout(() => {
      reported.current = true;
      onDone(result(game));
    }, BALANCE.minigames.quick.endPauseSec * 1000);
    return () => window.clearTimeout(id);
  }, [game, still, onDone, result]);
}

/**
 * Key presses while `enabled`: `onKey` gets the key (lower case for
 * letters) and says whether it used it (then the page doesn't scroll).
 * Held keys don't repeat unless `repeat` is set.
 */
export function useKeys(
  enabled: boolean,
  onKey: (key: string, e: KeyboardEvent) => boolean,
  onUp?: (key: string) => void,
  repeat = false,
): void {
  const keyRef = useRef(onKey);
  const upRef = useRef(onUp);
  useEffect(() => {
    keyRef.current = onKey;
    upRef.current = onUp;
  });
  useEffect(() => {
    if (!enabled) return;
    const down = (e: KeyboardEvent) => {
      if (e.repeat && !repeat) {
        if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
        return;
      }
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (keyRef.current(key, e)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      upRef.current?.(key);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [enabled, repeat]);
}
