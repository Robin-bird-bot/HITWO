/**
 * Each playable minigame's game and preview, by id (src/minigames/catalog.ts).
 * The game is what the turned GPS's screen shows: it gets its settings (the
 * art style among them), the hikers, a seed, and reports how it ended. The
 * preview is what the upright GPS loops in the pop-up before Start.
 */
import type { ComponentType } from 'react';
import { toArtStyle } from '../../minigames/bearrels/styles';
import type {
  MinigameHiker,
  MinigameResult,
  MinigameSettings,
  MinigameSettingValue,
} from '../../minigames/types';
import { BearrelsGame } from './bearrels/BearrelsGame';
import { BearrelsPreview } from './bearrels/BearrelsPreview';

export interface MinigameRunProps {
  settings: MinigameSettings;
  hikers: readonly MinigameHiker[];
  seed: number;
  onDone(result: MinigameResult): void;
}

export interface MinigamePreviewProps {
  settings: MinigameSettings;
  hikers: readonly MinigameHiker[];
}

const num = (v: MinigameSettingValue | undefined, fallback: number) =>
  typeof v === 'number' ? v : fallback;

function BearrelsRun({ settings, hikers, seed, onDone }: MinigameRunProps) {
  return (
    <BearrelsGame
      settings={{
        barrels: num(settings.barrels, 3),
        rounds: num(settings.rounds, 3),
        shots: num(settings.shots, 1),
      }}
      style={toArtStyle(settings.style)}
      hikers={hikers}
      seed={seed}
      onDone={onDone}
    />
  );
}

function BearrelsPreviewRun({ settings, hikers }: MinigamePreviewProps) {
  return <BearrelsPreview style={toArtStyle(settings.style)} hikers={hikers} />;
}

export const RUNNERS: Readonly<Record<string, ComponentType<MinigameRunProps>>> = {
  bearrels: BearrelsRun,
};

export const PREVIEWS: Readonly<Record<string, ComponentType<MinigamePreviewProps>>> = {
  bearrels: BearrelsPreviewRun,
};
