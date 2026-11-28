/** TrailMate's bright colors on the green screens (28-packing-screen-trailmate.md, section 1.2). */
import type { PackType } from '../../../packing/logic';

/** Each type's bright bracket color on the green screens (Claude's: brightened from the game's own). */
export const TYPE_COLOR: Readonly<Record<PackType, string>> = {
  tool: '#FF9F1C',
  food: '#8BE04E',
  clothes: '#FFB37A',
  shelter: '#4FC3F7',
};
/** Each bundle size's color: ×1 cyan, ×2 lime, ×3 pink, ×5 gold. */
const SIZE_COLOR: Readonly<Record<number, string>> = {
  1: '#4FC3F7',
  2: '#8BE04E',
  3: '#FF6BD6',
  4: '#FF6BD6',
  5: '#FFD23F',
};
export const sizeColor = (n: number) => SIZE_COLOR[Math.min(5, n)] ?? '#FFD23F';
export const GOLD = '#FFD23F';
export const NEON = ['#6BFF8A', '#FFD23F', '#FF6BD6', '#4FC3F7', '#FF9F1C', '#ffffff'];
export const TIER2_SPARKS = ['#FFD23F', '#FF6BD6', '#6BF2FF', '#ffffff'];
