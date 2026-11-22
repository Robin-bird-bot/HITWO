/** How each weather looks in the UI (Phase 6; one effect each since Phase 10.6). */
import { WEATHERS } from '../../content/weather';
import { weatherDaysLeft, type GameState, type WeatherId } from '../../engine';
import type { IconName } from '../icons/paths';

/** Small stroke icons for the day bar, the forecast and a scavenge card's corner. */
export const WEATHER_ICON: Record<WeatherId, IconName> = {
  clear: 'sun',
  rain: 'rain',
  snow: 'snowflake',
  wind: 'wind',
  heatwave: 'flame',
};

export const WEATHER_COLOR: Record<WeatherId, string> = {
  clear: '#F2C978',
  rain: '#6FB3F2',
  snow: '#CFE6FA',
  wind: '#B9D8C8',
  heatwave: '#F0875A',
};

/** Under the weather's name: how long it lasts. */
export function weatherNote(state: GameState): string {
  const left = weatherDaysLeft(state.weather);
  return left === 1 ? 'Last day' : `${left} days`;
}

/** What the weather does, for a hover. */
export function weatherTitle(state: GameState): string {
  return WEATHERS[state.weather.today].line;
}
