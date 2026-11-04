import type { GameState } from '../../engine';

const PHASE = { morning: 'Morning', afternoon: 'Afternoon', night: 'Night' } as const;
const BIOME = {
  meadow: 'Meadow',
  temperateRainforest: 'Temperate Rainforest',
  alpine: 'Alpine',
} as const;

/** "Day 3 · Afternoon · Meadow", for the Continue button. */
export function describeSave(game: GameState): string {
  return `Day ${game.day} · ${PHASE[game.phase]} · ${BIOME[game.section.biome]}`;
}
