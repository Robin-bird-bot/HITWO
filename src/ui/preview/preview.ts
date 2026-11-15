/**
 * Card previews (Nov 14 update, section 8): anywhere a card or item shows,
 * the full card opens large, with its text.
 * - On a desktop: hover for a moment (or reach it with the keyboard).
 * - On a phone: long-press. The tap that follows doesn't count as a click.
 * - By clicking, where a click does nothing else (`clickOpens`).
 * One provider (PreviewLayer) draws it; `usePreview` gives any element the
 * handlers to spread on it. Without a provider (galleries, mockups) it does
 * nothing.
 */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { BALANCE } from '../../config/balance';
import { mergeHandlers } from '../app/mergeHandlers';
import type { ItemId, ItemInstance, ScavengeCard } from '../../engine';

export type PreviewContent =
  | {
      kind: 'item';
      itemId: ItemId;
      /** The instance, when there is one: its Quality and what's left. */
      item?: Partial<ItemInstance>;
      /** Quality not rolled yet: ranges across Qualities 1–5. */
      unrolled?: boolean;
      /** A line under the card ("Sells for 3 caps"). */
      note?: string;
    }
  | { kind: 'scavenge'; card: ScavengeCard };

export interface PreviewApi {
  /** Pinned previews stay until a tap anywhere or Esc; the rest close when the pointer leaves. */
  show(content: PreviewContent, anchor: Element, pinned: boolean): void;
  hide(anchor: Element): void;
}

export const PreviewContext = createContext<PreviewApi | null>(null);

export interface PreviewHandlers {
  onPointerEnter?(e: PointerEvent<Element>): void;
  onPointerLeave?(e: PointerEvent<Element>): void;
  onPointerDown?(e: PointerEvent<Element>): void;
  onPointerMove?(e: PointerEvent<Element>): void;
  onPointerUp?(e: PointerEvent<Element>): void;
  onPointerCancel?(e: PointerEvent<Element>): void;
  onClickCapture?(e: MouseEvent<Element>): void;
  onClick?(e: MouseEvent<Element>): void;
  onContextMenu?(e: MouseEvent<Element>): void;
  onFocus?(e: FocusEvent<Element>): void;
  onBlur?(e: FocusEvent<Element>): void;
}

/** How far (stage-agnostic CSS pixels) a finger can drift and still be a long-press. */
const PRESS_SLOP = 10;

/** Handlers that open `content`'s preview; spread them on the card or name. */
export function usePreview(
  content: PreviewContent | null | undefined,
  { clickOpens = false }: { clickOpens?: boolean } = {},
): PreviewHandlers {
  const api = useContext(PreviewContext);
  const timer = useRef<number | undefined>(undefined);
  const press = useRef<{ x: number; y: number; long: boolean } | null>(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  if (!api || !content) return {};
  const clear = () => window.clearTimeout(timer.current);
  return {
    onPointerEnter: (e) => {
      // Nothing pops up over the spots while something is being dragged.
      if (e.pointerType !== 'mouse' || document.body.dataset.dragging) return;
      clear();
      const el = e.currentTarget;
      timer.current = window.setTimeout(
        () => api.show(content, el, false),
        BALANCE.ui.previewHoverMs,
      );
    },
    onPointerLeave: (e) => {
      clear();
      if (e.pointerType === 'mouse') api.hide(e.currentTarget);
    },
    onPointerDown: (e) => {
      clear();
      if (e.pointerType === 'mouse') {
        api.hide(e.currentTarget);
        return;
      }
      const el = e.currentTarget;
      press.current = { x: e.clientX, y: e.clientY, long: false };
      timer.current = window.setTimeout(() => {
        if (press.current) press.current.long = true;
        api.show(content, el, true);
      }, BALANCE.ui.longPressMs);
    },
    onPointerMove: (e) => {
      const p = press.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > PRESS_SLOP) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    // The tap that ends a long-press isn't a click.
    onClickCapture: (e) => {
      if (press.current?.long) {
        e.preventDefault();
        e.stopPropagation();
      }
      press.current = null;
    },
    onContextMenu: (e) => {
      if (press.current) e.preventDefault();
    },
    onFocus: (e) => {
      if (e.currentTarget.matches(':focus-visible')) api.show(content, e.currentTarget, false);
    },
    onBlur: (e) => api.hide(e.currentTarget),
    ...(clickOpens ? { onClick: (e) => api.show(content, e.currentTarget, true) } : {}),
  };
}

/**
 * An element's own handlers and the preview's, run one after the other
 * (the element's first). For cards that already react to clicks or presses.
 */
export function withPreview<T extends object>(own: T, preview: PreviewHandlers): T {
  return mergeHandlers<T>(own, preview);
}
