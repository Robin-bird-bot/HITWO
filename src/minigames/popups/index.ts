/**
 * Every game's pop-up content (docs/design/20-challenge-popup.md, sections
 * 6 and 7), by minigame id.
 */
import type { GamePopup } from './types';
import {
  CAMP_CLEANUP_POPUP,
  CROSSING_POPUP,
  DODGE_POPUP,
  RAFTING_POPUP,
  ROCK_CLIMB_POPUP,
  SKETCHY_BRIDGE_POPUP,
  FALLING_ROCKS_POPUP,
  TRAILS_POPUP,
  TRAIN_POPUP,
} from './movement';
import {
  CROSSROADS_POPUP,
  FAKE_SIGNS_POPUP,
  FIND_OBJECT_POPUP,
  FIND_PATH_POPUP,
  MEMORY_POPUP,
  PICTURE_PUZZLE_POPUP,
  REMEMBER_PATH_POPUP,
  SAFARI_POPUP,
  MINEFIELD_POPUP,
  THIN_ICE_POPUP,
  BIRDSONG_POPUP,
  PACK_IT_UP_POPUP,
  TRAILDLE_POPUP,
  TRAIL_MAP_POPUP,
} from './puzzle';
import {
  FIREFLY_CATCH_POPUP,
  FLY_BLOCK_POPUP,
  SQUIRREL_THEFT_POPUP,
  FLY_SWATTER_POPUP,
  RACCOON_SHUFFLE_POPUP,
  SIZE_UP_POPUP,
  SLEEPING_BEAR_POPUP,
  TRAIL_BLAZES_POPUP,
  TRAIL_BLOCKS_POPUP,
  WHACKOON_POPUP,
} from './reaction';

export type { Bar, ControlRow, GamePopup, IfFail, Input, PerHiker, Phrase } from './types';

export const POPUPS: Readonly<Record<string, GamePopup>> = {
  dodge: DODGE_POPUP,
  campCleanup: CAMP_CLEANUP_POPUP,
  crossing: CROSSING_POPUP,
  train: TRAIN_POPUP,
  rafting: RAFTING_POPUP,
  trails: TRAILS_POPUP,
  rockClimb: ROCK_CLIMB_POPUP,
  sketchyBridge: SKETCHY_BRIDGE_POPUP,
  fallingRocks: FALLING_ROCKS_POPUP,
  traildle: TRAILDLE_POPUP,
  findPath: FIND_PATH_POPUP,
  trailMap: TRAIL_MAP_POPUP,
  picturePuzzle: PICTURE_PUZZLE_POPUP,
  minefield: MINEFIELD_POPUP,
  thinIce: THIN_ICE_POPUP,
  birdsong: BIRDSONG_POPUP,
  packItUp: PACK_IT_UP_POPUP,
  fakeSigns: FAKE_SIGNS_POPUP,
  rememberPath: REMEMBER_PATH_POPUP,
  memory: MEMORY_POPUP,
  safari: SAFARI_POPUP,
  crossroads: CROSSROADS_POPUP,
  findObject: FIND_OBJECT_POPUP,
  trailBlocks: TRAIL_BLOCKS_POPUP,
  flyBlock: FLY_BLOCK_POPUP,
  squirrelTheft: SQUIRREL_THEFT_POPUP,
  sleepingBear: SLEEPING_BEAR_POPUP,
  whackoon: WHACKOON_POPUP,
  trailBlazes: TRAIL_BLAZES_POPUP,
  fireflyCatch: FIREFLY_CATCH_POPUP,
  sizeUp: SIZE_UP_POPUP,
  flySwatter: FLY_SWATTER_POPUP,
  raccoonShuffle: RACCOON_SHUFFLE_POPUP,
};

/**
 * The Prepare rows that are in the design but don't change the game yet
 * (they need new mechanics in older games). The pop-up still offers them,
 * so they can be tried, and the summary lists them. TODO(wyatt).
 */
export const NOT_WIRED: Readonly<Record<string, readonly string[]>> = {
  traildle: ['showDigit'],
  findPath: ['showStep'],
  trailMap: ['route'],
  picturePuzzle: ['ghost'],
  memory: ['peek'],
  safari: ['beam'],
  crossroads: ['peek'],
  crossing: ['logs'],
  trailBlocks: ['sharpen', 'wedges', 'patch', 'ring', 'bait'],
};
