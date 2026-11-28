/**
 * Tells the ambience where the party is (`ambience.ts`). The scene changes
 * only when one of its parts does; null leaves it to another screen.
 */
import { useEffect } from 'react';
import { ambience, type AmbienceScene } from './ambience';

export function useAmbience(scene: AmbienceScene | null): void {
  const { place, biome, night, weather, river, fire } = scene ?? { place: null };
  useEffect(() => {
    if (!place) return;
    ambience.set({
      place,
      ...(biome ? { biome } : {}),
      ...(night ? { night } : {}),
      ...(weather ? { weather } : {}),
      ...(river ? { river } : {}),
      ...(fire ? { fire } : {}),
    });
  }, [place, biome, night, weather, river, fire]);
}
