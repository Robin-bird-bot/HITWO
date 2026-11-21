/**
 * One drag system for the whole game (Nov 14 update, section 6), on pointer
 * events so it works with a mouse and a finger.
 *
 * - A source spreads `useDrag(payload, ghost)`. A press becomes a drag only
 *   after the pointer moves a few pixels, so taps and clicks still work.
 * - A target calls `useDrop(id, { accepts, onDrop })` and spreads
 *   `drop.props(arg)` on each spot (one id can cover many spots, each with
 *   its own `arg`: every tile is `tile`, with its id).
 * - While dragging, each spot is marked `data-drop`: `ok` (it would take the
 *   thing: it glows), `hover` (the pointer's over it) or `no` (it dims).
 * - Dropping anywhere else, or Esc, cancels. The DragLayer draws the ghost.
 */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import type { HikerId, ResourceId } from '../../engine';

/**
 * What's being dragged: a hiker, a bag item or resource from a pack, a shop
 * card, or a hiker card on the selection screen (from the list, or a spot).
 */
export type DragPayload =
  | { kind: 'hiker'; hikerId: HikerId }
  | { kind: 'pick'; hikerId: string; spot: number | null }
  | { kind: 'item'; hikerId: HikerId; itemUid: string }
  | { kind: 'resource'; hikerId: HikerId; resource: ResourceId }
  | { kind: 'offer'; offerId: string };

/** A spot under the pointer: a target's id, and which of its spots. */
export interface DropSpot {
  id: string;
  arg?: string;
}

export interface DropTarget {
  accepts(payload: DragPayload, arg?: string): boolean;
  /** `at`: where it was dropped, in stage pixels (for a pop-up there). */
  onDrop(payload: DragPayload, arg: string | undefined, at: { x: number; y: number }): void;
}

export interface DragState {
  payload: DragPayload;
  /** The spot under the pointer that would take it, if any. */
  hover: DropSpot | null;
}

/** Where the pointer is during a drag, in screen pixels. Changes on every move. */
export class PointerStore {
  private point: { x: number; y: number } | null = null;
  private listeners = new Set<() => void>();
  get = () => this.point;
  set(point: { x: number; y: number } | null) {
    this.point = point;
    for (const l of this.listeners) l();
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

export interface DragApi {
  state: DragState | null;
  pointer: PointerStore;
  /** On a source's pointerdown: becomes a drag once the pointer moves. */
  begin(e: PointerEvent<Element>, payload: DragPayload, ghost: ReactNode): void;
  register(id: string, target: DropTarget): () => void;
  accepts(id: string, arg?: string): boolean;
  /** True just after a drop, so the click that follows the pointerup is ignored. */
  justDropped(): boolean;
}

export const DragContext = createContext<DragApi | null>(null);

/** The drag in progress, if any. */
export const useDragState = () => useContext(DragContext)?.state ?? null;

/** The pointer during a drag (screen pixels), re-rendering on every move. */
export function useDragPointer() {
  const api = useContext(DragContext);
  const store = api?.pointer;
  return useSyncExternalStore(store?.subscribe ?? noSubscribe, store?.get ?? noPoint, noPoint);
}
const noSubscribe = () => () => {};
const noPoint = () => null;

export interface DragHandlers {
  onPointerDown?(e: PointerEvent<Element>): void;
  onDragStart?(e: React.DragEvent): void;
  onClickCapture?(e: MouseEvent<Element>): void;
  'data-draggable'?: true;
}

/**
 * Handlers that make an element a drag source. `stop`: the press doesn't
 * reach what's underneath (a token's press shouldn't also pan the map).
 */
export function useDrag(
  payload: DragPayload | null,
  ghost: ReactNode,
  { disabled = false, stop = false }: { disabled?: boolean; stop?: boolean } = {},
): DragHandlers {
  const api = useContext(DragContext);
  if (!api || !payload || disabled) return {};
  return {
    'data-draggable': true,
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      if (stop) e.stopPropagation();
      api.begin(e, payload, ghost);
    },
    // The browser's own image dragging would cancel ours.
    onDragStart: (e) => e.preventDefault(),
    onClickCapture: (e) => {
      if (api.justDropped()) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };
}

export interface DropProps {
  'data-drop-id': string;
  'data-drop-arg'?: string;
  'data-drop'?: 'ok' | 'hover' | 'no';
}

/** Registers a drop target; `props(arg)` marks each of its spots. */
export function useDrop(id: string, target: DropTarget) {
  const api = useContext(DragContext);
  const live = useRef(target);
  useEffect(() => {
    live.current = target;
  });
  useEffect(() => {
    if (!api) return;
    return api.register(id, {
      accepts: (p, arg) => live.current.accepts(p, arg),
      onDrop: (p, arg, at) => live.current.onDrop(p, arg, at),
    });
  }, [api, id]);
  const state = api?.state ?? null;
  return {
    props(arg?: string): DropProps {
      const base: DropProps = { 'data-drop-id': id, ...(arg ? { 'data-drop-arg': arg } : {}) };
      if (!state) return base;
      const hovered = state.hover?.id === id && state.hover.arg === arg;
      return {
        ...base,
        'data-drop': hovered ? 'hover' : target.accepts(state.payload, arg) ? 'ok' : 'no',
      };
    },
  };
}
