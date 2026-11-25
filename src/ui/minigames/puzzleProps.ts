/**
 * What every puzzle minigame's screen takes (docs/design/11-minigames-puzzles.md):
 * its settings from the testing tab, the hikers in line-up order, a seed, and
 * how it reports the result. `still` draws a frame that can't be played (the
 * pop-up's GPS preview and the testing tab's thumbnail).
 */
import {
  isTier,
  type MinigameHiker,
  type MinigameResult,
  type MinigameSettings,
  type Tier,
} from '../../minigames/types';

export interface PuzzleRunProps {
  settings: MinigameSettings;
  /** In line-up order: the front of the line first. */
  hikers: readonly MinigameHiker[];
  seed: number;
  onDone(result: MinigameResult): void;
  still?: boolean;
}

/** The tier setting: 1 to 5 (I to V). */
export function tierOf(settings: MinigameSettings): Tier {
  const t = settings.tier;
  return isTier(t) ? t : 1;
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
