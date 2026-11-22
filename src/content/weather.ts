/**
 * The weathers (Phase 10.6, docs/design/08-overhaul-plan.md, "Weather"). The
 * only effect is on scavenging, each kind tied to a node:
 *
 * - on a tile with that node, its resources are likelier (`BALANCE.weather.boost`);
 * - on any tile, each resource card has a chance to be one of that node's
 *   resources instead (`BALANCE.weather.swapChance`), with a small weather icon.
 *
 * No other effects: weather gives no conditions, changes no nodes and picks
 * no challenges. Storm and Fog are gone for now.
 */
import { BALANCE } from '../config/balance';
import type { Hooks } from '../engine/effects';
import type { NodeType, WeatherId } from '../engine/types';

export interface WeatherDef {
  id: WeatherId;
  name: string;
  /** The weather change screen's big title ("CLEAR SKIES"). */
  title: string;
  /** The node whose resources it brings (none for Clear). */
  node?: NodeType;
  /** One line for the pop-up and the forecast ("Rain: more River resources."). */
  line: string;
  /** While it lasts, a scavenging source on every hiker. */
  hooks?: Hooks;
}

const NODE_NAME: Record<NodeType, string> = {
  forest: 'Forest',
  river: 'River',
  mountain: 'Mountain',
  wildlife: 'Wildlife',
};

function weather(id: WeatherId, name: string, title: string, node?: NodeType): WeatherDef {
  if (!node) return { id, name, title, line: `${name}: nothing changes.` };
  return {
    id,
    name,
    title,
    node,
    line: `${name}: more ${NODE_NAME[node]} resources.`,
    hooks: {
      modifyScavenge: () => ({
        source: name,
        label: `${name}: more ${NODE_NAME[node]} resources`,
        tone: 'bonus',
        nodeWeight: { [node]: BALANCE.weather.boost },
      }),
    },
  };
}

export const WEATHERS: Readonly<Record<WeatherId, WeatherDef>> = {
  clear: weather('clear', 'Clear', 'Clear skies'),
  rain: weather('rain', 'Rain', 'Rain', 'river'),
  snow: weather('snow', 'Snow', 'Snow', 'mountain'),
  wind: weather('wind', 'Wind', 'Wind', 'forest'),
  heatwave: weather('heatwave', 'Heatwave', 'Heatwave', 'wildlife'),
};

export const WEATHER_IDS = Object.keys(WEATHERS) as WeatherId[];
