/**
 * The interface's own sounds (33-sound-list.md, "Menus and windows"), for
 * every button at once, so no screen has to remember them:
 *
 * - **A press** plays `ui.click`, or `ui.tab` on a tab. A button (or anything
 *   around it) can name another sound with `data-sound="ui.confirm"`, or
 *   none with `data-sound="none"`: the packing machines and the minigames
 *   make their own sounds, and the debug panel stays quiet.
 * - **Hovering** a button with a mouse plays `ui.hover` (buttons only, not
 *   cards or tiles: Wyatt's call, 32-audio-system.md, section 9).
 * - **A switch** (a checkbox) plays `ui.toggleOn` or `ui.toggleOff`.
 */
import { useEffect, useRef } from 'react';
import { sfx } from './engine';

const PRESSABLE = 'button, [role="button"], [role="tab"], [role="menuitem"], [role="radio"]';

/**
 * The sound a press on this element asks for, or null for none: its own
 * `data-sound`, silence inside a `data-sound="none"` scope, or the usual
 * click (a tab's flick).
 */
export function pressSound(el: Element): string | null {
  const scope = el.closest<HTMLElement>('[data-sound]');
  const named = scope?.dataset.sound;
  if (named === 'none') return null;
  if (named && scope === el) return named;
  return el.getAttribute('role') === 'tab' ? 'ui.tab' : 'ui.click';
}

/** True inside a `data-sound="none"` scope. */
const silenced = (el: Element) => el.closest('[data-sound]')?.getAttribute('data-sound') === 'none';

function pressable(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest<HTMLElement>(PRESSABLE);
  if (!el || el.matches(':disabled, [aria-disabled="true"]')) return null;
  return el;
}

let installed = false;

/** Listens for presses, hovers and switches on the whole page. */
export function installUiSounds(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  let hovered: Element | null = null;

  document.addEventListener('click', (e) => {
    const el = pressable(e.target);
    const id = el && pressSound(el);
    if (id) sfx(id);
  });

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = pressable(e.target);
    if (el === hovered) return;
    hovered = el;
    if (el && !silenced(el)) sfx('ui.hover');
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || t.type !== 'checkbox') return;
    if (silenced(t)) return;
    sfx(t.checked ? 'ui.toggleOn' : 'ui.toggleOff');
  });
}

/**
 * A window's sounds: `open` when it appears, `close` when it goes. (React's
 * development double mount doesn't play a close.)
 */
export function useOpenSound(open: string | null = 'ui.windowOpen', close = 'ui.windowClose') {
  const opened = useRef(0);
  useEffect(() => {
    opened.current = performance.now();
    if (open) sfx(open);
    return () => {
      if (performance.now() - opened.current > 100) sfx(close);
    };
  }, [open, close]);
}
