/**
 * Where each movable window has been dragged to (Nov 5 update, 2a), kept as
 * an offset from its default spot and remembered per device. Storage can
 * fail (private windows, blocked site data), so every read and write is
 * wrapped in try/catch and the game works the same without it.
 */
import { useCallback, useSyncExternalStore } from 'react';
import type { StorageLike } from '../../store/autosave';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../stage/fitStage';

export const WINDOW_KEY = 'hike-in-the-woods/windows';

/** Every window that can be dragged. Pop-outs keep their offset from wherever they open. */
export type WindowId =
  | 'challenge'
  | 'party'
  | 'turn'
  | 'log'
  | 'scavenge'
  | 'confirm'
  | 'settings'
  | 'details'
  | 'inventory'
  | 'weather'
  | 'goal'
  | 'wonder'
  | 'nightEvent';

export interface Offset {
  x: number;
  y: number;
}

/** A window's default box on the stage, before any offset. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Windows dragged this close to a stage edge snap to the edge's 16 px gutter. */
export const SNAP_DISTANCE = 20;
export const GUTTER = 16;

const ZERO: Offset = { x: 0, y: 0 };

/**
 * Where a window ends up: kept fully on the stage, and snapped to the gutter
 * when it's dragged close to an edge.
 *
 * `keep`: a window nearly as big as the stage (the challenge pop-up) can be
 * dragged aside, partly off the stage, as long as this many pixels of it stay
 * on. Its top never goes above the stage, so the title bar can't be lost.
 */
export function placeWindow(base: Box, wanted: Offset, snap = true, keep?: number): Offset {
  let x = base.x + wanted.x;
  let y = base.y + wanted.y;
  const minX = keep === undefined ? 0 : keep - base.w;
  const maxX = keep === undefined ? Math.max(0, STAGE_WIDTH - base.w) : STAGE_WIDTH - keep;
  const maxY = keep === undefined ? Math.max(0, STAGE_HEIGHT - base.h) : STAGE_HEIGHT - keep;

  if (snap) [x, y] = snapToGutter(x, y, base);

  x = Math.min(maxX, Math.max(minX, x));
  y = Math.min(maxY, Math.max(0, y));
  return { x: Math.round(x - base.x), y: Math.round(y - base.y) };
}

function snapToGutter(x: number, y: number, base: Box): [number, number] {
  if (Math.abs(x - GUTTER) < SNAP_DISTANCE) x = GUTTER;
  if (Math.abs(x + base.w - (STAGE_WIDTH - GUTTER)) < SNAP_DISTANCE)
    x = STAGE_WIDTH - GUTTER - base.w;
  if (Math.abs(y - GUTTER) < SNAP_DISTANCE) y = GUTTER;
  if (Math.abs(y + base.h - (STAGE_HEIGHT - GUTTER)) < SNAP_DISTANCE)
    y = STAGE_HEIGHT - GUTTER - base.h;
  return [x, y];
}

export function readOffsets(storage: StorageLike | undefined): Partial<Record<WindowId, Offset>> {
  try {
    const raw = storage?.getItem(WINDOW_KEY);
    if (raw == null) return {};
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return {};
    const out: Partial<Record<WindowId, Offset>> = {};
    for (const [id, v] of Object.entries(data as Record<string, unknown>)) {
      const o = v as Partial<Offset> | null;
      if (o && Number.isFinite(o.x) && Number.isFinite(o.y)) {
        out[id as WindowId] = { x: o.x as number, y: o.y as number };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function writeOffsets(
  storage: StorageLike | undefined,
  offsets: Partial<Record<WindowId, Offset>>,
): void {
  try {
    storage?.setItem(WINDOW_KEY, JSON.stringify(offsets));
  } catch {
    // Not saved this time; the window still moves.
  }
}

function browserStorage(): StorageLike | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

// One shared copy for the whole screen.
let offsets: Partial<Record<WindowId, Offset>> | null = null;
const listeners = new Set<() => void>();

function current(): Partial<Record<WindowId, Offset>> {
  offsets ??= readOffsets(browserStorage());
  return offsets;
}

function save(next: Partial<Record<WindowId, Offset>>) {
  offsets = next;
  writeOffsets(browserStorage(), next);
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A window's remembered offset, and ways to change or forget it. */
export function useWindowOffset(
  id: WindowId | undefined,
): [Offset, (o: Offset) => void, () => void] {
  const offset = useSyncExternalStore(subscribe, () => (id ? current()[id] : undefined)) ?? ZERO;
  const set = useCallback(
    (o: Offset) => {
      if (!id) return;
      save({ ...current(), [id]: o });
    },
    [id],
  );
  const reset = useCallback(() => {
    if (!id) return;
    const next = { ...current() };
    delete next[id];
    save(next);
  }, [id]);
  return [offset, set, reset];
}

/** Settings → "Reset window layout": every window back to its default spot. */
export function resetWindowLayout(): void {
  save({});
}
