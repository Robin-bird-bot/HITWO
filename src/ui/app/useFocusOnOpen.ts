import { useEffect, useRef } from 'react';

/**
 * A window or screen that just opened takes the keyboard focus, and gives it
 * back when it closes, to the first of these that's still there and usable:
 * - whatever had it (the button that opened it);
 * - the window around that (a card just bought is disabled now);
 * - the newest window still open that uses this hook (a menu item that
 *   closed as this opened).
 * Put the ref on an element with `tabIndex={-1}`.
 */
export function useFocusOnOpen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    el?.setAttribute('data-focus-home', '');
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const around = before?.parentElement?.closest<HTMLElement>('[tabindex="-1"]') ?? null;
    el?.focus({ preventScroll: true });
    return () => {
      const usable = (x: HTMLElement | null | undefined): x is HTMLElement =>
        !!x?.isConnected && x !== document.body && !(x as HTMLButtonElement).disabled;
      const homes = [...document.querySelectorAll<HTMLElement>('[data-focus-home]')].filter(
        (x) => x !== el && usable(x),
      );
      const back = [before, around, homes[homes.length - 1]].find(usable);
      back?.focus({ preventScroll: true });
    };
  }, []);
  return ref;
}
