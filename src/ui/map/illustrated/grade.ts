/**
 * The land's grade for the moment (Phase 10.5, section 9): night, the
 * weather, and the route view, plus warm glows at night where hikers camp
 * (a Campsite with hikers on it, or a shelter someone slept in). Sit by the
 * Fire glows too once it's built (it's still held).
 */
import type { GameState } from '../../../engine';
import type { MapGeometry } from './geometry';
import type { Grade } from './landGl';

export interface GradeOverride {
  night?: boolean;
  weather?: 'rain' | 'snow' | 'storm' | 'heatwave' | 'clear';
}

export function landGrade(
  state: GameState,
  routes: boolean,
  land: { x0: number; y0: number },
  geo: MapGeometry,
  force: GradeOverride = {},
): Omit<Grade, 'time'> {
  const night = force.night ?? state.phase === 'night';
  const weather = force.weather ?? state.weather?.today ?? 'clear';
  const glows: { x: number; y: number }[] = [];
  if (night) {
    for (const t of Object.values(state.section.tiles)) {
      const here = state.hikers.filter((h) => h.tileId === t.id && h.status === 'active');
      if (!here.length) continue;
      const camp = t.special === 'campsite';
      const shelter = !!t.shelters?.length && here.some((h) => h.slept);
      const c = geo.centers[t.id];
      if ((camp || shelter) && c) glows.push({ x: c.x - land.x0, y: c.y - land.y0 });
    }
  }
  return {
    night: night ? 1 : 0,
    rain: weather === 'rain' || weather === 'storm' ? 1 : 0,
    storm: weather === 'storm' ? 1 : 0,
    snow: weather === 'snow' ? 1 : 0,
    heat: weather === 'heatwave' ? 1 : 0,
    routes: routes ? 1 : 0,
    glows,
  };
}
