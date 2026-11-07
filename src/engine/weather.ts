/**
 * Weather (docs/design/05-nights-and-weather.md, "Weather").
 *
 * - The day's weather comes from a forecast filled by a placeholder schedule
 *   (Clear for a few days, then a random weather), on its own RNG stream.
 *   TODO(phase 11): each biome's own weather odds.
 * - It changes at the start of a day. Changed nodes go back, and Shivering
 *   and Burning end.
 * - At the start of each phase: the node effect rolls (at once), then the
 *   hiker effect (after a grace day: from the day after the weather began).
 * - At the end of each phase: a hiker on a tile with a Fire node gains 1 Burning.
 *
 * Effects are kinds named in src/content/weather.ts; nothing here names a weather.
 */
import { BALANCE } from '../config/balance';
import { ITEMS } from '../content';
import { WEATHERS, type HikerEffectKind, type NodeEffectKind } from '../content/weather';
import { addCondition, addStacks, endWeatherConditions } from './conditions';
import { clothesWorn } from './effects';
import { pushEvent } from './log';
import { adjacentTileIds, hikersOnTile, isSheltered } from './map';
import { int, roll, seedRng, weightedPick } from './rng';
import { addInjury, changeStat, statMax } from './stats';
import type {
  GameState,
  Hiker,
  NodeType,
  NodeWeatherState,
  Tile,
  TileId,
  TileNode,
  WeatherId,
  WeatherState,
} from './types';

const W = BALANCE.weather;

/** A new hike's weather: Clear for a few days, then the schedule. */
export function freshWeather(seed: number, day = 1): WeatherState {
  const w: WeatherState = {
    today: 'clear',
    since: day,
    ahead: [],
    rng: seedRng((seed ^ 0x5eedfa11) >>> 0),
  };
  const clear = int(w.rng, W.schedule.clearDays.min, W.schedule.clearDays.max);
  for (let i = 1; i < clear; i++) w.ahead.push('clear');
  fillForecast(w);
  return w;
}

/** Tops up the days ahead: after Clear comes a random weather, after a weather comes Clear. */
export function fillForecast(w: WeatherState): void {
  const S = W.schedule;
  while (w.ahead.length < W.forecastDays) {
    const last = w.ahead.at(-1) ?? w.today;
    if (last === 'clear') {
      const kinds = Object.entries(S.weights) as [WeatherId, number][];
      const next = weightedPick(
        w.rng,
        kinds.map(([item, weight]) => ({ item, weight })),
      );
      const n = int(w.rng, S.weatherDays.min, S.weatherDays.max);
      for (let i = 0; i < n; i++) w.ahead.push(next);
    } else {
      const n = int(w.rng, S.clearDays.min, S.clearDays.max);
      for (let i = 0; i < n; i++) w.ahead.push('clear');
    }
  }
}

/** How many days this weather lasts from today, as far as the forecast shows. */
export function weatherDaysLeft(w: WeatherState): number {
  let n = 1;
  for (const d of w.ahead) {
    if (d !== w.today) break;
    n += 1;
  }
  return n;
}

/** Hiker effects wait out the first full day of a weather. */
export function hikerEffectActive(state: GameState): boolean {
  return state.day > state.weather.since;
}

/** At the start of a day: tomorrow's weather becomes today's. */
export function advanceWeather(state: GameState): void {
  const w = state.weather;
  if (w.hold) return;
  const next = w.ahead.shift() ?? 'clear';
  fillForecast(w);
  if (next !== w.today) changeWeather(state, next);
}

/** A new weather starts today: changed nodes go back, and Shivering and Burning end. */
export function changeWeather(state: GameState, to: WeatherId): void {
  const from = state.weather.today;
  revertNodes(state);
  endWeatherConditions(state);
  state.weather.today = to;
  state.weather.since = state.day;
  pushEvent(state, { kind: 'weatherChanged', from, to, days: weatherDaysLeft(state.weather) });
}

/** Every node the weather changed goes back to what it was. */
export function revertNodes(state: GameState): void {
  for (const tile of Object.values(state.section.tiles)) {
    for (const node of tile.nodes) {
      if (!node.weather) continue;
      node.type = node.weather.was;
      delete node.weather;
    }
  }
}

/** Does this node give anything when scavenging? Frozen and Fire nodes don't. */
export const nodeGives = (n: TileNode): boolean =>
  n.weather?.state !== 'frozen' && n.weather?.state !== 'fire';

/** Does this node count as its type for challenges and Tend? A Fire node isn't Forest any more. */
export const nodeCounts = (n: TileNode): boolean => n.weather?.state !== 'fire';

/** A node's new state, keeping what it was. A flooded node counts as River. */
export function setNodeState(node: TileNode, state: NodeWeatherState): void {
  if (node.type === 'caps' || node.weather) return;
  node.weather = { state, was: node.type };
  if (state === 'flooded') node.type = 'river';
}

/** Which node type each node state comes from. */
export const STATE_FROM: Record<NodeWeatherState, NodeType> = {
  flooded: 'mountain',
  frozen: 'river',
  fire: 'forest',
};

// ── The start and end of each phase ────────────────────────────────────────

/** Hikers the weather reaches (anyone still on the trail). */
const outdoors = (state: GameState) =>
  state.hikers.filter((h) => h.status === 'active' || h.status === 'passedOut');

export function weatherPhaseStart(state: GameState): void {
  const def = WEATHERS[state.weather.today];
  if (def.node) nodeEffect(state, def.node.kind);
  if (def.hiker && hikerEffectActive(state)) {
    for (const h of outdoors(state)) hikerEffect(state, def.hiker.kind, def.hiker.name, h);
  }
}

/** A hiker ending a phase on a tile with a Fire node gains 1 Burning. */
export function weatherPhaseEnd(state: GameState): void {
  for (const h of outdoors(state)) {
    const tile = state.section.tiles[h.tileId];
    if (tile?.nodes.some((n) => n.weather?.state === 'fire')) {
      addStacks(state, h, 'burning', 1, 'a forest fire');
    }
  }
}

function nodeEffect(state: GameState, kind: NodeEffectKind): void {
  switch (kind) {
    case 'floods':
      return changeNodes(state, 'flooded');
    case 'freezing':
      return changeNodes(state, 'frozen');
    case 'forestFires':
      changeNodes(state, 'fire');
      return spreadFire(state);
    case 'thunder':
      // A scavenge source while it storms (src/content/weather.ts).
      return;
  }
}

/** Each node of the right type has a chance to change. */
function changeNodes(state: GameState, to: NodeWeatherState): void {
  const tiles = new Set<TileId>();
  for (const tile of Object.values(state.section.tiles)) {
    for (const node of tile.nodes) {
      if (node.weather || node.type !== STATE_FROM[to]) continue;
      if (!roll(state.rng, W.nodeChance)) continue;
      setNodeState(node, to);
      tiles.add(tile.id);
    }
  }
  if (tiles.size) pushEvent(state, { kind: 'nodesChanged', state: to, tiles: [...tiles] });
}

const burning = (t: Tile) => t.nodes.some((n) => n.weather?.state === 'fire');

/** Fire spreads: a connected tile with a Forest node has a chance to catch. */
function spreadFire(state: GameState): void {
  const tiles = state.section.tiles;
  const onFire = Object.values(tiles).filter(burning);
  const near = new Set<TileId>();
  for (const t of onFire) for (const id of adjacentTileIds(state.section, t.id)) near.add(id);
  const caught: TileId[] = [];
  for (const id of near) {
    const t = tiles[id];
    const forest = t?.nodes.find((n) => !n.weather && n.type === 'forest');
    if (!t || burning(t) || !forest) continue;
    if (!roll(state.rng, W.fireSpread)) continue;
    setNodeState(forest, 'fire');
    caught.push(id);
  }
  if (caught.length)
    pushEvent(state, { kind: 'nodesChanged', state: 'fire', tiles: [], spread: caught });
}

function hikerEffect(state: GameState, kind: HikerEffectKind, cause: string, h: Hiker): void {
  const others = hikersOnTile(state, h.tileId).filter((x) => x.id !== h.id).length;
  const clothes = clothesWorn(h);
  switch (kind) {
    case 'drizzle': {
      if (clothes === 0 && !isSheltered(state, h)) {
        addCondition(state, h, 'wet', W.drizzleWetDays, 'days', cause);
      }
      // TODO(phase 9): durability arrives with items; the wear is kept on the item until then.
      for (const item of Object.values(h.inventory.equipped)) {
        if (!item || ITEMS[item.itemId]?.type !== 'clothes') continue;
        if (roll(state.rng, W.drizzleWear)) item.wear = (item.wear ?? 0) + 1;
      }
      return;
    }
    case 'staticAir': {
      if (h.stats.energy < statMax(state, h, 'energy')) return;
      addInjury(state, h, `lightning (${cause})`);
      const half = Math.floor(h.stats.energy / 2);
      changeStat(state, h, 'energy', half - h.stats.energy, cause);
      return;
    }
    case 'sheerCold': {
      const c = W.sheerCold;
      const n =
        c.base -
        clothes * c.perClothes -
        others * c.perHiker -
        (isSheltered(state, h) ? c.shelter : 0);
      // Below 0, they warm up: Shivering goes down instead (never below 0).
      if (n !== 0) addStacks(state, h, 'shivering', n, cause);
      return;
    }
    case 'blisteringHeat': {
      const n = clothes + others;
      if (n > 0) addStacks(state, h, 'burning', n, cause);
      return;
    }
  }
}
