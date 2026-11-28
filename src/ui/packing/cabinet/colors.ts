/** The cabinet's colors (27-packing-screen.md, section 2). */
import type { PackType } from '../../../packing/logic';

/**
 * Each item type's plaque, light to mid, from the game's item colors
 * (ITEM_TYPE_COLORS; the shelter's middle blue is the prototype's).
 */
export const CAB_TYPE: Readonly<Record<PackType, readonly [string, string]>> = {
  tool: ['#f0ab35', '#f08c35'],
  food: ['#c7da7b', '#45a86c'],
  clothes: ['#e6b389', '#c18553'],
  shelter: ['#83c4ed', '#6f8fc0'],
};

/** Autumn leaves for the jackpot and the hike's start. */
export const LEAVES: readonly string[] = ['#c8423a', '#e8a33a', '#e8c55a', '#8aa64a', '#b5653a'];
