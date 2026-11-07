/**
 * The weathers (docs/design/05-nights-and-weather.md, "Weather"). Each has an
 * effect on the hikers and one on the nodes, as kinds the engine knows
 * (src/engine/weather.ts). Clear has none.
 *
 * - Hiker effects start after the first full day of the weather (a grace day).
 * - Node effects start at once, rolling at the start of every phase.
 * - When the weather ends, changed nodes go back and Shivering and Burning end.
 */
import { BALANCE } from '../config/balance';
import type { Hooks } from '../engine/effects';
import type { WeatherId } from '../engine/types';

export type HikerEffectKind = 'drizzle' | 'staticAir' | 'sheerCold' | 'blisteringHeat';
export type NodeEffectKind = 'floods' | 'thunder' | 'freezing' | 'forestFires';

export interface WeatherEffectDef<K> {
  kind: K;
  name: string;
  /** One line for the weather change screen. */
  text: string;
}

export interface WeatherDef {
  id: WeatherId;
  name: string;
  /** The weather change screen's big title ("CLEAR SKIES"). */
  title: string;
  hiker?: WeatherEffectDef<HikerEffectKind>;
  node?: WeatherEffectDef<NodeEffectKind>;
  /** While it lasts, a source on every hiker (Storm's Thunder thins out Wildlife). */
  hooks?: Hooks;
}

const W = BALANCE.weather;
const pct = (n: number) => `${Math.round(n * 100)}%`;

export const WEATHERS: Readonly<Record<WeatherId, WeatherDef>> = {
  clear: { id: 'clear', name: 'Clear', title: 'Clear skies' },
  rain: {
    id: 'rain',
    name: 'Rain',
    title: 'Rain',
    hiker: {
      kind: 'drizzle',
      name: 'Drizzle',
      text: `Each phase, a hiker with no clothes on and no shelter becomes Wet. Each clothing item has a ${pct(W.drizzleWear)} chance to lose 1 durability.`,
    },
    node: {
      kind: 'floods',
      name: 'Floods',
      text: `Each phase, Mountain nodes have a ${pct(W.nodeChance)} chance to flood and count as River nodes.`,
    },
  },
  storm: {
    id: 'storm',
    name: 'Storm',
    title: 'Storm',
    hiker: {
      kind: 'staticAir',
      name: 'Static Air',
      text: 'Each phase, a hiker with full Energy is struck by lightning: 1 injury, and Energy drops to half.',
    },
    node: {
      kind: 'thunder',
      name: 'Thunder',
      text: 'Wildlife resources are much rarer when scavenging.',
    },
    hooks: {
      modifyScavenge: () => ({
        source: 'Thunder',
        label: 'Thunder: Wildlife cards are rare',
        tone: 'warning',
        nodeWeight: { wildlife: W.thunderWildlifeWeight },
      }),
    },
  },
  snow: {
    id: 'snow',
    name: 'Snow',
    title: 'Snow',
    hiker: {
      kind: 'sheerCold',
      name: 'Sheer Cold',
      text: 'Each phase, hikers gain 3 Shivering, minus 1 for each clothing item, each hiker with them, and 2 under a shelter. 3 = Frozen, 5 = injury.',
    },
    node: {
      kind: 'freezing',
      name: 'Freezing',
      text: `Each phase, River nodes have a ${pct(W.nodeChance)} chance to freeze over and give no resources until the snow ends.`,
    },
  },
  heatwave: {
    id: 'heatwave',
    name: 'Heatwave',
    title: 'Heatwave',
    hiker: {
      kind: 'blisteringHeat',
      name: 'Blistering Heat',
      text: 'Each phase, hikers gain 1 Burning for each clothing item they wear and each hiker with them. 5 = injury.',
    },
    node: {
      kind: 'forestFires',
      name: 'Forest Fires',
      text: `Each phase, Forest nodes have a ${pct(W.nodeChance)} chance to catch fire, and fires spread to connected Forest tiles (${pct(W.fireSpread)}). Fire nodes give nothing; ending a phase on one gives 1 Burning.`,
    },
  },
};

export const WEATHER_IDS = Object.keys(WEATHERS) as WeatherId[];
