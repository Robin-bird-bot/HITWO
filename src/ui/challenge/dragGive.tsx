/**
 * Drag a resource or item from a pack onto a space (01-design-doc.md: "empty
 * card slots to drop in what the challenge asks for").
 *
 * - Tapping still works the old way: tap a space, then a card. A drag starts
 *   only after the pointer moves a few pixels, so a tap is never a drag.
 * - Pointer events, so it works with a mouse, a trackpad and a finger.
 * - While dragging, the spaces that would take the thing glow, and a copy of
 *   it follows the pointer. Dropping anywhere else does nothing.
 */
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { GameState, OpenChallenge } from '../../engine';
import { useStage } from '../stage/StageContext';
import { canGive, give, select, type Draft, type Source, type Target } from './challengeDraft';
import { DragGiveContext, type DragGive } from './dragGiveContext';
import styles from './ChallengeWindow.module.css';

/** How far (screen pixels) the pointer moves before a press becomes a drag. */
const DRAG_START = 6;

interface Dragging {
  source: Source;
  preview: ReactNode;
  x: number;
  y: number;
}

/** The space under a screen point, if any. */
function targetAt(x: number, y: number): Target | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const spot = (el as HTMLElement).closest<HTMLElement>('[data-drop]');
    if (!spot?.dataset.drop) continue;
    const [section, option, req] = spot.dataset.drop.split(':').map(Number);
    if (section === undefined || option === undefined || req === undefined) return null;
    return { section, option, req };
  }
  return null;
}

export function DragGiveProvider({
  state,
  open,
  draft,
  onDraft,
  children,
}: {
  state: GameState;
  open: OpenChallenge;
  draft: Draft;
  onDraft(d: Draft): void;
  children: ReactNode;
}) {
  const fit = useStage();
  const [drag, setDrag] = useState<Dragging | null>(null);
  // The handlers outlive a render, so they read the latest values from here.
  const live = useRef({ state, open, draft, onDraft });
  useEffect(() => {
    live.current = { state, open, draft, onDraft };
  });
  const justDropped = useRef(false);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  const fits = (t: Target, source: Source, d: Draft = live.current.draft) =>
    canGive(live.current.state, live.current.open, { ...d, target: t }, source);

  const begin = (e: ReactPointerEvent, source: Source, preview: ReactNode) => {
    if (e.button !== 0) return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let active = false;
    const move = (ev: PointerEvent) => {
      if (!active && Math.hypot(ev.clientX - x0, ev.clientY - y0) < DRAG_START) return;
      active = true;
      setDrag({ source, preview, x: ev.clientX, y: ev.clientY });
    };
    const up = (ev: PointerEvent) => {
      end();
      if (!active) return;
      // The click that follows this pointerup shouldn't also hand it in.
      justDropped.current = true;
      setTimeout(() => (justDropped.current = false), 0);
      setDrag(null);
      const t = targetAt(ev.clientX, ev.clientY);
      const { state: s, open: o, draft: d, onDraft: set } = live.current;
      if (t && fits(t, source, d)) set(give(s, o, { ...select(d, t), target: t }, source));
    };
    const cancel = () => {
      end();
      setDrag(null);
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      stop.current = null;
    };
    stop.current?.();
    stop.current = end;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };

  const value: DragGive = {
    dragging: drag?.source ?? null,
    sourceProps: (source, preview) => ({
      'data-draggable': true,
      onPointerDown: (e) => begin(e, source, preview),
      // The browser's own image dragging would cancel ours.
      onDragStart: (e) => e.preventDefault(),
      onClickCapture: (e) => {
        if (justDropped.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
    }),
    targetProps: (t) => ({
      'data-drop': `${t.section}:${t.option}:${t.req}`,
      ...(drag ? { 'data-drop-ok': fits(t, drag.source) } : {}),
    }),
  };

  return (
    <DragGiveContext.Provider value={value}>
      {children}
      {drag &&
        createPortal(
          <div
            className={styles.dragGhost}
            style={{ left: drag.x, top: drag.y, scale: String(fit.scale) }}
            aria-hidden="true"
          >
            {drag.preview}
          </div>,
          document.body,
        )}
    </DragGiveContext.Provider>
  );
}
