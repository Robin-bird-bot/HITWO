/**
 * The rules engine: pure TypeScript with no React, no DOM and no Math.random
 * (ESLint enforces this).
 *
 * - The whole game is one serializable GameState, and every change goes
 *   through applyAction(state, action).
 * - All randomness comes from the seeded RNG stored in the state.
 * - Every tunable number comes from src/config/balance.ts.
 * - Traits, conditions and items plug in through hooks (see effects.ts).
 *
 * See CLAUDE.md, "Architecture rules".
 */
export * from './types';
export { applyAction, validateAction, InvalidActionError } from './applyAction';
export { createGame, type HikerSetup, type NewGameOptions } from './newGame';
export { hikersWhoHaventActed } from './dayLoop';
export { moveCost, moveAllCost, type HikerCost } from './costs';
export { abilitiesFor, type AvailableAbility, type TraitDef } from './effects';
export {
  isExhausted,
  isFamished,
  isFatigued,
  isHungry,
  thresholdStates,
  type ThresholdState,
} from './thresholds';
export { adjacentTileIds, hikersOnTile, isAlone, lineBetween } from './map';
export { isSheltered } from './actions/sleep';
export { SAVE_VERSION, serialize, deserialize, type LoadResult, type LoadFailure } from './save';
export { generateSection, type SectionOptions } from './trail/generate';
export { checkSection } from './trail/check';
export { seedRng } from './rng';
export { bagSlots, resourceCount, type BagSlots, type ItemSlots } from './inventory';
export type { ItemDef, ItemType, FamilyDef, AbilityDef } from './effects';
export { canDeal, dealCard, dealCards, type DealInput } from './scavenge/deal';
export { clampLuck, moraleLuck, rarityOdds } from './scavenge/rarity';
export { scavengeCost, scavengeSetup } from './scavenge/setup';
export { bonusTaken, cardGains, pickOptions, rerollAbility } from './actions/scavenge';
export { isLow } from './abundance';
export { tendAmount, tendCost, tendableNodes } from './actions/tend';
export { blockedByStatus, withoutStatus } from './status';
