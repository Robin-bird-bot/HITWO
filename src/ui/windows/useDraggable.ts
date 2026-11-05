/**
 * Lets a window be dragged by its title bar, like a real computer window.
 * - Put `data-drag-handle` on the title bar; buttons and inputs inside it
 *   still work normally.
 * - The window moves with the CSS `translate` property, so it doesn't fight
 *   any transform or animation the window already has.
 * - It stays on the stage, snaps to the edge gutter, and remembers where it
 *   was left. Double-clicking the title bar puts it back.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { StageFit } from '../stage/fitStage';
import { useStage } from '../stage/StageContext';
import { placeWindow, useWindowOffset, type Box, type Offset, type WindowId } from './windowLayout';

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  from: Offset;
  base: Box;
}

const NOT_A_HANDLE = 'button, a, input, select, textarea, label, [data-no-drag]';

/**
 * The window's box on the stage before any offset. Measured on screen and
 * converted to stage pixels, so it works whatever the window sits inside
 * (a pop-out inside the ☰ button's box, say), minus the current offset.
 */
function baseBox(el: HTMLElement, fit: StageFit, offset: Offset): Box {
  const r = el.getBoundingClientRect();
  return {
    x: (r.left - fit.left) / fit.scale - offset.x,
    y: (r.top - fit.top) / fit.scale - offset.y,
    w: el.offsetWidth,
    h: el.offsetHeight,
  };
}

export function useDraggable<T extends HTMLElement>(id: WindowId | undefined) {
  const ref = useRef<T>(null);
  const fit = useStage();
  const [saved, setSaved, reset] = useWindowOffset(id);
  const [live, setLive] = useState<Offset | null>(null);
  const drag = useRef<DragState | null>(null);
  const offset = live ?? saved;

  // Keep the window on the stage if it grows (a panel opening, more cards).
  useEffect(() => {
    const el = ref.current;
    if (!el || !id) return;
    const check = () => {
      // A window that was never moved sits where the layout put it.
      if (drag.current || (!saved.x && !saved.y)) return;
      const fixed = placeWindow(baseBox(el, fit, saved), saved, false);
      if (fixed.x !== saved.x || fixed.y !== saved.y) setSaved(fixed);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [id, saved, setSaved, fit]);

  const onPointerDown = (e: ReactPointerEvent<T>) => {
    const el = ref.current;
    const target = e.target as Element;
    if (!id || !el || e.button !== 0) return;
    if (!target.closest('[data-drag-handle]') || target.closest(NOT_A_HANDLE)) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      from: saved,
      base: baseBox(el, fit, saved),
    };
    el.dataset.dragging = 'true';
  };

  const onPointerMove = (e: ReactPointerEvent<T>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = (e.clientX - d.startX) / fit.scale;
    const dy = (e.clientY - d.startY) / fit.scale;
    setLive(placeWindow(d.base, { x: d.from.x + dx, y: d.from.y + dy }));
  };

  const end = (e: ReactPointerEvent<T>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    if (ref.current) delete ref.current.dataset.dragging;
    if (live) setSaved(live);
    setLive(null);
  };

  const onDoubleClick = (e: React.MouseEvent<T>) => {
    const target = e.target as Element;
    if (!target.closest('[data-drag-handle]') || target.closest(NOT_A_HANDLE)) return;
    reset();
  };

  return {
    ref,
    /** Spread onto the window element. */
    windowProps: id
      ? {
          onPointerDown,
          onPointerMove,
          onPointerUp: end,
          onPointerCancel: end,
          onDoubleClick,
        }
      : {},
    /** Merge into the window's style. */
    translate: offset.x || offset.y ? `${offset.x}px ${offset.y}px` : undefined,
  };
}
