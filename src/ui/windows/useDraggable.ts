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

export interface DragOptions {
  /** Let the window go partly off the stage, keeping this many pixels on it. */
  keepOnStage?: number;
  /** Remember where it was left (the default). A pop-up that should always open centered doesn't. */
  remember?: boolean;
}

export function useDraggable<T extends HTMLElement>(
  id: WindowId | undefined,
  { keepOnStage, remember = true }: DragOptions = {},
) {
  const ref = useRef<T>(null);
  const fit = useStage();
  const stored = useWindowOffset(remember ? id : undefined);
  const local = useState<Offset>({ x: 0, y: 0 });
  const [saved, setSaved, reset] = remember
    ? stored
    : ([local[0], local[1], () => local[1]({ x: 0, y: 0 })] as const);
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
      const fixed = placeWindow(baseBox(el, fit, saved), saved, false, keepOnStage);
      if (fixed.x !== saved.x || fixed.y !== saved.y) setSaved(fixed);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [id, saved, setSaved, fit, keepOnStage]);

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
    setLive(placeWindow(d.base, { x: d.from.x + dx, y: d.from.y + dy }, true, keepOnStage));
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
    // The pointer capture from the drag sends the double-click to the window
    // itself, so look at what's actually under the pointer.
    const under = document.elementFromPoint(e.clientX, e.clientY) ?? (e.target as Element);
    if (!under.closest('[data-drag-handle]') || under.closest(NOT_A_HANDLE)) return;
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
