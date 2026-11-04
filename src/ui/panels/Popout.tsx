import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';

interface PopoutProps {
  label: string;
  onClose(): void;
  className?: string;
  style?: CSSProperties;
  /** Clicks inside these elements don't count as clicking away (e.g. the button that opened it). */
  ignore?: readonly RefObject<HTMLElement | null>[];
  children: ReactNode;
}

/** A floating box that closes when you click anywhere else, or press Esc. */
export function Popout({ label, onClose, className, style, ignore = [], children }: PopoutProps) {
  const ref = useRef<HTMLDivElement>(null);
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
  }, []);

  return (
    <div ref={ref} className={className} style={style} role="dialog" aria-label={label}>
      {children}
    </div>
  );
}
