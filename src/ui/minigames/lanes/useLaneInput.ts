/**
 * Input for the lane games (docs/design/17-minigames-lanes.md): one move
 * per press, never repeating while a key is held.
 * - The arrow keys or WASD.
 * - A tap or click: toward where it landed from the hiker (above, below,
 *   left or right, by whichever is farther).
 * - On a phone, a swipe in that direction, like Crossy Road.
 * `axes` limits it to up and down (Train!) or left and right (Rafting).
 */
import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { useDemoMode } from '../demo';
import { toScene } from '../sceneCoords';

export type LaneDir = 'up' | 'down' | 'left' | 'right';

const KEYS: Readonly<Record<string, LaneDir>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
};

/** A swipe is a press that moves at least this far (screen px). */
const SWIPE_PX = 18;

export function useLaneInput({
  enabled,
  sceneRef,
  anchor,
  axes = 'both',
  onDir,
}: {
  enabled: boolean;
  sceneRef: RefObject<HTMLDivElement | null>;
  /** Where the hiker (or raft) is, in scene units, for taps. */
  anchor: () => { x: number; y: number };
  axes?: 'both' | 'vertical' | 'horizontal';
  onDir(dir: LaneDir): void;
}) {
  // In the pop-up's demo the bot plays: the player's input does nothing.
  const demo = useDemoMode();
  const live = enabled && !demo;
  const fire = useRef(onDir);
  useEffect(() => {
    fire.current = onDir;
  });
  const allowed = (d: LaneDir) =>
    axes === 'both' ||
    (axes === 'vertical' ? d === 'up' || d === 'down' : d === 'left' || d === 'right');

  // The keyboard: one move per press.
  useEffect(() => {
    if (!live) return;
    const onKey = (e: KeyboardEvent) => {
      const d = KEYS[e.key];
      if (!d || !allowed(d)) return;
      e.preventDefault();
      if (!e.repeat) fire.current(d);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** The direction from a vector, by its larger part, within the allowed axes. */
  const toward = (dx: number, dy: number): LaneDir | null => {
    const vertical = axes === 'vertical' || (axes === 'both' && Math.abs(dy) >= Math.abs(dx));
    if (vertical) return dy === 0 ? null : dy < 0 ? 'up' : 'down';
    return dx === 0 ? null : dx < 0 ? 'left' : 'right';
  };

  const down = useRef<{ x: number; y: number; id: number } | null>(null);
  return {
    onPointerDown(e: ReactPointerEvent) {
      if (!live) return;
      e.preventDefault();
      down.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    },
    onPointerUp(e: ReactPointerEvent) {
      const start = down.current;
      down.current = null;
      if (!live || !start || start.id !== e.pointerId) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      let d: LaneDir | null;
      if (Math.hypot(dx, dy) >= SWIPE_PX) d = toward(dx, dy);
      else {
        const p = toScene(sceneRef.current, e.clientX, e.clientY);
        const at = anchor();
        d = toward(p.x - at.x, p.y - at.y);
      }
      if (d && allowed(d)) fire.current(d);
    },
  };
}
