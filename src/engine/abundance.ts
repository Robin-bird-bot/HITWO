/**
 * Abundance: one bar for the whole biome, 0 to BALANCE.abundance.max (Nov 14
 * update; it was a meter per node). Scavenging any node lowers it, and its
 * level sets one thing: the chance a resource card comes up Empty.
 */
import { BALANCE } from '../config/balance';
import { pushEvent } from './log';
import type { GameState } from './types';

const A = BALANCE.abundance;

/** The bar at the start of each biome. */
export function freshAbundance(): number {
  return A.start;
}

/** Keeps a level between 0 and the maximum. */
export function clampAbundance(level: number): number {
  return Math.max(0, Math.min(A.max, level));
}

/** Changes the bar, keeping it between 0 and the maximum. */
export function changeAbundance(state: GameState, delta: number): void {
  state.abundance = clampAbundance(state.abundance + delta);
}

/**
 * The chance each resource card dealt comes up Empty at this level: the
 * full-bar chance at the maximum, rising evenly to the empty-bar chance at 0.
 */
export function emptyChance(level: number): number {
  const { atFull, atZero } = A.emptyChance;
  const share = clampAbundance(level) / A.max;
  return atZero + (atFull - atZero) * share;
}

/** At camp: the bar recovers a little. */
export function recoverOvernight(state: GameState): void {
  const from = state.abundance;
  changeAbundance(state, A.nightRecovery);
  if (state.abundance !== from) pushEvent(state, { kind: 'recovered', from, to: state.abundance });
}
