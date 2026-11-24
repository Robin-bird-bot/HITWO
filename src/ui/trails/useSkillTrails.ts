/**
 * When Skill Trails opens (Phase 10.7): as a window from a hiker frame or the
 * party level pill, and full screen when a night starts (or a ranger
 * station opens) while points are unspent. Once per night and per station;
 * reloading mid-night doesn't open it again.
 */
import { useEffect, useState } from 'react';
import { partyOf, treesOf, type GameState } from '../../engine';

export interface TrailsOpen {
  hikerId: string;
  full: boolean;
}

/** Night or a station: the moment points can be spent, as a key that changes once each. */
const spendKey = (state: GameState): string | null =>
  state.station
    ? `station-${state.sectionIndex}`
    : state.phase === 'night'
      ? `night-${state.day}`
      : null;

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

/** "Party level 3! +1 point": each party level reached shows for a moment. */
export function usePartyToast(state: GameState, ms = 3200): string | null {
  const [seen, setSeen] = useState(() => state.nextEventId);
  const [text, setText] = useState<string | null>(null);
  if (state.nextEventId !== seen) {
    const fresh = state.log.filter((e) => e.id >= seen && e.kind === 'partyLevel');
    setSeen(state.nextEventId);
    const last = fresh.at(-1);
    if (last?.kind === 'partyLevel') {
      const points = fresh.reduce((n, e) => n + (e.kind === 'partyLevel' ? e.points : 0), 0);
      setText(`Party level ${last.level}! +${points} point${points === 1 ? '' : 's'}`);
    }
  }
  useEffect(() => {
    if (!text) return;
    const timer = setTimeout(() => setText(null), ms);
    return () => clearTimeout(timer);
  }, [text, ms]);
  return text;
}
