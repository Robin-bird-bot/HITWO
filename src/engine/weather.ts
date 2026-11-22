/**
 * Weather (Phase 10.6, docs/design/08-overhaul-plan.md, "Weather").
 *
 * - The day's weather comes from a forecast, on its own RNG stream: each
 *   weather lasts 1–3 days, then the next is drawn from the odds (every
 *   section uses the Meadow odds until Phase 11 gives each biome its own).
 *   A hike starts Clear.
 * - It changes at the start of a day.
 * - Its only effect is on scavenging (src/content/weather.ts and
 *   src/engine/scavenge/setup.ts). Nothing else: no conditions, no node changes.
 */
import { BALANCE } from '../config/balance';
import { endWeatherConditions } from './conditions';
import { pushEvent } from './log';
import { int, seedRng, weightedPick } from './rng';
import type { GameState, WeatherId, WeatherState } from './types';

const W = BALANCE.weather;

/** How many days a weather lasts, and which comes next. */
function nextSpell(w: WeatherState): { weather: WeatherId; days: number } {
  const S = W.schedule;
  const kinds = Object.entries(S.odds) as [WeatherId, number][];
  const weather = weightedPick(
    w.rng,
    kinds.map(([item, weight]) => ({ item, weight })),
  );
  return { weather, days: int(w.rng, S.days.min, S.days.max) };
}

/** A new hike's weather: Clear to start, for as long as a spell lasts. */
export function freshWeather(seed: number, day = 1): WeatherState {
  const w: WeatherState = {
    today: 'clear',
    since: day,
    ahead: [],
    rng: seedRng((seed ^ 0x5eedfa11) >>> 0),
  };
  const clear = int(w.rng, W.schedule.days.min, W.schedule.days.max);
  for (let i = 1; i < clear; i++) w.ahead.push('clear');
  fillForecast(w);
  return w;
}

/** Tops up the days ahead with spells of weather. */
export function fillForecast(w: WeatherState): void {
  while (w.ahead.length < W.forecastDays) {
    const { weather, days } = nextSpell(w);
    for (let i = 0; i < days; i++) w.ahead.push(weather);
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

/** At the start of a day: tomorrow's weather becomes today's. */
export function advanceWeather(state: GameState): void {
  const w = state.weather;
  if (w.hold) return;
  const next = w.ahead.shift() ?? 'clear';
  fillForecast(w);
  if (next !== w.today) changeWeather(state, next);
}

/**
 * A new weather starts today. Stacked conditions that last "until the weather
 * changes" (Shivering, Burning: from challenges and items now) end, as their
 * own rule says; the weather itself gives none.
 */
export function changeWeather(state: GameState, to: WeatherId): void {
  const from = state.weather.today;
  endWeatherConditions(state);
  state.weather.today = to;
  state.weather.since = state.day;
  pushEvent(state, { kind: 'weatherChanged', from, to, days: weatherDaysLeft(state.weather) });
}
