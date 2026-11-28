/**
 * Runs every drag (see drag.ts): follows the pointer after a press moves a
 * few pixels, finds the spot under it, drops or cancels, and draws a copy of
 * the dragged thing under the pointer. Put it inside the Stage, around the game.
 */
import { sfx } from '../../audio/engine';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useStage } from '../stage/StageContext';
import {
  DragContext,
  PointerStore,
  useDragPointer,
  type DragApi,
  type DragPayload,
  type DragState,
  type DropSpot,
  type DropTarget,
} from './drag';
import styles from './DragLayer.module.css';

/** How far (screen pixels) the pointer moves before a press becomes a drag. */
const DRAG_START = 6;

/** The first spot under a screen point that the target says would take it. */
function spotAt(
  x: number,
  y: number,
  payload: DragPayload,
  targets: Map<string, DropTarget>,
): DropSpot | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const spot = (el as HTMLElement).closest<HTMLElement>('[data-drop-id]');
    const id = spot?.dataset.dropId;
    if (!spot || !id) continue;
    const arg = spot.dataset.dropArg;
    if (targets.get(id)?.accepts(payload, arg)) return { id, ...(arg ? { arg } : {}) };
  }
  return null;
}

export function DragLayer({
  children,
  onDragChange,
}: {
  children: ReactNode;
  /** The drag starting, moving to another spot, or ending. */
  onDragChange?(state: DragState | null): void;
}) {
  const [state, setState] = useState<DragState | null>(null);
  const [ghost, setGhost] = useState<ReactNode>(null);
  const pointer = useMemo(() => new PointerStore(), []);
  const targets = useRef(new Map<string, DropTarget>());
  const dropped = useRef(false);
  const stop = useRef<(() => void) | null>(null);
  const change = useRef(onDragChange);
  const fit = useStage();
  const fitRef = useRef(fit);
  useEffect(() => {
    change.current = onDragChange;
    fitRef.current = fit;
  });
  useEffect(() => () => stop.current?.(), []);

  const api = useMemo<DragApi>(() => {
    const update = (next: DragState | null) => {
      setState(next);
      change.current?.(next);
      if (next) document.body.dataset.dragging = next.payload.kind;
      else delete document.body.dataset.dragging;
    };
    return {
      state: null,
      pointer,
      justDropped: () => dropped.current,
      register(id, target) {
        targets.current.set(id, target);
        return () => {
          if (targets.current.get(id) === target) targets.current.delete(id);
        };
      },
      accepts: () => false,
      begin(e, payload, g) {
        const x0 = e.clientX;
        const y0 = e.clientY;
        let active = false;
        let hover: DropSpot | null = null;
        const move = (ev: PointerEvent) => {
          if (!active && Math.hypot(ev.clientX - x0, ev.clientY - y0) < DRAG_START) return;
          if (!active) {
            active = true;
            sfx('ui.dragPick');
            setGhost(g);
            update({ payload, hover: null });
          }
          pointer.set({ x: ev.clientX, y: ev.clientY });
          const next = spotAt(ev.clientX, ev.clientY, payload, targets.current);
          if (next?.id !== hover?.id || next?.arg !== hover?.arg) {
            hover = next;
            update({ payload, hover });
          }
        };
        const finish = (drop: boolean, ev?: PointerEvent) => {
          end();
          if (!active) return;
          // The click that follows this pointerup isn't a click.
          dropped.current = true;
          window.setTimeout(() => (dropped.current = false), 0);
          pointer.set(null);
          update(null);
          setGhost(null);
          if (!drop || !ev) {
            sfx('ui.dragNo');
            return;
          }
          const spot = spotAt(ev.clientX, ev.clientY, payload, targets.current);
          // Dropped somewhere it can't go: it slides back.
          sfx(spot ? 'ui.dragDrop' : 'ui.dragNo');
          if (spot) {
            targets.current.get(spot.id)?.onDrop(payload, spot.arg, {
              x: (ev.clientX - fitRef.current.left) / fitRef.current.scale,
              y: (ev.clientY - fitRef.current.top) / fitRef.current.scale,
            });
          }
        };
        const up = (ev: PointerEvent) => finish(true, ev);
        const cancel = () => finish(false);
        const key = (ev: KeyboardEvent) => {
          if (ev.key !== 'Escape' || !active) return;
          ev.stopPropagation();
          cancel();
        };
        const end = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          window.removeEventListener('pointercancel', cancel);
          window.removeEventListener('keydown', key, true);
          stop.current = null;
        };
        stop.current?.();
        stop.current = end;
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', cancel);
        window.addEventListener('keydown', key, true);
      },
    };
  }, [pointer]);

  // The value changes with the drag, so spots re-mark themselves; the handlers stay the same.
  const value = useMemo<DragApi>(
    () => ({
      ...api,
      state,
      accepts: (id, arg) => !!state && !!targets.current.get(id)?.accepts(state.payload, arg),
    }),
    [api, state],
  );

  return (
    <DragContext.Provider value={value}>
      {children}
      {state && <Ghost>{ghost}</Ghost>}
    </DragContext.Provider>
  );
}

/** The copy under the pointer, at the stage's scale. */
function Ghost({ children }: { children: ReactNode }) {
  const fit = useStage();
  const at = useDragPointer();
  if (!at) return null;
  return createPortal(
    <div
      className={styles.ghost}
      style={{ left: at.x, top: at.y, scale: String(fit.scale) }}
      aria-hidden="true"
    >
      {children}
    </div>,
    document.body,
  );
}
