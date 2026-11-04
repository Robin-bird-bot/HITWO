import { createContext, useContext } from 'react';
import type { StageFit } from './fitStage';

export const StageContext = createContext<StageFit>({ scale: 1, left: 0, top: 0 });

/** The current stage scale and letterbox, for converting pointer positions to stage pixels. */
export function useStage(): StageFit {
  return useContext(StageContext);
}
