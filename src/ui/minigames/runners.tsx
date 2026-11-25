/**
 * Each playable minigame's game and preview, by id (src/minigames/catalog.ts).
 *
 * - **Bearrels** runs its own rounds and results card.
 * - **The puzzle games** (Traildle, Find the Object, Remember the Path, Find
 *   the Path, Dodge, Trail Map, Memory Puzzle, Picture Puzzle, Thin Ice,
 *   Trail Blocks, Sleeping Bear, Whackoon, Crossing, Train! and Rafting)
 *   report how they ended; the play stage shows the shared results card.
 *   Their preview is a still frame for now.
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
import { Dodge } from './dodge/Dodge';
import { FindObject } from './findObject/FindObject';
import { FindPath } from './findPath/FindPath';
import { MemoryPuzzle } from './memory/MemoryPuzzle';
import { PicturePuzzle } from './picturePuzzle/PicturePuzzle';
import { SleepingBear } from './sleepingBear/SleepingBear';
import { TrailBlocks } from './trailBlocks/TrailBlocks';
import { Crossing } from './lanes/Crossing';
import { Rafting } from './lanes/Rafting';
import { Train } from './lanes/Train';
import { Whackoon } from './whackoon/Whackoon';
import { ThinIce } from './thinIce/ThinIce';
import { TrailMap } from './trailMap/TrailMap';
import type { PuzzleRunProps } from './puzzleProps';
import { RememberPath } from './rememberPath/RememberPath';
import { Traildle } from './traildle/Traildle';

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

/** Bearrels: plays its own rounds and shows its own results card. */
export const RUNNERS: Readonly<Record<string, ComponentType<MinigameRunProps>>> = {
  bearrels: BearrelsRun,
};

/** The puzzle games: they report how they ended, and the play stage shows the results. */
export const PUZZLES: Readonly<Record<string, ComponentType<PuzzleRunProps>>> = {
  traildle: Traildle,
  findObject: FindObject,
  rememberPath: RememberPath,
  findPath: FindPath,
  dodge: Dodge,
  trailMap: TrailMap,
  memory: MemoryPuzzle,
  picturePuzzle: PicturePuzzle,
  thinIce: ThinIce,
  trailBlocks: TrailBlocks,
  sleepingBear: SleepingBear,
  whackoon: Whackoon,
  crossing: Crossing,
  train: Train,
  rafting: Rafting,
};

/** Still frames of the puzzle games (the pop-up's GPS and the testing tab). */
const noop = () => {};
function TraildleStill({ settings, hikers }: MinigamePreviewProps) {
  return <Traildle settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function FindObjectStill({ settings, hikers }: MinigamePreviewProps) {
  return <FindObject settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function RememberPathStill({ settings, hikers }: MinigamePreviewProps) {
  return <RememberPath settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function FindPathStill({ settings, hikers }: MinigamePreviewProps) {
  return <FindPath settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}

function DodgeStill({ settings, hikers }: MinigamePreviewProps) {
  return <Dodge settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function TrailMapStill({ settings, hikers }: MinigamePreviewProps) {
  return <TrailMap settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function MemoryStill({ settings, hikers }: MinigamePreviewProps) {
  return <MemoryPuzzle settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function PicturePuzzleStill({ settings, hikers }: MinigamePreviewProps) {
  return <PicturePuzzle settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function ThinIceStill({ settings, hikers }: MinigamePreviewProps) {
  return <ThinIce settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function TrailBlocksStill({ settings, hikers }: MinigamePreviewProps) {
  return <TrailBlocks settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function SleepingBearStill({ settings, hikers }: MinigamePreviewProps) {
  return <SleepingBear settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function WhackoonStill({ settings, hikers }: MinigamePreviewProps) {
  return <Whackoon settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}

function CrossingStill({ settings, hikers }: MinigamePreviewProps) {
  return <Crossing settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function TrainStill({ settings, hikers }: MinigamePreviewProps) {
  return <Train settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function RaftingStill({ settings, hikers }: MinigamePreviewProps) {
  return <Rafting settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}

export const PREVIEWS: Readonly<Record<string, ComponentType<MinigamePreviewProps>>> = {
  bearrels: BearrelsPreviewRun,
  traildle: TraildleStill,
  findObject: FindObjectStill,
  rememberPath: RememberPathStill,
  findPath: FindPathStill,
  dodge: DodgeStill,
  trailMap: TrailMapStill,
  memory: MemoryStill,
  picturePuzzle: PicturePuzzleStill,
  thinIce: ThinIceStill,
  trailBlocks: TrailBlocksStill,
  sleepingBear: SleepingBearStill,
  whackoon: WhackoonStill,
  crossing: CrossingStill,
  train: TrainStill,
  rafting: RaftingStill,
};
