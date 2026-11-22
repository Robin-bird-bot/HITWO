/**
 * The debug panel's illustrated-map tools (Phase 10.5, section 11). All of
 * them only change the look on this screen: none touches the game state, and
 * nothing is saved.
 */
import { useSyncExternalStore } from 'react';
import type { GradeOverride } from './grade';
import type { LandDebug } from './LandCanvas';

export interface MapDebug {
  /** A different seed for the land only (the look, not the trail). */
  seed?: number;
  /** Paint everything, or nothing (to see the sketch). */
  reveal?: 'all' | 'none';
  /** Play a tile's reveal again. */
  replay?: { tileId: string; at: number };
  /** What the land shows: the land, the reveal mask, the land types or the height. */
  view?: 'land' | 'mask' | 'type' | 'height';
  /** Night or weather, whatever the game says. */
  grade?: GradeOverride;
  /** The route view, as if Routes were on. */
  routes?: boolean;
  /** Outlines around the stamps (cabins, peaks, deer…). */
  stampBoxes?: boolean;
}

let current: MapDebug = {};
const listeners = new Set<() => void>();

export const mapDebug = (): MapDebug => current;

export function setMapDebug(patch: Partial<MapDebug>): void {
  current = { ...current, ...patch };
  for (const l of listeners) l();
}

export function resetMapDebug(): void {
  current = {};
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const useMapDebug = (): MapDebug => useSyncExternalStore(subscribe, mapDebug, mapDebug);

/** True when a tool changes what shows as painted (then nothing is "found"). */
export const paintOverridden = (d: MapDebug): boolean => !!d.reveal;

/** What the land canvas itself needs: the paint overrides and the mask view. */
export function landDebugOf(d: MapDebug, wholeMap = false): LandDebug {
  // The debug panel's paint tools win over Show whole map while they're on.
  const reveal = d.reveal ?? (wholeMap ? ('whole' as const) : undefined);
  return {
    ...(reveal ? { reveal } : {}),
    ...(d.replay ? { replay: d.replay } : {}),
    ...(d.view === 'mask' ? { view: 'mask' as const } : {}),
  };
}
