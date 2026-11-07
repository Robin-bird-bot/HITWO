/** How each weather and weather effect looks in the UI (Phase 6). */
import { ASSETS } from '../../config/assets';
import { WEATHERS, type HikerEffectKind, type NodeEffectKind } from '../../content/weather';
import { hikerEffectActive, weatherDaysLeft, type GameState, type WeatherId } from '../../engine';
import type { IconName } from '../icons/paths';

/** Small stroke icons for the day bar and the forecast. */
export const WEATHER_ICON: Record<WeatherId, IconName> = {
  clear: 'sun',
  rain: 'rain',
  storm: 'zap',
  snow: 'snowflake',
  heatwave: 'flame',
};

export const WEATHER_COLOR: Record<WeatherId, string> = {
  clear: '#F2C978',
  rain: '#6FB3F2',
  storm: '#FFD23F',
  snow: '#CFE6FA',
  heatwave: '#F0875A',
};

/** The hiker effect's icon on the weather change screen. */
export const HIKER_EFFECT_ICON: Record<HikerEffectKind, IconName> = {
  drizzle: 'droplet',
  staticAir: 'zap',
  sheerCold: 'snowflake',
  blisteringHeat: 'flame',
};

/** The node effect's picture: the node art, or an icon where there's none (Thunder). */
export const NODE_EFFECT_ART: Record<NodeEffectKind, { image?: string; icon?: IconName }> = {
  floods: { image: ASSETS.nodeStateSquares.flooded },
  freezing: { image: ASSETS.nodeStateSquares.frozen },
  forestFires: { image: ASSETS.nodeStateSquares.fire },
  thunder: { icon: 'cloud' },
};

/** Under the weather's name: what it does now, or when it starts. */
export function weatherNote(state: GameState): string {
  const def = WEATHERS[state.weather.today];
  if (!def.hiker) return def.node ? def.node.name : 'No weather effects';
  if (!hikerEffectActive(state)) return `${def.hiker.name} tomorrow`;
  const left = weatherDaysLeft(state.weather);
  return left === 1 ? `${def.hiker.name} · last day` : `${def.hiker.name} · ${left} days`;
}

/** The weather's two effects, for a hover. */
export function weatherTitle(state: GameState): string {
  const def = WEATHERS[state.weather.today];
  const parts = [def.hiker, def.node].flatMap((e) => (e ? [`${e.name}: ${e.text}`] : []));
  return parts.length ? parts.join('\n') : 'Clear skies: no weather effects.';
}
