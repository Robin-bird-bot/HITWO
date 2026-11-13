import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useDraggable } from '../windows/useDraggable';
import type { WindowId } from '../windows/windowLayout';

interface PopoutProps {
  label: string;
  onClose(): void;
  className?: string;
  style?: CSSProperties;
  /** Clicks inside these elements don't count as clicking away (e.g. the button that opened it). */
  ignore?: readonly RefObject<HTMLElement | null>[];
  /** Makes it movable: drag it by any child marked `data-drag-handle`. */
  dragId?: WindowId;
  /** Moves focus to its first button when it opens, and back where it was when it closes. */
  focusFirst?: boolean;
  children: ReactNode;
}

const FOCUSABLE = 'button:not([disabled]), [href], input, select, [tabindex]:not([tabindex="-1"])';

/** A floating box that closes when you click anywhere else, or press Esc. */
export function Popout({
  label,
  onClose,
  className,
  style,
  ignore = [],
  dragId,
  focusFirst = false,
  children,
}: PopoutProps) {
  const { ref, windowProps, translate } = useDraggable<HTMLDivElement>(dragId);
  const live = useRef({ onClose, ignore });
  useEffect(() => {
    live.current = { onClose, ignore };
  });

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (live.current.ignore.some((r) => r.current?.contains(target))) return;
      live.current.onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') live.current.onClose();
    };
    // Wait a tick so the click that opened it doesn't close it.
    const id = window.setTimeout(() => {
      window.addEventListener('pointerdown', onDown);
      window.addEventListener('keydown', onKey);
    });
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [ref]);

  useEffect(() => {
    if (!focusFirst) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    return () => {
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, [focusFirst, ref]);
  // A step that swaps its buttons (Use → pick → confirm) drops focus: catch it, on the
  // button the step marks `data-autofocus` (a confirm's safe answer) or the first one.
  // Watched as the box changes, since a step's state can live in any child.
  useEffect(() => {
    const box = ref.current;
    if (!focusFirst || !box) return;
    const watch = new MutationObserver(() => {
      if (document.activeElement !== document.body) return;
      const next =
        box.querySelector<HTMLElement>('[data-autofocus]') ??
        box.querySelector<HTMLElement>(FOCUSABLE);
      next?.focus({ preventScroll: true });
    });
    watch.observe(box, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, [focusFirst, ref]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ ...style, translate }}
      role="dialog"
      aria-label={label}
      {...windowProps}
    >
      {children}
    </div>
  );
}
