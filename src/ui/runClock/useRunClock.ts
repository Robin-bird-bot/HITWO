/**
 * Runs the run clock from the game screen (29-core-loop.md, section 9): it
 * counts played time while the page is in view, by section; times each
 * minigame challenge from its pop-up to its end; and logs the summary to the
 * console when the run ends.
 */
import { useEffect, useRef } from 'react';
import { BALANCE } from '../../config/balance';
import { DEFAULT_DIFFICULTY } from '../../config/difficulty';
import { isHikeOver, type GameState } from '../../engine';
import { addTime, closeMinigame, freshClock, openMinigame, summary } from './runClock';
import { runClockStore } from './store';

const C = BALANCE.run.clock;

export function useRunClock(
  state: GameState,
  minigame: { key: string; name: string; tier: number } | null,
): void {
  const { seed, sectionIndex: section } = state;
  const difficulty = state.difficulty ?? DEFAULT_DIFFICULTY;
  const over = isHikeOver(state);

  // This run's clock: picked up where it was, or a new one for a new run.
  useEffect(() => {
    const c = runClockStore.get();
    if (!c || c.seed !== seed || (c.ended && !over))
      runClockStore.set(freshClock(seed, difficulty));
  }, [seed, difficulty, over]);

  // Played time, while the page is in view.
  const sectionRef = useRef(section);
  useEffect(() => {
    sectionRef.current = section;
  });
  useEffect(() => {
    if (over) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const sec = Math.min(C.gapSec, (now - last) / 1000);
      last = now;
      if (document.visibilityState !== 'visible') return;
      const c = runClockStore.get();
      if (c?.seed === seed) runClockStore.set(addTime(c, sec, sectionRef.current));
    }, C.tickSec * 1000);
    return () => window.clearInterval(id);
  }, [seed, over]);

  // Each minigame challenge, from its pop-up to its end.
  const key = minigame?.key ?? null;
  const name = minigame?.name ?? '';
  const tier = minigame?.tier ?? 0;
  useEffect(() => {
    if (!key) return;
    const c = runClockStore.get();
    if (c?.seed === seed) runClockStore.set(openMinigame(c, { name, tier }, section));
    return () => {
      const now = runClockStore.get();
      if (now?.seed === seed && now.open) runClockStore.set(closeMinigame(now));
    };
  }, [key, name, tier, seed, section]);

  // The run is over: the summary, once.
  useEffect(() => {
    if (!over) return;
    const c = runClockStore.get();
    if (c?.seed !== seed || c.ended) return;
    const done = { ...closeMinigame(c), ended: true as const };
    runClockStore.set(done);
    console.info(summary(done));
  }, [over, seed]);
}
