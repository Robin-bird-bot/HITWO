/**
 * Each playable minigame's game and preview, by id (src/minigames/catalog.ts).
 *
 * - **The puzzle games** (Traildle, Find the Object, Remember the Path, Find
 *   the Path, Dodge, Trail Map, Memory Puzzle, Picture Puzzle, Minefield,
 *   Trail Blocks, Sleeping Bear, Whackoon, Crossing, Train!, Rafting, Camp Cleanup and
 *   the quick games)
 *   report how they ended; the play stage shows the shared results card.
 *   Their preview is a still frame for now.
 */
import type { ComponentType } from 'react';
import type { MinigameHiker, MinigameSettings } from '../../minigames/types';
import { CampCleanup } from './campCleanup/CampCleanup';
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
import { FireflyCatch } from './quick/FireflyCatch';
import { FlySwatter } from './quick/FlySwatter';
import { RaccoonShuffle } from './quick/RaccoonShuffle';
import { Safari } from './quick/Safari';
import { SizeUp } from './quick/SizeUp';
import { TrailBlazes } from './quick/TrailBlazes';
import { Crossroads } from './signsTrails/Crossroads';
import { FakeSigns } from './signsTrails/FakeSigns';
import { RockClimb } from './signsTrails/RockClimb';
import { SketchyBridge } from './sketchyBridge/SketchyBridge';
import { FallingRocks } from './fallingRocks/FallingRocks';
import { Trails } from './signsTrails/Trails';
import { Whackoon } from './whackoon/Whackoon';
import { Minefield } from './minefield/Minefield';
import { ThinIce } from './thinIce/ThinIce';
import { TrailMap } from './trailMap/TrailMap';
import type { PuzzleRunProps } from './puzzleProps';
import { RememberPath } from './rememberPath/RememberPath';
import { Traildle } from './traildle/Traildle';

export interface MinigamePreviewProps {
  settings: MinigameSettings;
  hikers: readonly MinigameHiker[];
}

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
  minefield: Minefield,
  thinIce: ThinIce,
  trailBlocks: TrailBlocks,
  sleepingBear: SleepingBear,
  whackoon: Whackoon,
  crossing: Crossing,
  train: Train,
  rafting: Rafting,
  trailBlazes: TrailBlazes,
  fireflyCatch: FireflyCatch,
  sizeUp: SizeUp,
  safari: Safari,
  flySwatter: FlySwatter,
  raccoonShuffle: RaccoonShuffle,
  fakeSigns: FakeSigns,
  trails: Trails,
  crossroads: Crossroads,
  rockClimb: RockClimb,
  campCleanup: CampCleanup,
  sketchyBridge: SketchyBridge,
  fallingRocks: FallingRocks,
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
function MinefieldStill({ settings, hikers }: MinigamePreviewProps) {
  return <Minefield settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
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

function TrailBlazesStill({ settings, hikers }: MinigamePreviewProps) {
  return <TrailBlazes settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function FireflyCatchStill({ settings, hikers }: MinigamePreviewProps) {
  return <FireflyCatch settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function SizeUpStill({ settings, hikers }: MinigamePreviewProps) {
  return <SizeUp settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function SafariStill({ settings, hikers }: MinigamePreviewProps) {
  return <Safari settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function FlySwatterStill({ settings, hikers }: MinigamePreviewProps) {
  return <FlySwatter settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function RaccoonShuffleStill({ settings, hikers }: MinigamePreviewProps) {
  return <RaccoonShuffle settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function FakeSignsStill({ settings, hikers }: MinigamePreviewProps) {
  return <FakeSigns settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function TrailsStill({ settings, hikers }: MinigamePreviewProps) {
  return <Trails settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function CrossroadsStill({ settings, hikers }: MinigamePreviewProps) {
  return <Crossroads settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function RockClimbStill({ settings, hikers }: MinigamePreviewProps) {
  return <RockClimb settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function CampCleanupStill({ settings, hikers }: MinigamePreviewProps) {
  return <CampCleanup settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function SketchyBridgeStill({ settings, hikers }: MinigamePreviewProps) {
  return <SketchyBridge settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}
function FallingRocksStill({ settings, hikers }: MinigamePreviewProps) {
  return <FallingRocks settings={settings} hikers={hikers} seed={1} onDone={noop} still />;
}

export const PREVIEWS: Readonly<Record<string, ComponentType<MinigamePreviewProps>>> = {
  traildle: TraildleStill,
  findObject: FindObjectStill,
  rememberPath: RememberPathStill,
  findPath: FindPathStill,
  dodge: DodgeStill,
  trailMap: TrailMapStill,
  memory: MemoryStill,
  picturePuzzle: PicturePuzzleStill,
  minefield: MinefieldStill,
  thinIce: ThinIceStill,
  trailBlocks: TrailBlocksStill,
  sleepingBear: SleepingBearStill,
  whackoon: WhackoonStill,
  crossing: CrossingStill,
  train: TrainStill,
  rafting: RaftingStill,
  trailBlazes: TrailBlazesStill,
  fireflyCatch: FireflyCatchStill,
  sizeUp: SizeUpStill,
  safari: SafariStill,
  flySwatter: FlySwatterStill,
  raccoonShuffle: RaccoonShuffleStill,
  fakeSigns: FakeSignsStill,
  trails: TrailsStill,
  crossroads: CrossroadsStill,
  rockClimb: RockClimbStill,
  campCleanup: CampCleanupStill,
  sketchyBridge: SketchyBridgeStill,
  fallingRocks: FallingRocksStill,
};
