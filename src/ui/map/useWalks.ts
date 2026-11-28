/**
 * Tokens walk (Wyatt, Nov 28): when a hiker moves, their token slides along
 * the line it walked for about a second, with footsteps as it goes
 * (32-audio-system.md, section 6), and sets down with `map.arrive`. Under
 * reduced motion the token jumps, and the steps still play.
 *
 * The token is drawn at its new tile at once; the walk is a transform from
 * the old tile back to zero along the path, so nothing else on the map has
 * to wait for it.
 */
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { sfx } from '../../audio/engine';
import { footstepFor, panAt, stepMs } from '../../audio/footsteps';
import { BALANCE } from '../../config/balance';
import type { Hiker, HikerId, Section, TileId } from '../../engine';
import { useReducedMotion } from '../app/useReducedMotion';
import type { Placer } from './illustrated/geometryContext';

const WALK_MS = BALANCE.audio.walkSec * 1000;

/** Where an element sits left to right on screen, as a pan. */
function panOf(el: HTMLElement | undefined): number {
  if (!el || typeof window === 'undefined' || !window.innerWidth) return 0;
  const r = el.getBoundingClientRect();
  return panAt((r.left + r.width / 2) / window.innerWidth);
}

/**
 * Watches the hikers' tiles and walks any token whose tile changed. Returns a
 * ref for each hiker's token.
 */
export function useWalks(
  section: Section,
  hikers: readonly Hiker[],
  place: Placer,
  snowing: boolean,
): (id: HikerId) => (el: HTMLElement | null) => void {
  const reduced = useReducedMotion();
  const els = useRef(new Map<HikerId, HTMLElement>());
  const refs = useRef(new Map<HikerId, (el: HTMLElement | null) => void>());
  const was = useRef<{ key: string; tiles: Map<HikerId, TileId> } | null>(null);
  const timers = useRef(new Set<number>());
  const later = (fn: () => void, ms: number) => {
    const t = window.setTimeout(() => {
      timers.current.delete(t);
      fn();
    }, ms);
    timers.current.add(t);
  };

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending) window.clearTimeout(t);
    };
  }, []);

  useLayoutEffect(() => {
    // A new section starts everyone fresh: nobody walks onto it.
    const key = `${section.trailheadId}:${section.checkpointId}`;
    const before = was.current?.key === key ? was.current.tiles : null;
    const now = new Map<HikerId, TileId>();
    for (const h of hikers) if (h.status !== 'abandoned') now.set(h.id, h.tileId);
    was.current = { key, tiles: now };
    if (!before) return;

    for (const h of hikers) {
      const from = before.get(h.id);
      const to = now.get(h.id);
      if (!from || !to || from === to) continue;
      const a = section.tiles[from];
      const b = section.tiles[to];
      if (!a || !b) continue;
      const line = section.lines.find(
        (l) => (l.a === from && l.b === to) || (l.a === to && l.b === from),
      );
      const la = line && section.tiles[line.a];
      const lb = line && section.tiles[line.b];
      let points = line && la && lb ? [...place.path(line.id, la, lb)] : [];
      if (points.length < 2) points = [place.center(a), place.center(b)];
      else if (line?.a !== from) points.reverse();
      const el = els.current.get(h.id);
      const end = place.center(b);

      if (el && !reduced && typeof el.animate === 'function') {
        // The token is already at its new spot: no slide on left and top, just the walk.
        el.style.transition = 'width 0.15s ease, height 0.15s ease';
        const walk = el.animate(
          points.map((p) => ({ transform: `translate(${p.x - end.x}px, ${p.y - end.y}px)` })),
          { duration: WALK_MS, easing: 'ease-in-out' },
        );
        const done = () => {
          el.style.transition = '';
        };
        walk.onfinish = done;
        walk.oncancel = done;
      }

      // The steps, then the token set down.
      const step = footstepFor(line?.kind ?? 'normal', h.family, snowing);
      const every = stepMs(h.family);
      const count = Math.max(1, Math.round(WALK_MS / every));
      for (let i = 0; i < count; i++) {
        later(
          () => sfx(step.id, { volume: step.volume, pan: panOf(els.current.get(h.id)) }),
          i * every,
        );
      }
      later(() => sfx('map.arrive', { pan: panOf(els.current.get(h.id)) }), WALK_MS);
    }
  });

  return useCallback((id: HikerId) => {
    let ref = refs.current.get(id);
    if (!ref) {
      ref = (el: HTMLElement | null) => {
        if (el) els.current.set(id, el);
        else els.current.delete(id);
      };
      refs.current.set(id, ref);
    }
    return ref;
  }, []);
}
