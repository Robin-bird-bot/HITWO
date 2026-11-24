/**
 * Each playable minigame's game, by id (src/minigames/catalog.ts): what the
 * party GPS's screen shows. A game gets its settings, the hikers, a seed, and
 * reports how it ended.
 */
import type { ComponentType } from 'react';
import type { MinigameHiker, MinigameResult, MinigameSettings } from '../../minigames/types';
import { BearrelsGame } from './bearrels/BearrelsGame';

export interface MinigameRunProps {
  settings: MinigameSettings;
  hikers: readonly MinigameHiker[];
  seed: number;
  onDone(result: MinigameResult): void;
}

const num = (v: number | readonly string[] | undefined, fallback: number) =>
  typeof v === 'number' ? v : fallback;

function BearrelsRun({ settings, hikers, seed, onDone }: MinigameRunProps) {
  return (
    <BearrelsGame
      settings={{
        barrels: num(settings.barrels, 3),
        rounds: num(settings.rounds, 3),
        shots: num(settings.shots, 1),
      }}
      hikers={hikers}
      seed={seed}
      onDone={onDone}
    />
  );
}

export const RUNNERS: Readonly<Record<string, ComponentType<MinigameRunProps>>> = {
  bearrels: BearrelsRun,
};
