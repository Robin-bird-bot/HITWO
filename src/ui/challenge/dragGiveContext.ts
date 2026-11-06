/** The drag-to-a-space context (see dragGive.tsx). */
import {
  createContext,
  useContext,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { Source, Target } from './challengeDraft';

export interface DragGive {
  dragging: Source | null;
  /** Spread on a pack card or resource. */
  sourceProps(
    source: Source,
    preview: ReactNode,
  ): {
    onPointerDown(e: ReactPointerEvent): void;
    onDragStart(e: React.DragEvent): void;
    onClickCapture(e: React.MouseEvent): void;
    'data-draggable': true;
  };
  /** Spread on a space: marks it as a drop spot, and whether the dragged thing fits. */
  targetProps(t: Target): { 'data-drop': string; 'data-drop-ok'?: boolean };
}

export const DragGiveContext = createContext<DragGive | null>(null);

export const useDragGive = () => useContext(DragGiveContext);
