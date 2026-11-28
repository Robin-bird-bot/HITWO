import { isHikeOver, type GameState } from '../../engine';

const PHASE = { morning: 'Morning', afternoon: 'Afternoon', night: 'Night' } as const;
/** Each biome's name. */
export const BIOME_NAMES = {
  meadow: 'Meadow',
  temperateRainforest: 'Temperate Rainforest',
  alpine: 'Alpine',
} as const;

/** "Day 3 · Afternoon · Meadow" (or "Hike over · Day 8 · Meadow"), for the Continue button. */
export function describeSave(game: GameState): string {
  const where = `Day ${game.day} · ${PHASE[game.phase]} · ${BIOME_NAMES[game.section.biome]}`;
  return isHikeOver(game)
    ? `Hike over · Day ${game.day} · ${BIOME_NAMES[game.section.biome]}`
    : where;
}
