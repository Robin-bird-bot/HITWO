/**
 * Bearrels' scene as data (docs/design/10-minigames.md, "Art styles": one
 * scene model, three renderers). What's in the scene — the barrels, who is
 * behind which, the bear, the crosshair and what a shot leaves — never
 * depends on the art style, so switching styles mid-round only redraws it.
 */
import type { MinigameHiker } from '../types';
import type { BearrelsState } from './logic';

export type BearPose = 'hidden' | 'up' | 'fire';

/** A hiker in the scene: behind which barrel, and whether they were just hit (tipping over). */
export interface SceneHiker {
  hiker: MinigameHiker;
  barrel: number;
  state: 'in' | 'hit';
}

export interface SceneModel {
  /** How many barrels. */
  barrels: number;
  hikers: readonly SceneHiker[];
  bear: BearPose;
  /** The crosshair, as a place along the barrel row (1.5 is halfway from barrel 2 to 3), or none. */
  crosshair: number | null;
  /** The barrel with a dashed cream outline and a glow (hovered, dragged over, or the keyboard's). */
  outline: number | null;
  /** The barrel just hit: it shakes, with splinters. */
  shaking: number | null;
  /** The barrel a shot missed everyone at: a puff of smoke. */
  smoke: number | null;
  /** A hiker just dropped: they slide into place from this point (game screen, 1280 × 960). */
  arriving: { id: string; x: number; y: number } | null;
}

/**
 * The hikers the scene shows: everyone placed, in token order, except those
 * gone (hit in an earlier shot this round, faded out) and the one being
 * dragged. Hikers hit by this round's shots are tipping over.
 */
export function sceneHikers(
  game: BearrelsState,
  hikers: readonly MinigameHiker[],
  fx: { tipped: readonly string[]; gone: readonly string[]; lifted?: string | null },
): SceneHiker[] {
  return game.hikers.flatMap((id) => {
    const barrel = game.placed[id];
    const hiker = hikers.find((h) => h.id === id);
    if (barrel === undefined || !hiker || fx.gone.includes(id) || fx.lifted === id) return [];
    return [{ hiker, barrel, state: fx.tipped.includes(id) ? 'hit' : 'in' }];
  });
}

/** An empty scene with this many barrels: the bear hidden, nobody placed. */
export const emptyScene = (barrels: number): SceneModel => ({
  barrels,
  hikers: [],
  bear: 'hidden',
  crosshair: null,
  outline: null,
  shaking: null,
  smoke: null,
  arriving: null,
});
