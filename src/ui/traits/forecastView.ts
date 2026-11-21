/**
 * What the trait warnings show (src/engine/traits/forecast.ts): tomorrow
 * morning's Morale traits, or, while an action is being looked at (a move
 * pop-up open, a hiker dragged over a tile, an action button pointed at),
 * what that action would do. One context, read by the badges and portraits.
 */
import { createContext, useContext } from 'react';
import {
  forecastAction,
  forecastStartOfDay,
  type Action,
  type GameState,
  type HikerId,
  type MoraleForecasts,
} from '../../engine';
import type { TraitWarnings } from '../app/traitWarnings';

export interface ForecastView {
  /** Morale traits right away, from the action being looked at. */
  now: MoraleForecasts;
  /** Tomorrow morning's Morale traits. */
  tomorrow: MoraleForecasts;
  /** The game the forecast is for: after the action, if there is one. */
  state: GameState;
}

/** The forecast now, or for an action being looked at (if it's allowed). */
export function forecastView(state: GameState, action?: Action | null): ForecastView {
  const f = action ? forecastAction(state, action) : undefined;
  return f ?? { now: {}, tomorrow: forecastStartOfDay(state), state };
}

/** Morale a hiker is about to lose through traits: now and tomorrow morning together. */
export function moraleAtRisk(view: ForecastView, hikerId: HikerId): number {
  const loss = (d: number | undefined) => Math.min(0, d ?? 0);
  return -(loss(view.now[hikerId]?.delta) + loss(view.tomorrow[hikerId]?.delta));
}

export interface TraitView {
  warnings: TraitWarnings;
  /** Null when warnings are off. */
  view: ForecastView | null;
}

export const TraitViewContext = createContext<TraitView>({ warnings: 'off', view: null });

export const useTraitView = (): TraitView => useContext(TraitViewContext);
