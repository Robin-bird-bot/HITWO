/**
 * The four look settings of the UI overhaul (35-ui-overhaul.md, section 1),
 * remembered on this device like the packing look. Changing one takes effect
 * the next time that screen opens.
 *
 * - **Actions:** the wheel over the hiker (the default), or the side grid.
 * - **Scavenge reveal:** deal and flip (the default), or brush the covers away.
 * - **Crafting look:** Paper (the default), or the TrailMate handheld.
 * - **Loading screen:** the Runner (the default, Claude's idea), or the Node wheel.
 */
import { deviceSetting, useDeviceSetting, type DeviceSetting } from './deviceSetting';

export type ActionsLook = 'wheel' | 'grid';
export type ScavengeReveal = 'deal' | 'brush';
export type CraftingLook = 'paper' | 'trailmate';
export type LoadingLook = 'runner' | 'nodeWheel';

export const ACTIONS_SETTING = deviceSetting<ActionsLook>(
  'hike-in-the-woods/actions-look',
  ['wheel', 'grid'],
  'wheel',
);
export const SCAVENGE_REVEAL_SETTING = deviceSetting<ScavengeReveal>(
  'hike-in-the-woods/scavenge-reveal',
  ['deal', 'brush'],
  'deal',
);
export const CRAFTING_LOOK_SETTING = deviceSetting<CraftingLook>(
  'hike-in-the-woods/crafting-look',
  ['paper', 'trailmate'],
  'paper',
);
export const LOADING_LOOK_SETTING = deviceSetting<LoadingLook>(
  'hike-in-the-woods/loading-look',
  ['runner', 'nodeWheel'],
  'runner',
);

export const useActionsLook = (): ActionsLook => useDeviceSetting(ACTIONS_SETTING);
export const useScavengeReveal = (): ScavengeReveal => useDeviceSetting(SCAVENGE_REVEAL_SETTING);
export const useCraftingLook = (): CraftingLook => useDeviceSetting(CRAFTING_LOOK_SETTING);
export const useLoadingLook = (): LoadingLook => useDeviceSetting(LOADING_LOOK_SETTING);

interface Choice<T extends string> {
  id: T;
  label: string;
  text: string;
}

/** One setting in the ☰ menu: its name, where it's stored, and its choices. */
export interface LookSetting<T extends string> {
  name: string;
  setting: DeviceSetting<T>;
  choices: readonly Choice<T>[];
}

export const LOOK_SETTINGS = [
  {
    name: 'Actions',
    setting: ACTIONS_SETTING,
    choices: [
      { id: 'wheel', label: 'Wheel', text: 'Round buttons pop up over the hiker.' },
      { id: 'grid', label: 'Side grid', text: 'The buttons sit on the right, under the tile.' },
    ],
  } satisfies LookSetting<ActionsLook>,
  {
    name: 'Scavenge reveal',
    setting: SCAVENGE_REVEAL_SETTING,
    choices: [
      { id: 'deal', label: 'Deal and flip', text: 'Cards are dealt face down. Tap to flip.' },
      { id: 'brush', label: 'Brush', text: 'Brush leaves, pebbles, grass or stone off each card.' },
    ],
  } satisfies LookSetting<ScavengeReveal>,
  {
    name: 'Crafting look',
    setting: CRAFTING_LOOK_SETTING,
    choices: [
      { id: 'paper', label: 'Paper', text: 'A workbench over a recipe book.' },
      { id: 'trailmate', label: 'TrailMate', text: 'The same, on the yellow handheld.' },
    ],
  } satisfies LookSetting<CraftingLook>,
  {
    name: 'Loading screen',
    setting: LOADING_LOOK_SETTING,
    choices: [
      { id: 'runner', label: 'Runner', text: 'A little hiker runs and hops along.' },
      { id: 'nodeWheel', label: 'Node wheel', text: 'The four nodes circle, with trail photos.' },
    ],
  } satisfies LookSetting<LoadingLook>,
] as const;
