/** Each biome's land layers for the backdrop (docs/ASSETS.md). */
import { ASSETS } from '../../config/assets';
import type { BiomeId } from '../../engine';

/** Land layers back to front, with how fast each moves when the map scrolls. */
export const BIOME_LAND: Record<BiomeId, readonly { src: string; parallax: number }[]> = {
  meadow: [
    { src: ASSETS.land.blueMountains, parallax: 0.15 },
    { src: ASSETS.land.greenRidge, parallax: 0.3 },
    { src: ASSETS.land.grassHills, parallax: 0.5 },
  ],
  // The UI overhaul (Phase 12) adds the Rainforest and Alpine art.
  temperateRainforest: [],
  alpine: [],
};
