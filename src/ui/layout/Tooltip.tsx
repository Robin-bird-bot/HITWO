/**
 * Tooltips that are never cut off (Phase 10.6, part B). The tip renders in
 * the stage's top layer, so no parent window clips it. It's measured, then
 * placed on the side it prefers, flipped if there's no room, and nudged
 * inside the game screen with a margin (placePopup).
 *
 * Outside a Stage (mockup pages) it renders in place, as before.
 */
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../stage/fitStage';
import { useStage, useTopLayer } from '../stage/StageContext';
import { placePopup, type Side } from './placePopup';

export interface TooltipAnchor {
  ref: RefCallback<HTMLElement>;
  onPointerEnter(): void;
  onPointerLeave(): void;
  onFocus(): void;
  onBlur(): void;
}

/**
 * A tooltip for one anchor: spread `anchor` on the element it describes and
 * put `tip` anywhere in the tree. `inline` is the old in-place look, used
 * when there's no top layer.
 */
export function useTooltip(
  content: ReactNode,
  {
    prefer = 'above',
    className,
    style,
  }: { prefer?: Side; className?: string; style?: CSSProperties } = {},
): { anchor: TooltipAnchor; tip: ReactNode; inline: boolean } {
  const layer = useTopLayer();
  const fit = useStage();
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const tipRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !el || !tipRef.current) {
      setPlace(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const a = {
      left: (r.left - fit.left) / fit.scale,
      right: (r.right - fit.left) / fit.scale,
      top: (r.top - fit.top) / fit.scale,
      bottom: (r.bottom - fit.top) / fit.scale,
    };
    const size = { w: tipRef.current.offsetWidth, h: tipRef.current.offsetHeight };
    const p = placePopup(a, size, { w: STAGE_WIDTH, h: STAGE_HEIGHT }, prefer, 10);
    setPlace({ left: p.left, top: p.top });
  }, [open, el, fit, prefer]);

  const anchor: TooltipAnchor = {
    ref: setEl,
    onPointerEnter: () => setOpen(true),
    onPointerLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
  };
  if (!layer) return { anchor, tip: null, inline: true };
  const tip =
    open &&
    createPortal(
      <div
        ref={tipRef}
        role="tooltip"
        className={className}
        style={{
          ...style,
          position: 'absolute',
          left: place?.left ?? 0,
          top: place?.top ?? 0,
          visibility: place ? 'visible' : 'hidden',
          pointerEvents: 'none',
        }}
      >
        {content}
      </div>,
      layer,
    );
  return { anchor, tip, inline: false };
}
