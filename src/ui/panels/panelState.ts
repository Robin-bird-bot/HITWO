/**
 * Which panels are shrunk to their header, remembered per device
 * (BUILD_PLAN "Collapsible panels"). Storage can fail (private windows,
 * blocked site data), so every read and write is wrapped in try/catch and the
 * game works the same without it.
 */
import { useCallback, useSyncExternalStore } from 'react';
import type { StorageLike } from '../../store/autosave';

export const PANEL_KEY = 'hike-in-the-woods/panels';

export type PanelId = 'biome' | 'day' | 'objective' | 'abundance' | 'party' | 'turn' | 'log';

/** Panels shrunk on a first visit. The mockup draws the trail log minimized. */
const DEFAULT_COLLAPSED: readonly PanelId[] = ['log'];

export function readCollapsed(storage: StorageLike | undefined): Set<PanelId> {
  try {
    const raw = storage?.getItem(PANEL_KEY);
    if (raw == null) return new Set(DEFAULT_COLLAPSED);
    const list: unknown = JSON.parse(raw);
    return new Set(
      Array.isArray(list) ? (list.filter((x) => typeof x === 'string') as PanelId[]) : [],
    );
  } catch {
    return new Set(DEFAULT_COLLAPSED);
  }
}

export function writeCollapsed(storage: StorageLike | undefined, collapsed: Set<PanelId>): void {
  try {
    storage?.setItem(PANEL_KEY, JSON.stringify([...collapsed].sort()));
  } catch {
    // Not saved this time; the panel still toggles.
  }
}

function browserStorage(): StorageLike | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

// One shared copy for the whole screen, so every panel sees changes.
let collapsed: Set<PanelId> | null = null;
const listeners = new Set<() => void>();

function current(): Set<PanelId> {
  collapsed ??= readCollapsed(browserStorage());
  return collapsed;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether a panel is shrunk, and a toggle that remembers the choice. */
export function usePanelCollapsed(id: PanelId): [boolean, () => void] {
  const isCollapsed = useSyncExternalStore(subscribe, () => current().has(id));
  const toggle = useCallback(() => {
    const next = new Set(current());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    collapsed = next;
    writeCollapsed(browserStorage(), next);
    for (const l of listeners) l();
  }, [id]);
  return [isCollapsed, toggle];
}

/** Shrinks or opens a panel from code (Simple mode starts the trail log shrunk). */
export function setPanelCollapsed(id: PanelId, value: boolean): void {
  if (current().has(id) === value) return;
  const next = new Set(current());
  if (value) next.add(id);
  else next.delete(id);
  collapsed = next;
  writeCollapsed(browserStorage(), next);
  for (const l of listeners) l();
}
