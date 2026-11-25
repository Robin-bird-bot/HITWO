/**
 * What every puzzle minigame's screen takes (docs/design/11-minigames-puzzles.md):
 * its settings from the testing tab, the hikers in line-up order, a seed, and
 * how it reports the result. `still` draws a frame that can't be played (the
 * pop-up's GPS preview and the testing tab's thumbnail).
 */
import type { MinigameHiker, MinigameResult, MinigameSettings } from '../../minigames/types';

export interface PuzzleRunProps {
  settings: MinigameSettings;
  /** In line-up order: the front of the line first. */
  hikers: readonly MinigameHiker[];
  seed: number;
  onDone(result: MinigameResult): void;
  still?: boolean;
}

/** The tier setting: 1, 2 or 3. */
export function tierOf(settings: MinigameSettings): 1 | 2 | 3 {
  const t = settings.tier;
  return t === 2 || t === 3 ? t : 1;
}

/** A pick setting's value ("auto" when unset). */
export function pickOf(settings: MinigameSettings, id: string): string {
  const v = settings[id];
  return typeof v === 'string' ? v : 'auto';
}

/** "1:24". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
