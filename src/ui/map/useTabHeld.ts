/**
 * Holding Tab shows the route view (Phase 10.5). Tab still moves focus as
 * usual whenever something is focused: it only counts as "hold" while nothing
 * is (the page itself) or the map has focus, so keyboard players keep Tab.
 */
import { useEffect, useState } from 'react';

const free = (el: Element | null) =>
  !el || el === document.body || !!el.closest('[aria-label="Trail map"]');

export function useTabHeld(): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
      if (!free(document.activeElement)) return;
      e.preventDefault();
      setHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Tab') setHeld(false);
    };
    const off = () => setHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', off);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', off);
    };
  }, []);
  return held;
}
