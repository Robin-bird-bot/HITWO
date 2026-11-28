/**
 * When Skill Trails opens (Phase 10.7): as a window from a hiker frame or the
 * hiker picker, and full screen when a ranger station opens while points are
 * unspent (once per station; reloading doesn't open it again). At night the
 * camp recap offers the points instead (35-ui-overhaul.md, section 7).
 */
import { useEffect, useState } from 'react';
import { partyOf, treesOf, type GameState } from '../../engine';

export interface TrailsOpen {
  hikerId: string;
  full: boolean;
}

/** A station: a moment points can be spent, as a key that changes once each. */
const spendKey = (state: GameState): string | null =>
  state.station ? `station-${state.sectionIndex}` : null;

/** Opens Skill Trails from outside the game screen (the debug panel's edge test). */
export const OPEN_TRAILS_EVENT = 'hike-in-the-woods/open-skill-trails';

export function useSkillTrails(state: GameState) {
  const [open, setOpen] = useState<TrailsOpen | null>(null);
  const firstId = state.hikers.find((h) => h.status !== 'abandoned' && !!treesOf(h))?.id;
  useEffect(() => {
    const onOpen = (e: Event) => {
      const full = !!(e as CustomEvent<{ full?: boolean }>).detail?.full;
      if (firstId) setOpen({ hikerId: firstId, full });
    };
    window.addEventListener(OPEN_TRAILS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_TRAILS_EVENT, onOpen);
  }, [firstId]);
  const key = spendKey(state);
  const [seen, setSeen] = useState(key);
  if (key !== seen) {
    setSeen(key);
    const first = state.hikers.find((h) => h.status !== 'abandoned' && !!treesOf(h));
    if (key && first && partyOf(state).points > 0) setOpen({ hikerId: first.id, full: true });
  }
  return [open, setOpen] as const;
}
