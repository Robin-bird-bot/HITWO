import { createContext, useContext } from 'react';
import type { StageFit } from './fitStage';

export const StageContext = createContext<StageFit>({ scale: 1, left: 0, top: 0 });

/**
 * The stage's top layer (Phase 10.6): tooltips and hover windows render here,
 * above every window, so no parent window can cut them off. Null outside a
 * Stage (mockup pages), where they render in place.
 */
export const TopLayerContext = createContext<HTMLElement | null>(null);

export function useTopLayer(): HTMLElement | null {
  return useContext(TopLayerContext);
}

/** The current stage scale and letterbox, for converting pointer positions to stage pixels. */
export function useStage(): StageFit {
  return useContext(StageContext);
}
